import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const shots = new URL('../artifacts/studio/', import.meta.url)

export async function guideMast(context, home, touch = false) {
  const page = await context.newPage()
  const nav = page.getByRole('navigation', { name: 'Field guide' })
  const menu = nav.locator('.mast-menu-trigger')
  const components = nav.locator('summary').filter({ hasText: 'Components' })
  const examples = nav.locator('summary').filter({ hasText: 'Examples' })
  const rows = nav.locator('.mast-group[open] .mast-row')
  const feature = nav.locator('.mast-group[open] .mast-feature')
  const bar = page.locator('.mast-inner')
  const act = el => touch ? el.tap() : el.click()
  const focusIs = el => el.evaluate(node => node === document.activeElement)
  try {
    await page.goto(home)
    await page.evaluate(() => document.fonts.ready)
    await mkdir(shots, { recursive: true })
    const initial = await bar.boundingBox()
    assert.ok(initial.x > 0 && initial.y > 0)
    assert.ok(await bar.evaluate(el => parseFloat(getComputedStyle(el).borderRadius) >= el.clientHeight / 2))
    assert.ok(await page.getByRole('link', { name: 'Open Studio', exact: true }).isVisible())

    if (touch) {
      assert.equal(await components.isVisible(), false)
      await menu.tap()
      await components.tap()
    } else {
      await components.hover()
      await rows.first().waitFor()
      // Move slowly through the space between the capsule and the floating panel.
      const target = await rows.first().boundingBox()
      await page.mouse.move(target.x + target.width / 2, target.y + 10, { steps: 15 })
      await feature.locator('img[data-visible=true]').evaluate(img => img.decode())
      await page.screenshot({ path: fileURLToPath(new URL('masthead-hover-desktop.png', shots)), animations: 'disabled' })
      await rows.nth(2).hover()
      assert.equal(await feature.getAttribute('aria-label'), 'Query the Bauhaus graph')
      assert.equal(await feature.getAttribute('href'), await rows.nth(2).getAttribute('href'))
      await page.mouse.move(4, 4)
      await rows.first().waitFor({ state: 'hidden' })
      await components.hover()
      await components.click()
      await page.mouse.move(4, 4)
      await rows.first().waitFor()
      await components.click()
      await rows.first().waitFor({ state: 'hidden' })
      await components.focus()
      await components.press('ArrowDown')
      assert.ok(await focusIs(rows.first()))
      await page.keyboard.press('ArrowDown')
      assert.ok(await focusIs(rows.nth(1)))
      assert.equal(await feature.getAttribute('aria-label'), 'Build your first graph')
      await page.keyboard.press('ArrowUp')
      assert.ok(await focusIs(rows.first()))
      await page.keyboard.press('Escape')
      assert.ok(await focusIs(components))
      await rows.first().waitFor({ state: 'hidden' })
    }

    if (touch) await examples.tap()
    else await examples.hover()
    await rows.first().waitFor()
    assert.equal(await nav.locator('.mast-group[open]').count(), 1)
    assert.match(await rows.first().innerText(), /Light and Rainbow/)
    assert.equal(await rows.count(), 3)
    await rows.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())))
    if (touch) {
      await page.screenshot({ path: fileURLToPath(new URL('masthead-menu-mobile.png', shots)), animations: 'disabled' })
      const bounds = await nav.locator('.mast-links').boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width)
      await page.touchscreen.tap(3, Math.ceil(bounds.y + bounds.height + 3))
      await examples.waitFor({ state: 'hidden' })
      await menu.tap()
      await examples.tap()
    }
    await act(nav.getByRole('link', { name: 'All examples' }))
    await page.waitForURL('**/#examples')
    assert.equal(await nav.locator('.mast-group[open]').count(), 0)
    const scrolled = await bar.boundingBox()
    assert.ok(Math.abs(initial.y - scrolled.y) < 2)
    const heading = await page.locator('#examples-title').boundingBox()
    assert.ok(heading.y >= scrolled.y + scrolled.height && heading.y < page.viewportSize().height)
    if (touch) {
      await menu.tap()
      await examples.tap()
      assert.equal(await feature.locator('img').count(), 0, 'Only the compact thumbnails load on a phone')
    }
    await act(nav.getByRole('link', { name: 'SDK docs', exact: true }))
    await page.waitForURL('**/docs/')
    if (touch) await menu.tap()
    assert.equal(await nav.getByRole('link', { name: 'SDK docs', exact: true }).getAttribute('aria-current'), 'location')
    if (!touch) {
      await page.setViewportSize({ width: 741, height: 720 })
      const capsule = await bar.boundingBox()
      const launch = await page.getByRole('link', { name: 'Open Studio', exact: true }).boundingBox()
      assert.ok(launch.x + launch.width <= capsule.x + capsule.width, 'The Studio action fits at the first desktop width')
    }
  } finally { await page.close() }
}
