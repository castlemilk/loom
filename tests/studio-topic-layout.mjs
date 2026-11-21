import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const frames = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const point = (page, selector) =>
  page.locator(selector).evaluate((el) => [Number(el.getAttribute('cx')), Number(el.getAttribute('cy'))])
const labelPoint = (page, selector) =>
  page.locator(selector).evaluate((el) => [parseFloat(el.style.left), parseFloat(el.style.top)])
const shift = (a, [x, y]) => [a[0] + x, a[1] + y]
function at(actual, expected, what) {
  assert.ok(
    actual.every((n, i) => Math.abs(n - expected[i]) < 1.3),
    what + ': ' + actual + ' vs ' + expected,
  )
}

// Use trusted mouse or touch input so capture, scrolling and hit testing all run in Chrome.
export async function drag(page, touch, [x, y], [dx, dy], held) {
  if (touch) {
    const session = await page.context().newCDPSession(page)
    const send = (type, touchPoints) => session.send('Input.dispatchTouchEvent', { type, touchPoints })
    try {
      await send('touchStart', [{ x, y }])
      for (let i = 1; i <= 4; i++) await send('touchMove', [{ x: x + (dx * i) / 4, y: y + (dy * i) / 4 }])
      if (held) await held()
      await send('touchEnd', [])
    } finally {
      await session.detach()
    }
  } else {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx, y + dy, { steps: 4 })
    if (held) await held()
    await page.mouse.up()
  }
  await frames(page)
}
async function dragDot(page, touch, selector, delta, held) {
  const canvas = page.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  const start = shift(await point(page, selector), [bounds.x, bounds.y])
  assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, start), 'CANVAS')
  await drag(page, touch, start, delta, held)
}
async function dragLabel(page, touch, label, delta) {
  await label.scrollIntoViewIfNeeded()
  const r = await label.boundingBox()
  await drag(page, touch, [r.x + r.width / 2, r.y + r.height / 2], delta)
}

