import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chooseGraph } from './graph-picker.mjs'
import { serveExport } from '../scripts/serve-export.mjs'

const run = promisify(execFile)
const json = async path => JSON.parse(await readFile(path, 'utf8'))

async function download(page, button) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()])
  return file
}

// Run the downloaded project outside the repository, including its real production build.
async function tryProject(context, file, live, scene, name, language, expectedCode) {
  const dir = await mkdtemp(join(tmpdir(), 'loom-starter-'))
  const page = await context.newPage()
  let server
  try {
    await run('unzip', ['-q', await file.path(), '-d', dir])
    const manifest = await json(join(dir, 'package.json'))
    assert.match(manifest.dependencies['loom-core'], /^https:\/\/castlemilk\.github\.io\/loom\/(?:packages\/[a-f\d]{40}\/)?loom-core-[\d.]+\.tgz$/)
    if (process.env.GITHUB_SHA) assert.ok(manifest.dependencies['loom-core'].includes('/packages/' + process.env.GITHUB_SHA + '/'))
    assert.deepEqual(await json(join(dir, 'scene.json')), scene)
    assert.equal((await readFile(join(dir, 'graph.' + language), 'utf8')).trimEnd(), expectedCode)
    // Before deployment the new SDK exists in the local Pages export. After deployment install the URL from the ZIP.
    const archive = new URL(manifest.dependencies['loom-core']).pathname.split('/').pop()
    const source = live ? [] : [fileURLToPath(new URL('../web/out/' + archive, import.meta.url))]
    await run('npm', ['install', '--no-audit', '--no-fund', ...source], { cwd: dir, timeout: 90000 })
    await run('npm', ['run', 'build'], { cwd: dir, timeout: 40000 })
    server = await serveExport('/embed/', 0, join(dir, 'dist'))
    await page.goto(server.url)
    await page.getByRole('heading', { name, exact: true }).waitFor()
    await page.locator('button:enabled').waitFor()
    const canvas = page.locator('canvas'), box = await canvas.boundingBox()
    const patch = await page.screenshot({ clip: { x: box.x + 6, y: box.y + 6, width: 16, height: 16 } })
    const matches = await page.evaluate(async ({ png, bg }) => {
      const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob())
      const tile = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')
      tile.drawImage(bitmap, 0, 0)
      const { data } = tile.getImageData(0, 0, bitmap.width, bitmap.height)
      bitmap.close()
      const rgb = bg.match(/[\da-f]{2}/gi).map(hex => parseInt(hex, 16))
      return data.some((_, i) => i % 4 === 0 && rgb.every((channel, c) => Math.abs(data[i + c] - channel) < 3))
    }, { png: patch.toString('base64'), bg: scene.theme.bg })
    assert.ok(matches, 'The exported canvas paints the saved theme')
    const { x, y, zoom } = scene.viewport
    const target = scene.positions.receiver
    await canvas.click({ position: { x: box.width / 2 + (target.x - x) * zoom, y: box.height / 2 + (target.y - y) * zoom } })
    await page.getByRole('status').getByText('receiver', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Fit view' }).click()
  } finally {
    await page.close()
    await server?.close()
    await rm(dir, { recursive: true, force: true })
  }
}

