import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const snapshot = JSON.parse(await readFile(new URL('../demo/knowledge.json', import.meta.url), 'utf8'))
const ids = new Set(snapshot.sample)
const adjacency = new Map([...ids].map((id) => [id, []]))
for (const { source, target } of snapshot.edges) {
  if (ids.has(source) && ids.has(target)) {
    adjacency.get(source).push(target)
    adjacency.get(target).push(source)
  }
}
const hub = [...ids].sort().reduce((best, id) => adjacency.get(id).length > adjacency.get(best).length ? id : best)

export async function studioConfiguration(page, url) {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const control = (id) => page.locator('#' + id)
  const paint = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
  async function open(label) {
    const summary = page.locator('summary').filter({ hasText: label })
    if (!await summary.evaluate((el) => el.parentElement.open)) await summary.click()
  }
  async function apply(rule) {
    await open('Define a taxonomy')
    await control('taxonomy-json').fill(JSON.stringify(rule))
    await page.getByRole('button', { name: 'Apply definition' }).click()
    assert.equal(await control('taxonomy').inputValue(), rule.id)
  }
  const bubble = (id) => page.locator('path[data-bubble="' + id + '"]')
  const toggle = (id) => page.locator('input[data-bubble-term="' + id + '"]')
  async function centre(locator) {
    const box = await locator.boundingBox()
    assert.ok(box)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  await page.setViewportSize({ width: 1160, height: 760 })
  await page.goto(url)
  await page.locator('#graph[data-ready]').waitFor()
  const splitter = page.getByRole('separator')
  const initial = (await control('graph').boundingBox()).width
  const grip = await centre(splitter)
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x - 130, grip.y, { steps: 6 })
  await page.mouse.up()
  const narrow = (await control('graph').boundingBox()).width
  assert.ok(Math.abs(initial - narrow - 130) < 2, 'Dragging the desktop splitter should resize the canvas')
  await splitter.press('ArrowRight')
  assert.equal((await control('graph').boundingBox()).width, narrow + 16)
  await splitter.press('Enter')
  assert.equal((await control('graph').boundingBox()).width, initial)

  await open('Group bubbles')
  await toggle('lab').check()
  await bubble('lab').waitFor({ state: 'attached' })
  await control('taxonomy').selectOption('category')
  await toggle('category:cat-physics').check()
  assert.ok((await bubble('category:cat-physics').getAttribute('d')).endsWith('Z'))
  assert.equal(await bubble('lab').count(), 1)
  await toggle('category:cat-physics').uncheck()
  assert.equal(await bubble('category:cat-physics').count(), 0)
  assert.equal(await bubble('lab').count(), 1)

  const mapping = { id: 'family', label: 'Content family', by: 'kind', remap: { lab: 'bench' },
    terms: { bench: { label: 'Research laboratory', description: 'Interactive work', color: '#70ae96' } } }
  await apply(mapping)
  await control('legend').getByText('Research laboratory').waitFor()
  await open('Define a taxonomy')
  await control('taxonomy-json').fill('{"id":"broken"}')
  await page.getByRole('button', { name: 'Apply definition' }).click()
  await page.getByText('Provide an id and a display label.').waitFor()
  assert.equal(await control('taxonomy').inputValue(), 'family')
  await open('Display language')
  await page.getByLabel('One connection').fill('reference')
  await page.getByLabel('Many connections').fill('references')
  await page.getByLabel('Unassigned lane').fill('Unclassified')
  await page.getByRole('button', { name: 'Apply language' }).click()

  // A public field taxonomy gives one bubble per node. Its centre is the actual
  // projected marker, so the geometry assertions exercise the live WebGL canvas.
  await apply({ id: 'identity', label: 'Node IDs', by: 'id' })
  await control('all-bubbles').check()
  await control('taxonomy').selectOption('family')
  await control('blend').focus()
  await control('blend').press('End')
  await page.getByRole('button', { name: 'Lanes', exact: true }).click()
  const lane = page.locator('[data-lane="bench"]')
  await lane.getByText('Research laboratory').waitFor()
  await page.locator('[data-lane=""]').getByText('Unclassified').waitFor()
  const lab = 'lab:polarisation'
  for (const [direction, axis] of [['horizontal', 'x'], ['vertical', 'y']]) {
    await control('direction').selectOption(direction)
    await paint()
    const member = await centre(bubble(lab)), caption = await centre(lane)
    assert.ok(Math.abs(member[axis] - caption[axis]) < 2, direction + ' lane caption must align with its member')
  }
  await splitter.press('ArrowLeft')
  await paint()
  const location = await centre(bubble(lab))
  await page.mouse.move(location.x, location.y)
  const tooltip = page.getByRole('tooltip')
  await tooltip.getByText('Polarisation', { exact: true }).waitFor()
  assert.match(await tooltip.textContent(), /Research laboratory \(Interactive work\)/)
  assert.match(await tooltip.textContent(), /references?/)
  const tooltipBox = await tooltip.boundingBox(), graphBox = await control('graph').boundingBox()
  assert.ok(tooltipBox.x >= graphBox.x && tooltipBox.x + tooltipBox.width <= graphBox.x + graphBox.width + 1)
  await page.keyboard.press('Escape')
  await tooltip.waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: 'Orbit', exact: true }).click()
  await page.locator('[data-lane]').first().waitFor({ state: 'detached' })
  async function checkRings(id) {
    await paint()
    const points = await page.locator('path[data-taxonomy="identity"]').evaluateAll((paths) => Object.fromEntries(paths.map((p) => {
      const b = p.getBBox()
      return [p.dataset.bubble, [b.x + b.width / 2, b.y + b.height / 2]]
    })))
    const first = new Set(adjacency.get(id)), second = new Set([...first].flatMap((neighbour) => adjacency.get(neighbour)))
    const [x, y] = points[id]
    const step = Math.hypot(points[[...first][0]][0] - x, points[[...first][0]][1] - y)
    assert.ok(step > 4)
    for (const [key, [px, py]] of Object.entries(points)) {
      const hops = key === id ? 0 : first.has(key) ? 1 : second.has(key) ? 2 : 3
      assert.ok(Math.abs(Math.hypot(px - x, py - y) - hops * step) < 2, 'Incorrect orbit radius for ' + key + ' around ' + id)
    }
    return step
  }
  const defaultRadius = await checkRings(hub)
  const newCentre = await centre(bubble(lab))
  await page.mouse.click(newCentre.x, newCentre.y)
  await control('selection').getByText('Polarisation', { exact: true }).waitFor()
  await control('fit').click()
  const selectedRadius = await checkRings(lab)

  await page.reload()
  await page.locator('#taxonomy option[value="family"]').waitFor({ state: 'attached' })
  await control('taxonomy').selectOption('family')
  await control('legend').getByText('Research laboratory').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('separator', { name: 'Graph height' }).waitFor()
  const height = (await control('graph').boundingBox()).height
  await splitter.press('ArrowUp')
  assert.equal((await control('graph').boundingBox()).height, height - 16)
  await splitter.press('Home')
  assert.equal((await control('graph').boundingBox()).height, Number(await splitter.getAttribute('aria-valuemin')))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.deepEqual(errors, [])
  return { desktopWidth: [initial, narrow], mobileHeight: height, defaultOrbit: hub, defaultRadius, selectedRadius }
}