export async function studioTopicLayout(context, home, touch = false) {
  const page = await context.newPage()
  page.setDefaultTimeout(18000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const click = (el) => (touch ? el.tap() : el.click())
  const button = (name) => page.getByRole('button', { name, exact: true })
  const music = page.locator('[data-map-topic="1"]')
  const hub = '[data-topic-ring="1"]',
    selected = '[data-map-marker="selected"]',
    other = '[data-map-topic="9"]'
  const visible = (n) => page.locator('[data-visible-articles="' + n + '"]').waitFor()
  const selectPiano = async () => {
    await click(page.locator('[data-article-id="97"]'))
    await page.locator(selected).waitFor()
    await frames(page)
  }
  const wiki = new URL('studio/wikispeedia/', home)
  try {
    await page.goto(wiki.href + '?topic=music')
    await visible(96)
    await selectPiano()
    const originalHub = await point(page, hub),
      originalPiano = await point(page, selected)
    const science = await labelPoint(page, other)
    const reads = await page.locator('[data-read-requests]').textContent()
    await dragDot(page, touch, hub, [25, 18])
    at(await point(page, hub), shift(originalHub, [25, 18]), 'Music was dragged')
    at(await point(page, selected), shift(originalPiano, [25, 18]), 'Piano moved with Music')
    at(await labelPoint(page, other), science, 'Science stayed in place')
    await dragDot(page, touch, selected, [17, -5])
    at(await point(page, hub), shift(originalHub, [25, 18]), 'Moving Piano leaves its hub in place')
    at(await point(page, selected), shift(originalPiano, [42, 13]), 'Piano can be arranged independently')

    await click(button('Collapse Music'))
    await visible(0)
    await dragLabel(page, touch, music, [17, 11])
    assert.equal(await music.getAttribute('aria-pressed'), 'false', 'Dragging a closed topic preserves its state')
    await click(button('Expand Music'))
    await visible(96)
    await selectPiano()
    at(
      await point(page, selected),
      shift(originalPiano, [59, 24]),
      'Reopening keeps the carried and individual offsets',
    )
    assert.equal(await page.locator('[data-read-requests]').textContent(), reads)

    const carry = page.getByRole('checkbox', { name: 'Move articles with their topic' })
    await click(carry)
    await music.press('ArrowRight')
    await frames(page)
    at(await point(page, hub), shift(originalHub, [54, 29]), 'Detached hub moves')
    at(await point(page, selected), shift(originalPiano, [59, 24]), 'Detached article stays in place')
    await click(carry)
    await music.press('ArrowDown')
    await frames(page)
    at(await point(page, selected), shift(originalPiano, [59, 36]), 'Re-enabled group movement')
    at(await labelPoint(page, other), science, 'Other topics stay fixed throughout')
    await page.reload()
    await visible(96)
    await selectPiano()
    at(await point(page, hub), shift(originalHub, [54, 41]), 'Reload restores the hub')
    at(await point(page, selected), shift(originalPiano, [59, 36]), 'Reload restores the article')
    await click(button('Reset positions'))
    await page.locator('canvas').scrollIntoViewIfNeeded()
    await frames(page)
    at(await point(page, hub), originalHub, 'Reset restores the original hub')
    at(await point(page, selected), originalPiano, 'Reset restores the original article')

    await page.goto(wiki.href)
    await page.locator('[data-read-requests="0"]').waitFor()
    await page.waitForFunction(() => parseFloat(document.querySelector('[data-map-topic="1"]')?.style.left) > 0)
    await dragLabel(page, touch, music, [19, 14])
    await page.locator('[data-read-requests="0"]').waitFor()
    await click(music)
    await visible(96)
    await selectPiano()
    at(await point(page, hub), shift(originalHub, [19, 14]), 'Unopened hub can be moved')
    at(await point(page, selected), shift(originalPiano, [19, 14]), 'First SQLite read uses the moved center')
    await click(button('Reset positions'))
    assert.deepEqual(errors, [])
    return { topic: 'Music', members: 96, touch, restored: true }
  } finally {
    await page.close()
  }
}

export async function studioTopicMotion(context, home, touch = false) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.setDefaultTimeout(15000)
  const hub = '[data-topic-ring="1"]',
    article = '[data-map-marker="selected"]'
  const click = (el) => (touch ? el.tap() : el.click())
  async function trace() {
    await page.locator('canvas').scrollIntoViewIfNeeded()
    await frames(page)
    await page.evaluate(() => {
      const x = (name) => +document.querySelector(name).getAttribute('cx')
      const read = () => [
        x('[data-topic-ring="1"]'),
        x('[data-map-marker="selected"]'),
        parseFloat(document.querySelector('[data-map-topic="9"]').style.left),
      ]
      const start = read(),
        samples = []
      let released = false,
        frame
      document.querySelector('canvas').addEventListener(
        'pointerup',
        () => {
          released = true
        },
        { once: true },
      )
      function sample() {
        const [hub, article, science] = read()
        samples.push({ hub: hub - start[0], article: article - start[1], science: science - start[2], released })
        frame = requestAnimationFrame(sample)
      }
      sample()
      window.readLoomDrag = () => {
        cancelAnimationFrame(frame)
        return samples
      }
    })
    const original = await point(page, article)
    await dragDot(page, touch, hub, [45, 10], () => frames(page))
    await page.waitForFunction(
      ([x]) => Math.abs(+document.querySelector('[data-map-marker="selected"]').getAttribute('cx') - x - 45) < 0.04,
      original,
    )
    await frames(page)
    return page.evaluate(() => window.readLoomDrag())
  }
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(new URL('studio/wikispeedia/?topic=music', home).href)
    await page.locator('[data-visible-articles="96"]').waitFor()
    await click(page.locator('[data-article-id="97"]'))
    await page.locator(article).waitFor()
    assert.ok(await page.getByRole('radio', { name: 'Spring', exact: true }).isChecked())
    const spring = await trace()
    assert.ok(
      spring.some((s) => !s.released && s.hub - s.article > 3),
      'Article visibly trails the held topic',
    )
    assert.ok(
      spring.some((s) => s.released && s.hub - s.article > 1),
      'Article continues to settle after release',
    )
    assert.ok(
      spring.every((s) => Math.abs(s.science) < 0.1),
      'Spring movement is confined to the dragged topic',
    )
    await click(page.getByRole('button', { name: 'Reset positions' }))
    await click(page.locator('label').filter({ has: page.getByRole('radio', { name: 'Rigid', exact: true }) }))
    assert.equal(new URL(page.url()).searchParams.get('motion'), 'rigid')
    const rigid = await trace()
    assert.ok(rigid.some((s) => s.hub > 40))
    assert.ok(
      rigid.every((s) => Math.abs(s.hub - s.article) < 0.15 && Math.abs(s.science) < 0.1),
      'Rigid follows on every paint',
    )
    await page.reload()
    assert.ok(await page.getByRole('radio', { name: 'Rigid', exact: true }).isChecked())
    await click(page.getByRole('button', { name: 'Reset positions' }))
    assert.deepEqual(errors, [])
    return {
      touch,
      springLagPixels: Math.round(Math.max(...spring.map((s) => s.hub - s.article))),
      rigidLagPixels: 0,
    }
  } finally {
    await page.close()
  }
}

