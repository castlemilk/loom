import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function studioMenu(context, url, touch = false) {
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const route = new URL(url)
  route.searchParams.set('example', 'clusters')
  const menu = page.getByRole('tablist', { name: 'Graph settings' })
  const tab = (name) => menu.getByRole('tab', { name, exact: true })
  const firstControl = { Explore: '#find-node', Layout: '#blend', Groups: '#group-bubbles', Style: '#theme' }

  async function check(name) {
    const panel = page.getByRole('tabpanel', { name, exact: true })
    await panel.waitFor()
    assert.equal(await page.getByRole('tabpanel').count(), 1)
    assert.equal(await tab(name).getAttribute('aria-selected'), 'true')
    assert.equal(await tab(name).getAttribute('aria-controls'), await panel.getAttribute('id'))
    assert.equal(await menu.locator('[tabindex="0"]').count(), 1)
    const control = panel.locator(firstControl[name])
    await control.waitFor()
    const box = await control.boundingBox()
    const menuBox = await menu.boundingBox()
    assert.ok(box.y >= menuBox.y + menuBox.height - 1 && box.y + box.height <= page.viewportSize().height,
      name + ' must expose its first control below the menu ' + JSON.stringify({ control: box, menu: menuBox, viewport: page.viewportSize() }))
  }

  async function pick(name) {
    const illustration = tab(name).locator('img')
    if (touch) await illustration.tap()
    else await illustration.click()
    await check(name)
    assert.equal(new URL(page.url()).hash, '#settings-' + name.toLowerCase())
  }

  await page.goto(route.href)
  await page.locator('#graph[data-ready]').waitFor()
  await page.getByText('45 nodes · 88 links', { exact: true }).waitFor()
  await check('Explore')
  const canvas = await page.locator('#graph').elementHandle()
  await pick('Layout')
  await page.locator('#direction').selectOption('vertical')
  await pick('Groups')
  const bubbles = page.getByRole('switch', { name: 'Show group bubbles' })
  await bubbles.uncheck()
  await page.locator('.graph-boundaries path').first().waitFor({ state: 'detached' })
  assert.equal(await page.locator('#dataset').inputValue(), 'sections')
  assert.equal(await canvas.evaluate((el) => el === document.querySelector('#graph')), true)
  const shots = new URL('../artifacts/studio/', import.meta.url)
  await mkdir(shots, { recursive: true })
  await page.screenshot({ path: fileURLToPath(new URL(touch ? 'settings-mobile.png' : 'settings-desktop.png', shots)), animations: 'disabled' })
  await pick('Style')
  await page.locator('#theme').selectOption('blueprint')
  await pick('Explore')
  await page.locator('#find-node').fill('optics')
  await page.locator('[data-result]').first().waitFor()
  await pick('Layout')
  assert.equal(await page.locator('#direction').inputValue(), 'vertical')
  await page.goBack()
  await check('Explore')
  assert.equal(await page.locator('#find-node').inputValue(), 'optics')
  await page.goForward()
  await check('Layout')
  await pick('Groups')
  assert.equal(await bubbles.isChecked(), false)
  await page.reload()
  await check('Groups')
  assert.equal(new URL(page.url()).search, route.search)
  if (!touch) {
    for (const [from, key, to] of [['Groups', 'End', 'Style'], ['Style', 'ArrowRight', 'Explore'],
      ['Explore', 'ArrowLeft', 'Style'], ['Style', 'Home', 'Explore']]) {
      await tab(from).press(key)
      await check(to)
      assert.equal(await tab(to).evaluate((el) => el === document.activeElement), true)
    }
    await page.keyboard.press('Tab')
    assert.equal(await page.getByRole('tabpanel', { name: 'Explore' }).evaluate((el) => el.contains(document.activeElement)), true)
  }
  assert.deepEqual(errors, [])
  await page.close()
  return { input: touch ? 'touch' : 'mouse and keyboard', tabs: Object.keys(firstControl), history: true }
}
