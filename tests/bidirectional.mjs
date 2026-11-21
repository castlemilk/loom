import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { drag } from './studio-topic-layout.mjs'
import { serveExport } from '../scripts/serve-export.mjs'
import { archiveName } from '../scripts/npm-registry.mjs'

const exec = promisify(execFile)
const graphFrom = source => {
  const { outputText } = ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } })
  return JSON.parse(runInNewContext(outputText + '\nJSON.stringify(exports.graph)', { exports:{} }, { timeout:1000, contextCodeGeneration:{ strings:false, wasm:false } }))
}
const node = (data, id) => data.nodes.find(n => n.id === id)
async function download(page, button) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()])
  return file.path()
}
async function buildExport(context, file, source, studio, live) {
  const dir = await mkdtemp(join(tmpdir(), 'loom-two-way-')), page = await context.newPage()
  let server
  try {
    await exec('unzip', ['-q', file, '-d', dir])
    assert.equal(await readFile(join(dir, studio ? 'data.ts' : 'notebook.ts'), 'utf8'), source)
    const pkg = JSON.parse(await readFile(join(dir,'package.json'), 'utf8'))
    const archive = !live && pkg.dependencies['loom-core'].startsWith('https:') ? [fileURLToPath(new URL('../web/out/' + archiveName, import.meta.url))] : []
    await exec('npm', ['install','--no-audit','--no-fund', ...archive], {cwd:dir, timeout:90000})
    await exec('npm', ['run','build'], {cwd:dir, timeout:50000})
    server = await serveExport('/embed/', 0, join(dir,'dist'))
    await page.goto(server.url)
    if (studio) {
      const scene = JSON.parse(await readFile(join(dir,'scene.json'), 'utf8'))
      const titan = node(graphFrom(source), 'titan')
      assert.equal(node(scene.data, 'titan').x, titan.x)
      assert.equal(node(scene.data, 'titan').metadata.Atmosphere, 'Studio haze')
      assert.ok(scene.data.links.some(l => l.source === 'titan' && l.target === 'relay'))
      await page.getByRole('button', { name:'Fit view' }).and(page.locator(':enabled')).waitFor()
      const canvas = page.locator('canvas'), box = await canvas.boundingBox(), pos = scene.positions.titan
      const { x, y, zoom } = scene.viewport
      // The scene can reopen with Titan already selected. Exercise a fresh pointer selection.
      await canvas.press('Escape')
      await canvas.click({position:{ x:box.width/2 + (pos.x-x)*zoom, y:box.height/2 + (pos.y-y)*zoom }})
      await page.getByRole('status').getByText('titan', {exact:true}).waitFor()
    } else {
      await page.getByRole('button', {name:'Titan · Moon'}).press('Space')
      await page.getByRole('heading', {name:'Titan',exact:true}).waitFor()
      assert.match(await page.locator('pre').textContent(), /Amber cloud/)
      await page.locator('figure img').evaluate(img => img.decode())
      const titan = node(graphFrom(source), 'titan')
      assert.equal(await page.locator('[data-card-id=titan]').getAttribute('transform'), 'translate('+titan.x+' '+titan.y+')')
      assert.ok(await page.getByRole('button', {name:'Huygens · Probe'}).isVisible())
    }
  } finally { await page.close(); server?.close(); await rm(dir, {recursive:true, force:true}) }
}