export async function studioConnections(context, home, touch = false) {
  const page = await context.newPage()
  page.setDefaultTimeout(18000)
  const errors = [],
    files = new Set()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.url().includes('/wikispeedia/evidence/') && response.ok())
      files.add(new URL(response.url()).pathname.split('/').pop())
  })
  const click = (el) => (touch ? el.tap() : el.click())
  try {
    await page.goto(new URL('studio/wikispeedia/?connections=mathematics,computing', home).href)
    await page.locator('[data-visible-articles="122"]').waitFor()
    const inspector = page.getByRole('region', { name: 'Topic connections' })
    const direction = inspector.getByRole('combobox', { name: 'Direction' })
    assert.match(await inspector.locator('.wiki-pair-count').textContent(), /52 hyperlinks/)
    assert.match(await direction.locator('[value=out]').textContent(), /Mathematics → Computing \(23\)/)
    assert.match(await direction.locator('[value=in]').textContent(), /Computing → Mathematics \(29\)/)
    await inspector.getByRole('searchbox').fill('Boolean logic Computer')
    await click(inspector.getByRole('button', { name: 'Boolean logic links to Computer', exact: true }))
    await inspector
      .getByText('The binary arithmetic article discusses the use of binary numbers in computer systems.', {
        exact: true,
      })
      .waitFor()
    await inspector.getByRole('searchbox').fill('')
    await direction.selectOption('in')
    await inspector.getByText('1–5 of 29').waitFor()
    await click(inspector.getByRole('button', { name: 'Next', exact: true }))
    await inspector.getByText('6–10 of 29').waitFor()
    await direction.selectOption('out')
    await inspector.getByText('1–5 of 23').waitFor()
    await inspector.getByRole('searchbox').fill('Mathematics Computer science')
    await click(inspector.getByRole('button', { name: 'Mathematics links to Computer science', exact: true }))
    const details = inspector.getByRole('region', { name: 'Connection details' })
    await details.getByRole('heading', { name: /Mathematics.*Computer science/ }).waitFor()
    const excerpt = details.locator('blockquote')
    await excerpt.waitFor()
    assert.match(await excerpt.textContent(), /theoretical computer science/i)
    const link = new URL(await details.getByRole('link', { name: /Read the archived source/ }).getAttribute('href'))
    assert.equal(link.hostname, 'dlab.epfl.ch')
    assert.match(link.pathname, /\/wp\/m\/Mathematics\.htm$/)
    assert.equal(files.size, 1, 'Only the requested topic pair needs an evidence download')
    await click(details.getByRole('button', { name: 'Show link on map' }))
    await frames(page)
    const bounds = await page.locator('canvas').boundingBox()
    const source = '[data-map-marker="source"]',
      target = '[data-map-marker="target"]'
    for (const marker of [source, target]) {
      const [x, y] = await point(page, marker)
      assert.ok(x > 0 && x < bounds.width && y > 0 && y < bounds.height, 'Focused endpoint fits the map')
    }
    const start = await point(page, source),
      end = await point(page, target)
    await page.locator('[data-map-topic="8"]').press('ArrowRight')
    await frames(page)
    at(await point(page, source), shift(start, [12, 0]), 'Crossing source follows its topic')
    at(await point(page, target), end, 'Crossing destination stays in its own topic')
    await page.locator('[data-crossing-line]').waitFor()
    assert.equal(await page.locator('[data-map-caption="source"]').textContent(), 'Mathematics')
    assert.equal(await page.locator('[data-map-caption="target"]').textContent(), 'Computer science')
    const shots = new URL('../artifacts/studio/', import.meta.url)
    await mkdir(shots, { recursive: true })
    await page.screenshot({
      path: fileURLToPath(new URL('wikispeedia-connections-' + (touch ? 'mobile' : 'desktop') + '.png', shots)),
    })
    await click(page.getByRole('button', { name: 'Reset positions' }))
    await click(inspector.getByRole('button', { name: 'Close', exact: true }))
    await inspector.waitFor({ state: 'detached' })
    assert.ok(!new URL(page.url()).searchParams.has('connections'))
    assert.equal(new URL(page.url()).searchParams.get('topic'), 'mathematics,computing')
    const canvas = page.locator('canvas')
    await canvas.scrollIntoViewIfNeeded()
    const { x, y } = await canvas.boundingBox()
    // On a phone the Wikispecies node occupies the center of this wire. Tap its clear upper segment.
    const fraction = touch ? 0.42 : 0.5
    const midpoint = [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction]
    if (touch) await page.touchscreen.tap(x + midpoint[0], y + midpoint[1])
    else await page.mouse.click(x + midpoint[0], y + midpoint[1])
    await details.waitFor()
    await page.locator('[data-crossing-line]').waitFor()
    const a = await point(page, source),
      b = await point(page, target)
    const dx = b[0] - a[0],
      dy = b[1] - a[1]
    const offset = Math.abs(dx * (a[1] - midpoint[1]) - dy * (a[0] - midpoint[0])) / Math.hypot(dx, dy)
    assert.ok(offset < 3, 'Tapping a wire opens the article pair under the pointer')
    assert.deepEqual(errors, [])
    return { hyperlinks: 52, archivedSource: link.pathname, touch }
  } finally {
    await page.close()
  }
}
