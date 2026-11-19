import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function studioAuthoring(context, url, touch = false) {
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const form = page.locator('#document-composer')
  const button = (name) => page.getByRole('button', { name, exact: true })
  const pick = (locator) => touch ? locator.tap() : locator.click()
  const totals = (nodes, links) => page.locator('#totals').getByText(nodes + ' nodes · ' + links + ' links', { exact: true }).waitFor()
  async function disclose(name) {
    const summary = page.locator('.inspector-section > summary').filter({ hasText: name })
    if (!await summary.evaluate((e) => e.parentElement.open)) await pick(summary)
  }
  await page.goto(url)
  await page.locator('#graph[data-ready]').waitFor()
  await totals(25, 30)
  assert.equal(await button('Undo document edit').isDisabled(), true)
  if (touch) await pick(button('Add node'))
  else { await page.locator('#graph').focus(); await page.keyboard.press('n') }
  await form.getByLabel('Name').fill('Signal lens')
  if (!touch) {
    const canvas = page.locator('#graph'), box = await canvas.boundingBox()
    await canvas.click({ position: { x: Math.floor(box.width - 12), y: Math.floor(box.height * .62) } })
    await form.getByText(/Pinned at /).waitFor()
  }
  await pick(form.getByRole('button', { name: 'Create node' }))
  await totals(26, 30)
  const draft = await page.locator('#dataset').inputValue()
  assert.match(draft, /^draft-/)
  await page.locator('#selection').getByText('Signal lens', { exact: true }).waitFor()
  assert.equal(await page.locator('details.selected-object').getAttribute('open'), '')
  const file = page.locator('#dataset')
  await file.selectOption('sample')
  await totals(25, 30)
  await file.selectOption(draft)
  await totals(26, 30)
  await pick(button('JSON commands'))
  const json = form.getByLabel('Transaction')
  const tx = JSON.parse(await json.inputValue())
  assert.equal(tx.expectedRevision, 1)
  const schema = await form.getByRole('link', {name:/JSON Schema/}).evaluate(async (link) => (await fetch(link.href)).json())
  assert.equal(schema.properties.operations.items.oneOf.length, 6)
  const apply = form.getByRole('button', { name:'Apply changes' })
  await json.fill(JSON.stringify({ ...tx, expectedRevision:0 }))
  await pick(form.getByRole('button', { name:'Preview' }))
  await form.getByText(/Read revision 1/).waitFor()
  assert.equal(await apply.isDisabled(), true)
  await json.fill(JSON.stringify({ ...tx, operations:[{op:'node.add', value:{id:'receiver',label:'Receiver',section:'Signals'}}] }))
  await pick(form.getByRole('button', { name:'Preview' }))
  await totals(26, 30)
  await pick(apply)
  await form.getByText('Applied at revision 2', {exact:true}).waitFor()
  await totals(27, 30)
  await json.press('Escape')
  assert.equal(await button('JSON commands').evaluate((el) => el === document.activeElement), true)
  await pick(button('Connect nodes'))
  await form.getByLabel('From', {exact:true}).fill('signal-lens')
  if (!touch) {
    const graph = page.locator('#graph')
    const point = await graph.evaluate((canvas) => {
      const box = canvas.getBoundingClientRect()
      for (let y = box.height * .2; y < box.height * .8; y += 6) {
        for (let x = box.width * .15; x < box.width * .85; x += 6) {
          const clientX = box.x + x, clientY = box.y + y
          if (document.elementFromPoint(clientX, clientY) !== canvas) continue
          canvas.dispatchEvent(new PointerEvent('pointermove', {clientX,clientY}))
          if (canvas.hasAttribute('data-node')) return { x, y }
        }
      }
    })
    assert.ok(point, 'The canvas exposes a selectable endpoint')
    await graph.click({position:point})
    await page.waitForFunction(() => document.getElementById('endpoint-To')?.value)
  }
  await form.getByLabel('To', {exact:true}).fill('receiver')
  await form.getByLabel('Relationship').fill('feeds')
  await form.getByLabel('Weight').fill('4')
  await pick(form.getByRole('button', {name:'Create connection'}))
  await totals(27, 31)
  await page.locator('#selection').getByText('Signal lens', {exact:true}).waitFor()
  await disclose('Connections')
  await pick(page.locator('.incident-list button').filter({hasText:'feeds'}))
  assert.equal(await form.getByLabel('Weight').inputValue(), '4')
  await form.getByLabel('Weight').fill('')
  await form.getByLabel('Relationship').fill('reads')
  const shots = new URL('../artifacts/studio/', import.meta.url)
  await mkdir(shots, {recursive:true})
  if (touch) await form.scrollIntoViewIfNeeded()
  await page.screenshot({path:fileURLToPath(new URL(touch ? 'authoring-mobile.png' : 'authoring-desktop.png', shots)), animations:'disabled'})
  await pick(form.getByRole('button', {name:'Save connection'}))
  await pick(button('JSON commands'))
  const download = page.waitForEvent('download')
  await pick(form.getByRole('button', {name:'Download graph'}))
  const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  const edge = exported.links.find((e) => e.kind === 'reads')
  assert.deepEqual([edge.source,edge.target,edge.weight], ['signal-lens','receiver',undefined])
  assert.ok(exported.links.every((e) => e.id))
  if (!touch) assert.equal(exported.nodes.find((n) => n.id === 'signal-lens').pinned, true)
  await pick(button('Close document editor'))
  await pick(button('Undo document edit'))
  await pick(button('Undo document edit'))
  await totals(27, 30)
  await pick(button('Redo document edit'))
  await totals(27, 31)
  await pick(page.getByRole('tab', {name:'Groups'}))
  await page.locator('#taxonomy').selectOption('section')
  const bubbles = page.locator('summary').filter({hasText:'Group bubbles'})
  assert.equal(await bubbles.evaluate((e) => e.parentElement.open), true)
  await pick(bubbles)
  assert.equal(await bubbles.evaluate((e) => e.parentElement.open), false)
  await page.locator('#taxonomy').selectOption('kind')
  assert.equal(await bubbles.evaluate((e) => e.parentElement.open), true)
  const width = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + .5)
      .slice(0,8).map((el) => [el.id || el.tagName, Math.round(el.getBoundingClientRect().right), innerWidth])
    return { actual: document.documentElement.scrollWidth, viewport: innerWidth, elements }
  })
  assert.ok(width.actual <= width.viewport, JSON.stringify(width))
  assert.deepEqual(errors, [])
  await page.close()
  return { input:touch ? 'touch' : 'keyboard and pointer', nodes:27, links:31, revisions:7 }
}
