import { chooseGraph } from './graph-picker.mjs'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const shots = new URL('../artifacts/studio/', import.meta.url)
const rect = (page, selector) =>
  page.locator(selector).evaluate((el) => [parseFloat(el.style.left), parseFloat(el.style.top)])
const samePoint = (a, b) =>
  assert.ok(
    a.every((v, i) => Math.abs(v - b[i]) <= 1),
    'Map point moved: ' + a + ' → ' + b,
  )
const setRadio = (page, name) =>
  page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name, exact: true }) })
    .click()
const waitFrames = (page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
const modeSelector = '[data-map-topic="9"]'

export async function studioProgressive(context, home, touch = false) {
  const page = await context.newPage()
  page.setDefaultTimeout(18000)
  await mkdir(shots, { recursive: true })
  const shot = (name) =>
    page.screenshot({ path: fileURLToPath(new URL(name + (touch ? '-mobile' : '-desktop') + '.png', shots)) })
  const errors = [],
    responses = []
  page.on('pageerror', (e) => errors.push(e.message))
  const record = (r) => {
    if (/\.(sqlite|wasm)$|\/graph-[0-9a-f]+\.json$/.test(new URL(r.url()).pathname))
      responses.push({
        url: r.url(),
        method: r.request().method(),
        status: r.status(),
        bytes: Number(r.headers()['content-length']),
      })
  }
  context.on('response', record)
  const click = (target) => (touch ? target.tap() : target.click())
  const button = (name) => page.getByRole('button', { name, exact: true })
  const loaded = async (n) => {
    const error = page.locator('.atlas-side [role="alert"]')
    await page
      .locator('[data-loaded="' + n + '"]')
      .or(error)
      .first()
      .waitFor()
    if (await error.isVisible()) throw new Error('Atlas reader: ' + (await error.innerText()))
  }
  const visible = (n) => page.locator('[data-visible-articles="' + n + '"]').waitFor()
  const reads = () => page.locator('[data-read-bytes]').evaluate((el) => Number(el.dataset.readBytes))
  let mathBytes, fullBytes
  try {
    await page.goto(home)
    await click(page.getByRole('link', { name: 'Wikispeedia', exact: true }))
    await loaded(0)
    await page.waitForFunction(() => parseFloat(document.querySelector('[data-map-topic="9"]')?.style.left) > 0)
    assert.equal(await page.locator('[data-map-topic]').count(), 16)
    assert.equal(await reads(), 0)
    assert.deepEqual(responses, [])
    await shot('wikispeedia-overview')
    if (!touch) {
      const before = await rect(page, modeSelector)
      await page.locator('canvas').press('ArrowRight')
      await page.waitForFunction(
        ([x]) => Math.abs(parseFloat(document.querySelector('[data-map-topic="9"]').style.left) - x) > 15,
        before,
      )
      await waitFrames(page)
    }
    const original = await rect(page, modeSelector)
    await click(button('Open Mathematics on map'))
    await loaded(43)
    await visible(43)
    await page.locator('[data-visible-links="217"]').waitFor()
    await waitFrames(page)
    samePoint(original, await rect(page, modeSelector))
    mathBytes = await reads()
    assert.ok(mathBytes > 0 && mathBytes < 1500000)
    const chunks = responses.filter((r) => r.url.endsWith('.sqlite') && r.method === 'GET')
    assert.ok(chunks.length > 0 && chunks.every((r) => r.status === 206), 'SQLite GETs must use HTTP 206')
    assert.equal(
      chunks.reduce((n, r) => n + r.bytes, 0),
      mathBytes,
    )
    assert.ok(!responses.some((r) => r.url.endsWith('.json')))
    await shot('wikispeedia-mathematics')
    const mathRequests = chunks.length
    await click(button('Collapse Mathematics'))
    await visible(0)
    await click(button('Expand Mathematics'))
    await visible(43)
    assert.equal(await reads(), mathBytes)
    assert.equal(responses.filter((r) => r.url.endsWith('.sqlite') && r.method === 'GET').length, mathRequests)
    await click(button('Expand Art'))
    await loaded(80)
    await visible(80)
    await waitFrames(page)
    samePoint(original, await rect(page, modeSelector))
    const sceneLinks = await page.locator('[data-visible-links]').textContent()
    await setRadio(page, 'All at once')
    await loaded(4604)
    await visible(80)
    await waitFrames(page)
    assert.equal(await page.locator('[data-visible-links]').textContent(), sceneLinks)
    samePoint(original, await rect(page, modeSelector))
    fullBytes = await reads()
    assert.ok(fullBytes > mathBytes)
    assert.equal(await page.locator('[data-read-requests]').getAttribute('data-read-requests'), '1')
    assert.equal(responses.filter((r) => r.url.endsWith('.json')).length, 1)
    const shareURL = new URL(page.url())
    assert.equal(shareURL.searchParams.get('topic'), 'mathematics,art')
    assert.equal(shareURL.searchParams.get('loading'), 'full')
    await click(button('Collapse Art'))
    await visible(43)
    const results = page.getByRole('group', { name: 'Articles in topic' })
    await page.getByRole('searchbox').fill('Mathematics')
    await click(results.getByRole('button', { name: 'Mathematics', exact: true }))
    await click(button('View article cards'))
    await page.getByRole('heading', { name: 'Around Mathematics', exact: true }).waitFor()
    assert.ok((await page.locator('[data-card-edge]').count()) > 0)
    assert.ok((await page.locator('[data-card-arrow]').count()) > 0)
    assert.ok(
      (await page.getByRole('link', { name: /Read on Wikipedia/ }).getAttribute('href')).endsWith('/Mathematics'),
    )
    const neighbor = page.locator('[data-card-id][aria-pressed="false"]').first()
    const neighborName = (await neighbor.getAttribute('aria-label')).split(' · ')[0]
    await neighbor.press('Enter')
    await click(button('Explore this article'))
    await page.getByRole('heading', { name: 'Around ' + neighborName, exact: true }).waitFor()
    await click(button('← Topic map'))
    await page.getByRole('heading', { name: 'Wikispeedia', exact: true }).waitFor()
    await waitFrames(page)
    samePoint(original, await rect(page, modeSelector))
    await click(page.getByRole('checkbox', { name: 'Keep camera in place' }))
    await click(button('Expand Art'))
    await visible(80)
    await page.waitForFunction(([x, y]) => {
      const style = document.querySelector('[data-map-topic="9"]').style
      return Math.hypot(parseFloat(style.left) - x, parseFloat(style.top) - y) > 20
    }, original)
    const previous = responses.length
    await page.goto(shareURL.href)
    await loaded(4604)
    await visible(80)
    assert.ok(
      responses.slice(previous).every((r) => r.url.endsWith('.json')),
      'A full download must work without WASM',
    )
    if (!touch) {
      await click(button('Expand all'))
      await visible(4604)
      await page.locator('[data-visible-links="119882"]').waitFor()
      await click(button('Collapse all'))
      await visible(0)
      await setRadio(page, 'On demand')
      await loaded(0)
      await page.route('**/sqlite.worker.js', (route) => route.abort(), { times: 1 })
      await click(button('Expand Mathematics'))
      await page.locator('.atlas-side [role="alert"]').waitFor()
      await click(button('Retry'))
      await visible(43)
      await click(button('Expand all'))
      await visible(4604)
      await page.locator('[data-visible-links="119882"]').waitFor()
      await click(button('Collapse all'))
      await visible(0)
    }
    await chooseGraph(page, 'cards', touch)
    await page.getByRole('heading', { name: 'Around Canva' }).waitFor()
    const cards = page.locator('[data-card-id]')
    await cards.first().waitFor()
    assert.equal(await cards.count(), 7)
    assert.equal(await page.locator('[data-card-port]').count(), 14)
    assert.equal(await page.locator('[data-card-edge]').count(), 6)
    const captions = await page.locator('[data-card-caption]').count()
    assert.ok(captions >= 3)
    await shot('relationship-cards')
    const air = page.locator('[data-card-id="partner:airtree"]'),
      selected = page.getByRole('region', { name: 'Selected entity' })
    await click(air)
    await selected.getByRole('heading', { name: 'Airtree' }).waitFor()
    assert.equal(
      await selected.getByRole('link', { name: /Evidence/ }).getAttribute('href'),
      'https://www.airtree.vc/companies/canva',
    )
    const stage = page.locator('.atlas-card-svg'), view = await stage.getAttribute('viewBox')
    await click(page.getByRole('button', { name: 'Fit view', exact: true }))
    await air.scrollIntoViewIfNeeded()
    const target = await air.boundingBox(), cx = target.x + target.width / 2, cy = target.y + target.height / 2
    if (touch) { await page.touchscreen.tap(cx, cy); await page.touchscreen.tap(cx, cy) }
    else await page.mouse.dblclick(cx, cy)
    await page.waitForFunction(before => document.querySelector('.atlas-card-svg').getAttribute('viewBox') !== before, view)
    const framed = await stage.evaluate(svg => {
      const card = svg.querySelector('[data-card-id="partner:airtree"]').getBoundingClientRect()
      const viewport = svg.getBoundingClientRect()
      return Math.hypot(card.x + card.width / 2 - viewport.x - viewport.width / 2, card.y + card.height / 2 - viewport.y - viewport.height / 2)
    })
    assert.ok(framed < 2, 'Airtree is centered in the card view')
    await click(page.getByRole('button', { name: 'Fit view', exact: true }))
    const before = await air.getAttribute('transform')
    const edge = page.locator('[data-card-edge="partner:airtree startup:canva"]'),
      firstPath = await edge.getAttribute('d')
    await air.press('ArrowDown')
    assert.notEqual(await air.getAttribute('transform'), before)
    assert.notEqual(await edge.getAttribute('d'), firstPath)
    if (!touch) {
      const box = await air.boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2
      const pose = await air.getAttribute('transform')
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 32, y + 20, { steps: 4 })
      await page.mouse.up()
      assert.notEqual(await air.getAttribute('transform'), pose)
    }
    await click(page.getByRole('checkbox', { name: 'Card ports' }))
    assert.equal(await page.locator('[data-card-port]').count(), 0)
    await click(page.getByRole('checkbox', { name: 'Direction arrows' }))
    assert.equal(await page.locator('[data-card-arrow]').count(), 6)
    await click(page.getByRole('checkbox', { name: 'Relationship labels' }))
    assert.equal(await page.locator('[data-card-caption]').count(), 0)
    await setRadio(page, 'Dots')
    assert.equal(await air.locator('rect').count(), 0)
    await setRadio(page, 'Cards')
    assert.ok((await air.locator('rect').count()) > 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.goto(new URL('studio/?example=bauhaus&article=Anni_Albers', home).href)
    await click(button('View relationship cards'))
    const dialog = page.getByRole('dialog', { name: 'Around Anni Albers' })
    await dialog.waitFor()
    const adjacent = dialog.locator('[data-card-id][aria-pressed="false"]').first()
    const otherName = (await adjacent.getAttribute('aria-label')).split(' · ')[0]
    await adjacent.press('Enter')
    await click(dialog.getByRole('button', { name: 'Inspect ' + otherName, exact: true }))
    await dialog.waitFor({ state: 'detached' })
    await page.locator('#selection').getByText(otherName, { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    return {
      mathematics: { bytes: mathBytes, rangeRequests: mathRequests },
      fullBytes,
      articles: 4604,
      links: 119882,
      cards: 7,
      captions,
    }
  } finally {
    context.off('response', record)
    await page.close()
  }
}