export async function twoWayJourney(context, home, { touch = false, live = false, install = false } = {}) {
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(18000)
  const pick = el => touch ? el.tap() : el.click()
  const button = (name, root = page) => root.getByRole('button', {name,exact:true})
  const changed = async (id, oldText) => {
    await page.waitForFunction(([id,old]) => document.getElementById(id)?.value !== old, [id,oldText])
    return page.locator('#'+id).inputValue()
  }
  try {
    await page.goto(home + '#node-playground')
    const book = page.locator('.notebook-bench'), titan = book.locator('[data-card-id=titan]'), edit = page.locator('#notebook-source')
    await titan.waitFor()
    await pick(button('Cassini flybys',book)); await pick(titan)
    await pick(button('Edit metadata',book))
    const computedForm = page.getByRole('form',{name:'Edit metadata'})
    const flybySource = await edit.inputValue()
    await computedForm.getByLabel('Value for Targeted flybys').fill('128')
    await pick(button('Save metadata',computedForm))
    const computed = await changed('notebook-source',flybySource)
    assert.match(computed,/moons\.map\(/)
    assert.match(graphFrom(computed).links[0].note,/128 targeted flybys/)
    await pick(button('Saturn system',book))
    const initial = await edit.inputValue(), svg = book.locator('svg[aria-label="Orbital relationship graph"]')
    const camera = await svg.getAttribute('viewBox')
    await titan.scrollIntoViewIfNeeded()
    const box = await titan.boundingBox()
    await drag(page, touch, [box.x + box.width/2,box.y + box.height/2],[29,-15])
    const moved = await changed('notebook-source',initial), coords = node(graphFrom(moved),'titan')
    assert.notEqual(coords.x, -143)
    assert.equal(await titan.getAttribute('transform'), 'translate('+coords.x+' '+coords.y+')')
    assert.equal(await svg.getAttribute('viewBox'),camera)
    await pick(button('Edit metadata',book))
    let form = page.getByRole('form',{name:'Edit metadata'})
    await form.getByLabel('Value for Atmosphere',{exact:true}).fill('Amber cloud')
    await pick(button('Save metadata',form))
    const fields = await changed('notebook-source',moved)
    assert.equal(node(graphFrom(fields),'titan').metadata.Atmosphere,'Amber cloud')
    const imageKey=book.getByRole('combobox',{name:'Node image reference'})
    await imageKey.selectOption('ice')
    const illustrated=await changed('notebook-source',fields)
    assert.equal(node(graphFrom(illustrated),'titan').art,'ice')
    await book.locator('.notebook-photo img').evaluate(img=>img.decode())
    await pick(button('Connect',book))
    form = page.getByRole('form',{name:'Connect a node'})
    assert.equal(await form.getByRole('combobox',{name:'From',exact:true}).inputValue(),'titan')
    await form.getByLabel('Node name').fill('Huygens')
    await form.getByLabel('Node kind').fill('Probe')
    await form.getByLabel('Relationship',{exact:true}).fill('hosted')
    await form.getByLabel('Connection note').fill('Huygens landed on Titan.')
    await pick(button('Create connection',form))
    const linked = await changed('notebook-source',illustrated)
    const data = graphFrom(linked)
    assert.ok(data.links.some(l=>l.source==='titan' && l.target==='huygens' && l.note==='Huygens landed on Titan.'))
    await book.locator('[data-card-id=huygens]').waitFor()
    if (install) await buildExport(context, await download(page,button('Download project',book)), linked, false, live)
    await pick(book.getByRole('link',{name:'Continue in Studio'}))
    const source = page.getByRole('textbox',{name:'Edit Studio TypeScript'})
    await source.waitFor()
    assert.equal(await source.inputValue(),linked)
    await page.locator('#selection').getByText('Huygens',{exact:true}).waitFor()
    const search = page.locator('#find-node')
    await search.fill('Titan'); await pick(page.locator('[data-result=titan]'))
    await pick(button('Edit metadata'))
    form = page.getByRole('form',{name:'Edit metadata'})
    await form.getByLabel('Value for Atmosphere',{exact:true}).fill('Studio haze')
    await pick(button('Save metadata',form))
    const studioMeta = await changed('studio-source',linked)
    assert.equal(node(graphFrom(studioMeta),'titan').metadata.Atmosphere,'Studio haze')
    await page.waitForFunction(() => document.getElementById('studio-source').scrollTop > 0)
    await pick(button('Add node'))
    const composer = page.locator('#document-composer')
    await composer.getByLabel('Name',{exact:true}).fill('Relay')
    await pick(button('Create node',composer))
    const plus = await changed('studio-source',studioMeta)
    await pick(button('Connect nodes'))
    await composer.getByLabel('From',{exact:true}).fill('titan')
    await composer.getByLabel('To',{exact:true}).fill('relay')
    await composer.getByLabel('Relationship',{exact:true}).fill('signals')
    await pick(button('Create connection',composer))
    const edge = await changed('studio-source',plus)
    assert.ok(graphFrom(edge).links.some(l=>l.source==='titan' && l.target==='relay'))
    await pick(button('Undo document edit'))
    assert.equal(await source.inputValue(),plus)
    await pick(button('Redo document edit'))
    assert.equal(await source.inputValue(),edge)
    const syntax = edge.replace(/label:\s*['"]Titan['"]/, 'label: 5')
    await source.fill(syntax)
    await page.locator('#studio-source-status').getByText(/number.*string/).waitFor()
    assert.ok(await button('Export graph').isDisabled())
    await pick(button('Revert text'))
    assert.equal(await source.inputValue(),edge)
    await search.fill('Titan'); await pick(page.locator('[data-result=titan]'))
    await page.locator('#selection').getByText('Titan',{exact:true}).waitFor()
    await pick(button('Focus node'))
    const canvas = page.locator('#graph'); await canvas.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const c = await canvas.boundingBox()
    await drag(page,touch,[c.x+c.width/2,c.y+c.height/2],[21,12])
    const dropped = await changed('studio-source',edge)
    assert.notEqual(node(graphFrom(dropped),'titan').x,coords.x)
    assert.equal(node(graphFrom(dropped),'titan').pinned,true)
    const renamed = dropped.replace(/label:\s*['"]Titan['"]/, "label: 'Titan edited'")
    await source.fill(renamed)
    await page.locator('#selection').getByText('Titan edited',{exact:true}).waitFor()
    await pick(button('Export graph'))
    const dialog = page.getByRole('dialog')
    const tsFile = await download(page, button('Download data.ts',dialog))
    assert.equal(await readFile(tsFile,'utf8'),renamed)
    if (install) await buildExport(context, await download(page,button('Download project ZIP',dialog)),renamed,true,live)
    await page.goto(new URL('studio/?example=blank',home).href)
    await button('Add your first node').waitFor()
    await pick(button('Live TypeScript'))
    const blank = await source.inputValue()
    const own = [
      "// A graph from my own application",
      "const label = 'Observation'",
      "export const graph = { title: 'My sky', nodes: [{ id: 'star', label, metadata: { magnitude: 4 } }], links: [] }",
      "graph.nodes[0].metadata.magnitude = 6",
    ].join('\n')
    await source.fill(own)
    await page.locator('#totals').getByText('1 node · 0 links',{exact:true}).waitFor()
    await search.fill('Observation'); await pick(page.locator('[data-result=star]'))
    await pick(button('Edit metadata'))
    const ownForm = page.getByRole('form',{name:'Edit metadata'})
    await ownForm.getByLabel('Value for magnitude').fill('12')
    await pick(button('Save metadata',ownForm))
    const corrected = await changed('studio-source',own)
    assert.equal(node(graphFrom(corrected),'star').metadata.magnitude,12)
    assert.match(corrected,/metadata.magnitude = 6/)
    await pick(button('Add node'))
    await composer.getByLabel('Name',{exact:true}).fill('Spectrometer')
    await pick(button('Create node',composer))
    const ownEdits = await changed('studio-source',corrected)
    assert.match(ownEdits,/const label = 'Observation'/)
    assert.equal(node(graphFrom(ownEdits),'spectrometer').label,'Spectrometer')
    await pick(button('Undo document edit'))
    assert.equal(await source.inputValue(),corrected)
    await pick(button('Undo document edit'))
    assert.equal(await source.inputValue(),own)
    await pick(button('Undo document edit'))
    assert.equal(await source.inputValue(),blank)
    assert.deepEqual(errors,[])
    return { device:touch?'touch':'desktop', demoToStudio:true, builtProjects:install?2:0 }
  } catch (error) {
    error.message += '\n' + (await page.locator('.notebook-form, .studio-source, .document-status').allTextContents()).join('\n').slice(-1000)
    throw error
  } finally { await page.close() }
}
