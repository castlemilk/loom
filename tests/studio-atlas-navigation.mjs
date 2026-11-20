import assert from 'node:assert/strict'

const hub = '[data-topic-ring="1"]', piano = '[data-map-marker="selected"]'
const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
const marker = (page, selector) => page.locator(selector).evaluate(el => ['cx', 'cy', 'r'].map(a => Number(el.getAttribute(a))))
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

// Sample the same SVG positions that overlay the painted WebGL nodes, throughout each change.
async function traceLayout(page, menu, mode, animated) {
  await menu.scrollIntoViewIfNeeded()
  await frames(page)
  await page.evaluate(({ hub, piano }) => {
    const surface = document.querySelector('.atlas-map-surface')
    const marker = selector => {
      const el = document.querySelector(selector)
      return ['cx', 'cy'].map(a => Number(el.getAttribute(a)))
    }
    const sample = () => [marker(hub), marker(piano), surface.dataset.layoutMoving === 'true']
    window.layoutTrace = [sample()]
    const tick = () => {
      window.layoutTrace.push(sample())
      window.layoutSampleFrame = requestAnimationFrame(tick)
    }
    window.layoutSampleFrame = requestAnimationFrame(tick)
  }, { hub, piano })
  await menu.selectOption(mode)
  if (animated) await page.waitForFunction(() => window.layoutTrace.some(row => row[2]))
  await frames(page)
  await page.locator('[data-layout-moving="false"]').waitFor()
  await frames(page)
  const rows = await page.evaluate(() => {
    cancelAnimationFrame(window.layoutSampleFrame)
    return window.layoutTrace
  })
  const start = rows[0], end = rows.at(-1)
  assert.ok(distance(start[0], end[0]) > 12 && distance(start[1], end[1]) > 12, 'Music and Piano both changed position')
  const middle = rows.filter(row => [0, 1].every(i => Math.min(distance(row[i], start[i]), distance(row[i], end[i])) > 2))
  if (animated) assert.ok(middle.length >= 3, 'Both nodes were visible at several intermediate positions')
  else assert.ok(!middle.length && !rows.some(row => row[2]), 'Instant layouts jump directly to their final positions')
  return { end, middle: middle.length }
}

async function doubleAt(page, x, y, touch) {
  if (!touch) return page.mouse.dblclick(x, y, { delay: 40 })
  await page.touchscreen.tap(x, y)
  await page.touchscreen.tap(x, y)
}

async function doubleDot(page, selector, touch) {
  const canvas = page.locator('.atlas-map-surface canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox(), [dx, dy] = await marker(page, selector)
  const x = box.x + dx, y = box.y + dy
  assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [x, y]), 'CANVAS')
  await doubleAt(page, x, y, touch)
}
function centered(page, selector) {
  return page.waitForFunction(selector => {
    const el = document.querySelector(selector), canvas = document.querySelector('.atlas-map-surface canvas')
    return el && Math.hypot(+el.getAttribute('cx') - canvas.clientWidth / 2, +el.getAttribute('cy') - canvas.clientHeight / 2) < 1
  }, selector)
}

export async function studioAtlasNavigation(context, home, touch = false) {
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(e.message))
  const button = name => page.getByRole('button', { name, exact: true })
  const menu = page.getByRole('combobox', { name: 'Layout', exact: true })
  const toggle = page.getByRole('checkbox', { name: 'Animate layouts', exact: true })
  const visible = () => page.locator('[data-visible-articles="96"]').waitFor()
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(new URL('studio/wikispeedia/?topic=music', home).href)
    await visible()
    await page.locator('[data-article-id="97"]').click()
    await page.locator(piano).waitFor()
    await frames(page)
    const reads = await page.locator('[data-read-requests]').textContent()
    assert.ok(await toggle.isChecked())
    const orbit = await traceLayout(page, menu, 'orbit', true)
    await toggle.uncheck()
    assert.equal(new URL(page.url()).searchParams.get('transition'), 'instant')
    await traceLayout(page, menu, 'published', false)
    const instant = await traceLayout(page, menu, 'orbit', false)
    assert.ok(distance(instant.end[0], orbit.end[0]) < 1 && distance(instant.end[1], orbit.end[1]) < 1)
    assert.equal(await page.locator('[data-read-requests]').textContent(), reads)
    await page.reload()
    await visible()
    assert.equal(await toggle.isChecked(), false)
    await toggle.check()
    await menu.selectOption('cloud')
    await page.locator('[data-layout-moving="true"]').waitFor()
    await menu.selectOption('lanes')
    await page.locator('[data-layout-moving="true"]').waitFor()
    await toggle.uncheck()
    await page.locator('[data-layout-moving="false"]').waitFor()
    assert.equal(await menu.inputValue(), 'lanes')
    await menu.selectOption('published')
    await visible()
    await frames(page)
    const r = (await marker(page, hub))[2]
    await doubleDot(page, hub, touch)
    await centered(page, hub)
    assert.ok((await marker(page, hub))[2] > r * 1.3, 'Double activation zooms into Music')
    await visible()
    await page.locator('[data-article-id="97"]').click()
    await frames(page)
    await doubleDot(page, piano, touch)
    await centered(page, piano)
    assert.equal(await page.locator('[data-map-caption="selected"]').textContent(), 'Piano')
    await button('Fit view').click()
    await page.waitForFunction(selector => Number(document.querySelector(selector)?.getAttribute('r')) < 16, hub)
    // A closed topic opens once and stays open when focused from its name.
    await button('Collapse Music').click()
    await page.locator('[data-visible-articles="0"]').waitFor()
    const label = page.locator('[data-map-topic="1"]')
    await label.scrollIntoViewIfNeeded()
    const box = await label.boundingBox()
    await doubleAt(page, box.x + box.width / 2, box.y + box.height / 2, touch)
    await visible()
    await centered(page, hub)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.wiki-animate input:disabled').waitFor()
    assert.ok(await toggle.isDisabled())
    await button('Fit view').click()
    await frames(page)
    await label.press('Enter')
    await centered(page, hub)
    await page.locator('[data-article-id="97"]').click()
    await frames(page)
    await traceLayout(page, menu, 'orbit', false)
    await visible()
    assert.equal(await page.locator('[data-map-caption="selected"]').textContent(), 'Piano')
    assert.deepEqual(errors, [])
    return { intermediateFrames: orbit.middle, focused: ['Music', 'Piano'], touch }
  } finally { await page.close() }
}