export async function studioExport(context, url, { touch = false, live = false } = {}) {
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const button = (name, root = page) => root.getByRole('button', { name, exact: true })
  const press = locator => touch ? locator.tap() : locator.click()
  const dialog = page.getByRole('dialog')
  const form = page.locator('#document-composer')
  const canvas = page.locator('#graph')
  const name = 'Studio signal path'
  try {
    await page.goto(url + '?example=blank')
    await button('Add your first node').waitFor()
    await press(button('New graph'))
    await dialog.getByLabel('Graph name').fill(name)
    await press(button('Create graph', dialog))
    await page.getByRole('heading', { name, exact: true }).waitFor()
    for (const [i, label] of ['Emitter', 'Receiver'].entries()) {
      await press(button(i === 0 ? 'Add your first node' : 'Add node'))
      await form.getByLabel('Name').fill(label)
      const box = await canvas.boundingBox()
      await canvas.click({ position: { x: box.width * (i ? .7 : .3), y: box.height * .55 } })
      await form.getByText(/Pinned at/).waitFor()
      await press(button('Create node', form))
      await page.locator('#selection').getByText(label, { exact: true }).waitFor()
    }
    await press(button('Connect nodes'))
    await form.getByLabel('From', { exact: true }).fill('emitter')
    await form.getByLabel('To', { exact: true }).fill('receiver')
    await form.getByLabel('Relationship').fill('feeds')
    await press(button('Create connection', form))
    await page.locator('#totals').getByText('2 nodes · 1 link', { exact: true }).waitFor()
    await press(page.getByRole('tab', { name: 'Style' }))
    await page.getByText('Cross-hatch', { exact: true }).click()
    await press(button('Export graph'))
    assert.equal(await dialog.getByLabel('Project name').inputValue(), name)
    const shots = new URL('../artifacts/studio/', import.meta.url)
    await mkdir(shots, { recursive: true })
    await page.screenshot({ path: fileURLToPath(new URL(touch ? 'export-mobile.png' : 'export-desktop.png', shots)) })
    assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= innerWidth))
    await press(button('Existing app', dialog))
    const language = touch ? 'js' : 'ts'
    await dialog.getByLabel('Language').selectOption(language)
    const code = await dialog.locator('.export-code pre code').last().textContent()
    if (!touch) {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
      await press(button('Copy graph.ts', dialog))
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code)
      assert.equal(code, (await readFile(new URL('../docs/examples/mount-export.ts', import.meta.url), 'utf8')).trimEnd())
    }
    const scene = await json(await (await download(page, button('Download scene.json', dialog))).path())
    assert.equal(scene.data.title, name)
    assert.deepEqual(scene.data.nodes.map(node => node.label), ['Emitter', 'Receiver'])
    assert.deepEqual(scene.data.links.map(edge => [edge.source, edge.target, edge.kind]), [['emitter', 'receiver', 'feeds']])
    assert.equal(scene.drawingStyle.fill, 'cross-hatch')
    assert.ok(scene.viewport.zoom > 0 && scene.positions.receiver.pinned && scene.positions.emitter.pinned)
    const keep = dialog.getByLabel('Keep positions and camera')
    await keep.uncheck()
    const fresh = await json(await (await download(page, button('Download scene.json', dialog))).path())
    assert.equal(fresh.positions, undefined)
    assert.equal(fresh.viewport, undefined)
    assert.deepEqual(fresh.data, scene.data)
    await keep.check()
    await press(button('Starter project', dialog))
    const projectName = 'Signal <lab> & sound'
    await dialog.getByLabel('Project name').fill(projectName)
    const zip = await download(page, button('Download project ZIP', dialog))
    assert.equal(zip.suggestedFilename(), 'signal-lab-sound.zip')
    await tryProject(context, zip, live, scene, projectName, language, code)
    await page.keyboard.press('Escape')
    assert.equal(await button('Export graph').evaluate(el => el === document.activeElement), true)
    if (touch) assert.ok(await button('Select and move').getByText('Select', { exact: true }).isVisible())
    if (!touch) {
      const size = page.viewportSize()
      await page.bringToFront()
      for (const width of [320, 768, 1091, 1360, 1500]) {
        await page.setViewportSize({ ...size, width })
        await page.waitForFunction(width => innerWidth === width, width)
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())))
        const dock = await page.locator('.editor-dock').boundingBox(), sizing = await page.locator('.node-sizing').boundingBox()
        const picker = await page.locator('#dataset-choice').boundingBox()
        assert.ok(picker.width >= 120 && picker.x + picker.width <= width + 1, JSON.stringify({ width, picker }))
        assert.ok(dock.y + dock.height <= sizing.y || dock.x + dock.width <= sizing.x, JSON.stringify({ width, dock, sizing }))
        const clipped = await page.locator('.editor-dock button').evaluateAll(buttons => buttons.flatMap(el => {
          const box = el.getBoundingClientRect()
          const outside = Array.from(el.children, child => child.getBoundingClientRect()).some(child =>
            child.width > 0 && (child.left < box.left - 1 || child.right > box.right + 1))
          return outside ? [el.getAttribute('aria-label')] : []
        }))
        assert.deepEqual(clipped, [], 'Toolbar content at ' + width + 'px')
      }
      await page.setViewportSize(size)
      await page.goto(url + '?example=drilldown&group=Optics&bubbles=off')
      await page.locator('#totals').getByText('8 nodes · 14 links', { exact: true }).waitFor()
      await press(button('Export graph'))
      await press(button('Existing app', dialog))
      const group = await json(await (await download(page, button('Download scene.json', dialog))).path())
      const fullFile = await download(page, dialog.getByRole('button', { name: /Download full graph data/ }))
      const original = await json(await fullFile.path())
      assert.deepEqual([group.data.nodes.length, group.data.links.length, original.nodes.length, original.links.length], [8,14,45,88])
      assert.equal(group.mode, 'orbit')
      await page.keyboard.press('Escape')
      await page.locator('#workload-file').setInputFiles({ name: 'full-graph.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) })
      await page.locator('#totals').getByText('45 nodes · 88 links', { exact: true }).waitFor()
      await chooseGraph(page, 'count-1000')
      await press(button('Export graph'))
      const large = await download(page, button('Download project ZIP', dialog))
      const { stdout } = await run('unzip', ['-p', await large.path(), 'scene.json'], { maxBuffer: 8 * 1024 * 1024 })
      const many = JSON.parse(stdout)
      assert.deepEqual([many.data.nodes.length, many.data.links.length], [1000, 4000])
      assert.ok(many.artwork.urls.length > 0 && many.artwork.urls.length < Object.keys(many.artwork.byNode).length)
      assert.ok(many.artwork.urls.every(url => new URL(url).protocol.startsWith('http')))
    }
    assert.deepEqual(errors, [])
    return (touch ? 'JavaScript mobile' : 'TypeScript desktop') + ' project built, rendered and selected its saved node'
  } finally { await page.close() }
}
