export async function studio(page, url) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const byId = (id) => page.locator('#' + id)
  const check = (ok, message) => {
    if (!ok) throw new Error(message)
  }
  await page.goto(url)
  await page.locator('#graph[tabindex="0"]').waitFor()
  await byId('totals').getByText('25 nodes · 30 links', { exact: true }).waitFor()
  await byId('blend').focus()
  await byId('blend').press('End')
  check((await byId('blend-value').textContent()) === '100%', 'Structure slider failed')
  const nextPaint = () => page.evaluate(() => new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(done))
  }))
  await nextPaint()
  const canvas = byId('graph')
  const hit = await canvas.evaluate((el) => {
    const box = el.getBoundingClientRect()
    for (let y = box.height / 4; y < box.height * 0.8; y += 8) {
      for (let x = box.width / 4; x < box.width * 0.8; x += 8) {
        const point = { clientX: box.x + x, clientY: box.y + y }
        el.dispatchEvent(new PointerEvent('pointermove', point))
        if (el.hasAttribute('data-node')) return point
      }
    }
  })
  check(hit, 'No visible node could be picked')
  await page.mouse.click(hit.clientX, hit.clientY)
  await byId('focus').click()
  await nextPaint()
  const selectedBeforeSizing = await byId('selection').textContent()
  await page.getByRole('button', { name: 'Increase node size' }).click()
  check(await byId('size-value').textContent() === '1.25×', 'Node size step failed')
  await byId('node-size').focus()
  await byId('node-size').press('End')
  check(await byId('size-value').textContent() === '16×' && await byId('size-up').isDisabled(), 'Maximum node size failed')
  await byId('node-size').press('Home')
  check(await byId('size-value').textContent() === '0.3×' && await byId('size-down').isDisabled(), 'Minimum node size failed')
  await page.getByRole('button', { name: 'Reset node size' }).click()
  await nextPaint()
  check(await byId('size-value').textContent() === '1.15×' && await byId('selection').textContent() === selectedBeforeSizing,
    'Resizing lost the selected node or theme size')
  const box = await canvas.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  for (const sticky of [false, true]) {
    await byId('pin-drag').setChecked(sticky)
    await page.mouse.move(x, y)
    check(await canvas.evaluate((el) => el.hasAttribute('data-node')), 'Focused node missed by pointer')
    await page.mouse.down()
    await page.mouse.move(x + 75, y + 16, { steps: 8 })
    await page.mouse.up()
    const action = sticky ? 'Release node' : 'Pin node'
    check((await byId('pin').textContent()) === action, 'Inspector showed the wrong drag release state')
  }
  await byId('pin').click()
  await byId('pin-drag').uncheck()
  await byId('direction').selectOption('vertical')
  await page.getByText('Spacing & forces', { exact: true }).click()
  await byId('lane-gap').focus()
  await byId('lane-gap').press('ArrowRight')
  check((await byId('lane-gap-value').textContent()) === '176', 'Lane spacing control failed')
  await page.getByText('Style controls', { exact: true }).click()
  await byId('kind').selectOption('lab')
  await byId('shape').selectOption('circle')
  await byId('kind-color').fill('#be45ab')
  const lab = byId('legend').locator('span').filter({ hasText: 'lab' }).locator('i')
  check(
    (await lab.getAttribute('data-shape')) === 'circle' &&
      (await lab.evaluate((el) => el.style.getPropertyValue('--kind'))) === '#be45ab',
    'Per-kind marker controls failed',
  )
  await byId('wire-kind').selectOption('concept')
  await byId('wire-width').focus()
  await byId('wire-width').press('End')
  check((await byId('width-value').textContent()) === '8 px', 'Link weight control failed')
  await byId('wire-color').fill('#11ee91')
  await byId('labels').selectOption('focus')
  await byId('grid').uncheck()
  await byId('artwork').uncheck()
  await byId('route').selectOption('straight')
  await byId('dataset').selectOption('full')
  await byId('totals').getByText('508 nodes · 746 links', { exact: true }).waitFor()
  const full = await byId('totals').textContent()
  check(full === '508 nodes · 746 links', 'Full knowledge snapshot failed')
  await byId('dataset').selectOption('stress')
  check((await byId('totals').textContent()) === '180 nodes · 720 links', 'Stress graph failed')
  await byId('dataset').selectOption('count-1000')
  await byId('totals').getByText('1,000 nodes · 4,000 links', { exact: true }).waitFor()
  await byId('theme').selectOption('parchment')
  await page.getByText('Simulation & diagnostics', { exact: true }).click()
  await byId('physics').selectOption('fixed')
  await page.getByRole('button', { name: 'Cloud', exact: true }).click()
  await byId('refresh').click()
  check((await byId('ticks').textContent()) === '0', 'Explicit positions ran physics')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => document.getElementById('graph').clientWidth <= 390)
  const mobile = await page.evaluate(() => ({
    canvas: document.getElementById('graph').clientWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }))
  check(!mobile.overflow && mobile.canvas > 280, 'Mobile viewport overflowed')
  const sizeControl = await byId('size-up').boundingBox()
  check(sizeControl && sizeControl.x >= 0 && sizeControl.x + sizeControl.width <= 390, 'Mobile size control is clipped')
  const notice = await byId('error').isVisible()
  check(!notice && !errors.length, 'Studio error: ' + errors.join(', '))
  return { full, structure: await byId('blend-value').textContent(), linkWidth: 8, mobile }
}
