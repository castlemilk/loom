import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Count copper thread inside the rim. Changing the skip changes these pixels
// while keeping the number of pins, number of links and thread color identical.
async function innerThreads(page, surface) {
  const image = (await surface.screenshot()).toString('base64')
  return page.evaluate(async encoded => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + encoded
    await img.decode()
    const canvas = document.createElement('canvas')
    const { width, height } = img
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, width, height)
    const scale = Math.min(width, height)
    let count = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const r = Math.hypot(x - width / 2, y - height / 2) / scale
      if (r < 0.24 || r > 0.35) continue
      const i = (y * width + x) * 4
      if (data[i] - data[i + 1] > 43 && data[i] - data[i + 2] > 65) count++
    }
    return count
  }, image)
}

export async function liveCodeJourney(context, home, { touch = false, paper = false } = {}) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  if (paper) await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : getContext.call(this, type, ...args)
    }
  })
  const activate = locator => touch ? locator.tap() : locator.press('Enter')
  try {
    await page.goto(home)
    await activate(page.getByRole('link', { name: 'Try live code' }))
    await page.waitForURL(new URL('#live-code', home).href)
    const bench = page.locator('#live-code')
    const plot = bench.locator('.thread-surface')
    const editor = bench.getByRole('textbox', { name: 'Edit pattern JavaScript' })
    const status = bench.getByRole('status')
    await bench.locator(`.thread-plot[data-renderer="${paper ? 'paper' : 'loom'}"]`).waitFor()
    await bench.getByText('36 pins · 36 links', { exact: true }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    const start = await editor.inputValue()
    assert.match(start, /ring\(36\)/)
    if (!paper) {
      const shots = new URL('../artifacts/studio/', import.meta.url)
      await mkdir(shots, { recursive: true })
      await bench.locator('.guide-width').screenshot({ path: fileURLToPath(new URL('live-code-' + (touch ? 'mobile' : 'desktop') + '.png', shots)) })
    }

    const before = await innerThreads(page, plot)
    // Replace the number using the actual keyboard in the editable snippet.
    await activate(bench.getByRole('button', { name: 'Select the skip value in the code' }))
    assert.deepEqual(await editor.evaluate(el => [el === document.activeElement, el.value.slice(el.selectionStart, el.selectionEnd)]), [true, '13'])
    await page.keyboard.insertText('3')
    await status.getByText('Live preview', { exact: true }).waitFor()
    assert.ok((await editor.inputValue()).includes('const skip = 3'))
    const after = await innerThreads(page, plot)
    assert.ok(before > 90 && after < before * .45, `Expected the edited threads to move to the rim (${before} → ${after})`)
    if (!paper) assert.equal(await plot.locator('canvas').getAttribute('tabindex'), '0')

    await editor.fill(`function pattern() {
      const nodes = [{ id: 'reed' }, { id: 'flax' }, { id: 'linen' }]
      return { nodes, links: [{ source: 'reed', target: 'linen' }], color: '#297a78' }
    }`)
    await bench.getByText('3 pins · 1 link', { exact: true }).waitFor()
    await bench.getByText('#297a78', { exact: true }).waitFor()
    const custom = await editor.inputValue()
    await editor.fill(custom.slice(0, -1))
    await status.getByText(/Showing the last drawing/).waitFor()
    assert.equal(await editor.getAttribute('aria-invalid'), 'true')
    assert.ok(await bench.getByText('3 pins · 1 link', { exact: true }).isVisible())
    await editor.fill(custom.replace("target: 'linen'", "target: 'missing'"))
    await status.getByText(/existing node id/).waitFor()
    assert.ok(await bench.getByText('#297a78', { exact: true }).isVisible())
    if (!touch && !paper) {
      await editor.fill('function pattern() { while (true) {} }')
      await status.getByText(/took too long/).waitFor()
      await editor.fill('function pattern() { for (;;) {} }')
      await page.locator('iframe[title="Pattern runner"]').waitFor({ state: 'attached' })
    }
    await activate(bench.getByRole('button', { name: 'Star', exact: true }))
    await bench.getByText('7 pins · 7 links', { exact: true }).waitFor()
    assert.match(await editor.inputValue(), /ring\(7\)/)
    await activate(bench.getByRole('button', { name: 'Halo', exact: true }))
    await bench.getByText('48 pins · 48 links', { exact: true }).waitFor()
    await editor.fill((await editor.inputValue()).replace('ring(48)', 'ring(16)'))
    await bench.getByText('16 pins · 16 links', { exact: true }).waitFor()
    await activate(bench.getByRole('button', { name: 'Reset' }))
    await bench.getByText('48 pins · 48 links', { exact: true }).waitFor()
    assert.match(await editor.inputValue(), /ring\(48\)/)
    await activate(bench.getByRole('button', { name: 'Rosette', exact: true }))
    await bench.getByText('36 pins · 36 links', { exact: true }).waitFor()
    assert.equal(await editor.inputValue(), start)
    assert.ok(await innerThreads(page, plot) > before * .8, 'Restoring the preset should restore its threads')
    if (!paper) {
      const canvas = plot.locator('canvas')
      await canvas.scrollIntoViewIfNeeded()
      const box = await canvas.boundingBox()
      const firstPin = { x: box.width / 2, y: box.height * .071 }
      if (touch) await canvas.tap({ position: firstPin })
      else await canvas.click({ position: firstPin })
      await bench.getByText('Pin 1', { exact: true }).waitFor()
      if (!touch) {
        const moved = { x: firstPin.x + box.width * .08, y: box.height * .3 }
        await page.mouse.move(box.x + firstPin.x, box.y + firstPin.y)
        await page.mouse.down()
        await page.mouse.move(box.x + moved.x, box.y + moved.y, { steps: 8 })
        await page.mouse.up()
        await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
        await bench.getByText('Drag a pin', { exact: true }).waitFor()
        await canvas.click({ position: moved })
        await bench.getByText('Pin 1', { exact: true }).waitFor()
      }
    }
    assert.equal(await editor.getAttribute('aria-invalid'), 'false')
    assert.equal(await page.locator('iframe[title="Pattern runner"]').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
    assert.deepEqual(errors, [])
    return { renderer: paper ? 'paper' : 'loom', innerPixels: [before, after] }
  } finally { await page.close() }
}
