import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function fieldGuide(context, home) {
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = [], requests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  const studio = new URL('studio/', home)
  const shots = new URL('../artifacts/studio/', import.meta.url)
  await mkdir(shots, { recursive: true })
  async function checkWidth() {
    const overflow = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth
      if (document.documentElement.scrollWidth <= viewport) return []
      return [...document.body.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > viewport + 0.5)
        .map((el) => `${el.tagName}.${el.className} (${Math.round(el.getBoundingClientRect().right)}px)`).slice(0, 12)
        .concat(`page ${document.documentElement.scrollWidth}px, viewport ${viewport}px`)
    })
    assert.deepEqual(overflow, [], 'Overflow at ' + page.url() + ': ' + overflow.join(', '))
  }
  async function capture(name) {
    await page.evaluate(() => document.fonts.ready.then(() => true))
    for (const element of await page.locator('img').elementHandles()) {
      try {
        if (!await element.isVisible() || await element.evaluate(img => Boolean(img.closest('details:not([open])')))) continue
        await element.scrollIntoViewIfNeeded()
        // A viewport change can replace the responsive candidate during decode.
        await page.waitForFunction(async (img) => {
          if (!img.complete || !img.naturalWidth) return false
          const source = img.currentSrc
          try { await img.decode(); return img.currentSrc === source } catch { return false }
        }, element, { timeout: 10000 })
      } catch (cause) {
        const source = await element.evaluate((img) => img.currentSrc || img.src)
        throw new Error('Could not decode ' + source + ' for ' + name, { cause })
      } finally {
        await element.dispose()
      }
    }
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: fileURLToPath(new URL(name + '.png', shots)), fullPage: true, animations: 'disabled' })
  }
  const response = await page.goto(home)
  assert.ok((await response.text()).includes('Open graph studio'), 'The exported guide should contain its navigation before JavaScript runs')
  const launch = page.getByRole('button', { name: 'Run live model' })
  const plate = page.locator('.model-plate')
  const canvas = plate.locator('canvas')
  await page.setViewportSize({ width: 1360, height: 900 })
  await capture('field-guide-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  await capture('field-guide-mobile')
  await checkWidth()
  assert.equal(await canvas.count(), 0)
  assert.equal(requests.some((path) => path.endsWith('wire-model.json') || path.includes('/graphs/knowledge.json')), false)
  const illustrations = await page.locator('.example-list img').evaluateAll((images) => images.map((img) => new URL(img.src).pathname.split('/').at(-1)))
  assert.deepEqual(illustrations, ['explore.webp','layout.webp','groups.webp','style.webp'])
  const bounds = await plate.boundingBox()
  await launch.click()
  await page.locator('[data-preview="live"]').waitFor()
  assert.equal(await canvas.evaluate((el) => el === document.activeElement), true)
  assert.ok(Math.abs(bounds.height - (await plate.boundingBox()).height) < 1, 'Starting the model shifted the page')
  const hit = await canvas.evaluate((el) => {
    const box = el.getBoundingClientRect()
    for (let y = 8; y < box.height - 8; y += 5) for (let x = 8; x < box.width - 8; x += 5) {
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: box.x + x, clientY: box.y + y }))
      if (el.hasAttribute('data-joint')) return { x, y }
    }
  })
  assert.ok(hit, 'The live model should expose a pickable joint')
  await canvas.click({ position: hit })
  await page.waitForFunction(() => !document.querySelector('#plate-status').textContent.includes('Drag a joint'))
  const picked = await page.locator('#plate-status').textContent()
  await canvas.press('Escape')
  await page.locator('[data-preview="still"]').waitFor()
  assert.equal(await canvas.count(), 0)
  assert.equal(await launch.evaluate((button) => button === document.activeElement), true)
  await page.setViewportSize({ width: 1160, height: 760 })
  await page.getByRole('link', { name: 'Artwork', exact: true }).click()
  await page.getByRole('heading', { name: 'Loom artwork.' }).waitFor()
  const drawingLinks = await page.locator('.drawing-sheet a[download]').evaluateAll((links) => links.map((link) => new URL(link.href).pathname.split('/').at(-1)))
  assert.deepEqual(drawingLinks, illustrations)
  assert.equal(await page.locator('.pigments dt').count(), 4)
  await capture('field-guide-artwork')
  await page.setViewportSize({ width: 320, height: 720 })
  await checkWidth()
  await page.getByRole('link', { name: 'Loom home' }).click()
  await page.setViewportSize({ width: 1160, height: 760 })
  await page.getByRole('link', { name: 'Open wire model in the studio' }).click()
  await page.getByText('21 nodes · 41 links', { exact: true }).waitFor()
  assert.equal(await page.locator('#dataset').inputValue(), 'model')
  const graphData = await page.evaluate(async (url) => (await fetch(url)).json(), new URL('examples/wire-model.json', home).href)
  assert.ok(graphData.nodes.some((node) => node.label === picked))
  const ids = new Set(graphData.nodes.map((n) => n.id))
  assert.equal(ids.size, 21)
  assert.ok(graphData.nodes.every((node) => node.pinned === false))
  assert.ok(graphData.links.every((edge) => ids.has(edge.source) && ids.has(edge.target)))
  for (const [name, totals] of [['Optics notebook','8 nodes · 14 links'], ['Section lanes','45 nodes · 88 links'],
    ['Section clouds','45 nodes · 88 links'], ['Weighted connections','15 nodes · 30 links']]) {
    await page.getByRole('link', { name: 'Loom field guide' }).click()
    await page.getByRole('link', { name, exact: true }).click()
    await page.getByText(totals, { exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, studio.pathname)
    await page.locator('#graph[data-ready]').waitFor()
    if (name === 'Section lanes') {
      await page.locator('[data-lane="Optics"]').waitFor({ state: 'attached' })
      assert.equal(await page.locator('[data-lane]').count(), 4)
    }
    if (name === 'Weighted connections') {
      await page.getByRole('tab', { name: 'Style' }).click()
      assert.equal(await page.locator('#width-by').inputValue(), 'weight')
    }
  }
  const old = new URL('?example=drilldown&group=Optics&bubbles=off#settings-groups', home)
  await page.goto(old.href)
  await page.waitForURL(studio.href + old.search + old.hash)
  await page.getByText('8 nodes · 14 links', { exact: true }).waitFor()
  assert.equal(await page.getByRole('switch', { name: 'Show group bubbles' }).isChecked(), false)
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : getContext.call(this, type, ...args) }
  })
  await page.goto(home)
  await launch.click()
  await page.getByText('The live model requires WebGL2.', { exact: true }).waitFor()
  assert.equal(await canvas.count(), 0)
  assert.ok(await plate.locator('.plate-photo').isVisible())
  assert.deepEqual(errors, [])
  await page.close()
  return { illustrations, picked, wireModel: [21,41], examples: 4, legacyBookmark: true, webglFallback: true }
}
