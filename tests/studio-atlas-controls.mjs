import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const frames = (page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
const scenePositions = (page) =>
  page
    .locator('[data-map-topic]')
    .evaluateAll((labels) => labels.map((el) => [parseFloat(el.style.left), parseFloat(el.style.top)]))

// Compare the article actually painted after equal 40px drags, on the same map and zoom.
async function measureDrag(page, touch) {
  await page.getByRole('button', { name: 'Reset positions' }).click()
  const label = page.locator('[data-map-topic="1"]')
  await label.scrollIntoViewIfNeeded()
  await frames(page)
  const box = await label.boundingBox(),
    x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.evaluate(() => {
    const x = (selector) => +document.querySelector(selector).getAttribute('cx')
    const hub = '[data-topic-ring="1"]',
      article = '[data-map-marker="selected"]'
    const h0 = x(hub),
      a0 = x(article)
    window.loomSpringTrace = new Promise((resolve, reject) => {
      let start,
        half,
        peak = 0,
        settled = 0
      const deadline = performance.now() + 8000
      function sample(time) {
        if (Math.abs(x(hub) - h0 - 40) < 0.5) {
          start ??= time
          const distance = x(article) - a0
          if (distance >= 20) half ??= time - start
          peak = Math.max(peak, distance)
          settled = Math.abs(distance - 40) <= 0.06 ? settled + 1 : 0
          if (settled >= 5) return resolve({ half, peak, settledMs: time - start })
        }
        if (time > deadline) return reject(new Error('Music or Piano did not complete the measured drag'))
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
  })
  if (touch) {
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y }] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally {
      await session.detach()
    }
  } else {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 40, y)
    await page.mouse.up()
  }
  return page.evaluate(() => window.loomSpringTrace)
}

export async function studioAtlasControls(context, home, touch = false) {
  const page = await context.newPage(),
    errors = []
  page.setDefaultTimeout(18000)
  page.on('pageerror', (e) => errors.push(e.message))
  const strength = page.getByRole('slider', { name: 'Spring strength', exact: true })
  const damping = page.getByRole('slider', { name: 'Damping', exact: true })
  const menu = page.getByRole('combobox', { name: 'Layout', exact: true })
  async function end(slider, high) {
    if (touch) {
      await slider.scrollIntoViewIfNeeded()
      const box = await slider.boundingBox()
      await slider.tap({ position: { x: high ? box.width - 1 : 1, y: box.height / 2 } })
    } else await slider.press(high ? 'End' : 'Home')
  }
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(new URL('studio/wikispeedia/?topic=music', home).href)
    await page.locator('[data-visible-articles="96"]').waitFor()
    await page.locator('[data-article-id="97"]').click()
    await page.locator('[data-map-marker="selected"]').waitFor()
    assert.equal(await menu.inputValue(), 'published')
    const reads = await page.locator('[data-read-requests]').textContent()
    await end(strength, false)
    assert.equal(await strength.inputValue(), '0.25')
    const weak = await measureDrag(page, touch)
    await end(strength, true)
    assert.equal(await strength.inputValue(), '4')
    const strong = await measureDrag(page, touch)
    await end(damping, false)
    assert.equal(await damping.inputValue(), '0.2')
    const bouncy = await measureDrag(page, touch)
    assert.ok(
      weak.half > strong.half + 20,
      'Stronger springs catch up earlier: ' + JSON.stringify({ weak, strong }),
    )
    assert.ok(
      strong.peak < 40.25 && bouncy.peak > 45 && bouncy.settledMs > strong.settledMs,
      'Damping changes rebound and settling: ' + JSON.stringify({ strong, bouncy }),
    )
    await page.getByRole('button', { name: 'Reset positions' }).click()
    await frames(page)
    const arrangements = new Set([JSON.stringify(await scenePositions(page))])
    for (const mode of ['drift', 'lanes', 'orbit', 'cloud']) {
      await menu.selectOption(mode)
      await frames(page)
      arrangements.add(JSON.stringify(await scenePositions(page)))
      assert.equal(new URL(page.url()).searchParams.get('layout'), mode)
      assert.equal(await page.locator('[data-visible-articles]').getAttribute('data-visible-articles'), '96')
      assert.equal(await page.locator('[data-map-caption="selected"]').textContent(), 'Piano')
      if (mode === 'orbit') {
        const shots = new URL('../artifacts/studio/', import.meta.url)
        await mkdir(shots, { recursive: true })
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: fileURLToPath(new URL('wikipedia-layout-tuning-' + (touch ? 'mobile' : 'desktop') + '.png', shots)),
        })
      }
    }
    assert.equal(arrangements.size, 5, 'All five layouts place the topics differently')
    assert.equal(
      await page.locator('[data-read-requests]').textContent(),
      reads,
      'Tuning and re-layout reuse loaded blocks',
    )
    const cloud = await scenePositions(page)
    await page.locator('canvas').press('ArrowRight')
    await frames(page)
    assert.notDeepEqual(await scenePositions(page), cloud, 'Cloud rotates in depth')
    const hub = page.locator('[data-topic-ring="1"]')
    const oldX = await hub.getAttribute('cx'),
      other = (await scenePositions(page))[9]
    await page.locator('[data-map-topic="1"]').press('ArrowRight')
    await frames(page)
    assert.ok(Math.abs(+(await hub.getAttribute('cx')) - oldX - 12) < 1, 'Topic moves in the camera plane')
    assert.deepEqual((await scenePositions(page))[9], other)
    await page.getByRole('button', { name: 'Reset positions' }).click()
    await page.reload()
    await page.locator('[data-visible-articles="96"]').waitFor()
    assert.equal(await menu.inputValue(), 'cloud')
    assert.equal(await strength.inputValue(), '4')
    assert.equal(await damping.inputValue(), '0.2')
    await page.getByRole('button', { name: 'Reset tuning' }).click()
    assert.equal(await strength.inputValue(), '1')
    assert.equal(await damping.inputValue(), '1')
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: 'Rigid', exact: true }) })
      .click()
    assert.ok((await strength.isDisabled()) && (await damping.isDisabled()))
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: 'Spring', exact: true }) })
      .click()
    await page.getByRole('checkbox', { name: 'Move articles with their topic' }).uncheck()
    assert.ok(await strength.isDisabled())
    await page.getByRole('checkbox', { name: 'Move articles with their topic' }).check()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByText('Reduced motion is on. Articles move together.').waitFor()
    assert.ok(await damping.isDisabled())
    assert.deepEqual(errors, [])
    return { weak, strong, bouncy, layouts: arrangements.size, touch }
  } finally {
    await page.close()
  }
}
