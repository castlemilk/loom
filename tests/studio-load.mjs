import assert from 'node:assert/strict'

export async function studioLoad(page, url) {
  const errors = [], specimenRequests = new Set()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => {
    if (r.url().includes('/graphs/specimens/')) {
      if (r.status() >= 400) errors.push(r.status() + ' specimen response')
      specimenRequests.add(r.url())
    }
  })
  const byId = (id) => page.locator('#' + id)
  const metric = (label) => page.locator('#perf-panel dt').filter({ hasText: label }).locator('+ dd')
  const waitValue = async (label, value) => {
    await page.waitForFunction(([l, v]) => [...document.querySelectorAll('#perf-panel dt')].some((dt) => dt.textContent === l && dt.nextElementSibling.textContent === v), [label, value])
  }
  const create = () => page.getByRole('button', { name: 'Generate graph', exact: true }).click()
  await page.goto(url)
  await page.locator('#graph[data-ready]').waitFor()
  assert.equal(specimenRequests.size, 0, 'The gallery must remain lazy on the knowledge excerpt')
  await byId('dataset').selectOption('stress')
  await byId('workload-preset').selectOption('images')
  await byId('workload-nodes').fill('48')
  await byId('workload-variety').fill('4')
  await byId('workload-seed').fill('151')
  await byId('workload-text').selectOption('articles')
  await create()
  await page.getByText('48 nodes · 96 links', { exact: true }).waitFor()
  await byId('perf-toggle').click()
  await page.getByRole('heading', { name: 'Performance' }).waitFor()
  await waitValue('Atlas tiles', '4 / 4')
  const graph = byId('graph')
  await page.getByRole('button', { name: 'Cloud', exact: true }).click()
  await byId('cloud-rotate').uncheck()
  await byId('blend').focus(); await byId('blend').press('End')
  await graph.focus()
  for (let i = 0; i < 12; i++) { await graph.press('ArrowRight'); await page.waitForTimeout(22) }
  await page.waitForFunction(() => +document.getElementById('perf-fps').textContent > 0 && document.querySelectorAll('.frame-chart i').length >= 1)
  const gpu = await metric('GPU draw').textContent()
  assert.match(gpu, /ms|Awaiting sample|Unavailable|Interrupted/)
  await page.locator('#perf-panel[data-state="Idle"]').waitFor()
  assert.equal(await byId('perf-fps').textContent(), '0')
  await page.getByRole('button', { name: 'Close performance' }).click()
  assert.equal(await byId('perf-panel').count(), 0)
  assert.equal(await byId('perf-toggle').getAttribute('aria-pressed'), 'false')
  await byId('cloud-depth').focus(); await byId('cloud-depth').press('Home')
  assert.equal(await byId('cloud-depth-value').textContent(), '0%')
  await byId('cloud-depth').press('End')
  assert.equal(await byId('cloud-depth-value').textContent(), '300%')
  const hit = await graph.evaluate((el) => {
    const box = el.getBoundingClientRect()
    for (let y = 40; y < box.height - 65; y += 7) for (let x = 15; x < box.width - 15; x += 7) {
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: x + box.x, clientY: y + box.y }))
      if (el.hasAttribute('data-node')) return [x + box.x, y + box.y]
    }
  })
  assert.ok(hit, 'A projected Cloud node must be pickable')
  await page.mouse.click(...hit)
  await page.locator('.selection-content').waitFor()
  assert.match(await page.locator('.selection-content').textContent(), /catalogue/)
  await page.waitForFunction(() => document.querySelector('.selection-image')?.naturalWidth > 0)

  await byId('workload-nodes').fill('8')
  await page.getByRole('button', { name: 'Append batch' }).click()
  await page.getByText('56 nodes · 113 links', { exact: true }).waitFor()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const file = await downloadEvent, chunks = []
  for await (const chunk of await file.createReadStream()) chunks.push(chunk)
  const exported = JSON.parse(Buffer.concat(chunks))
  assert.equal(exported.nodes.length, new Set(exported.nodes.map((n) => n.id)).size)
  assert.ok(exported.nodes.every((n) => n.content && n.art))
  const upload = (data) => byId('workload-file').setInputFiles({ name: 'my-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await upload({ nodes: [{ id: 'a', kind: 'custom', label: 'My specimen', summary: 'A supplied note.' }], links: [] })
  await page.getByText('1 node · 0 links', { exact: true }).waitFor()
  await upload({ nodes: [], links: [{ source: 'bad', target: 'ref' }] })
  await page.getByText(/Every link needs existing/).waitFor()
  assert.equal(await byId('totals').textContent(), '1 node · 0 links')
  await page.setViewportSize({ width: 390, height: 844 })
  await byId('perf-toggle').click()
  await byId('perf-panel').waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await byId('workload-preset').selectOption('scale')
  await create()
  await page.getByText('25,000 nodes · 100,000 links', { exact: true }).waitFor()
  await graph.scrollIntoViewIfNeeded()
  await graph.press('ArrowRight')
  await page.waitForFunction(() => {
    const value = (name) => [...document.querySelectorAll('#perf-panel dt')].find((el) => el.textContent === name)?.nextElementSibling?.textContent
    const geometry = value('Positions + links')
    return geometry?.endsWith(' MiB') && parseFloat(geometry) > 1 && +value('Frames drawn') >= 2
  }, undefined, { timeout: 45000 })
  const draws = parseInt(await metric('Draws / labels').textContent())
  assert.ok(draws > 0 && draws <= 4, '25k-node cloud should fit within four draw calls')
  assert.equal(await graph.evaluate((el) => el.getContext('webgl2').getError()), 0)
  assert.deepEqual(errors, [])
  return { loadedTiles: 4, exportedNodes: exported.nodes.length, payloadCharacters: exported.nodes[0].content.length,
    scale: { nodes: 25000, links: 100000, draws }, gpu }
}
