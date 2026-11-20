import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function chooseGraph(page, value, touch = false) {
  const trigger = page.getByRole('combobox', { name: 'Graph', exact: true })
  const select = (el) => (touch ? el.tap() : el.click())
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await select(trigger)
  await select(
    page.getByRole('listbox', { name: 'Demo graphs' }).locator('[data-value=' + JSON.stringify(value) + ']'),
  )
}

export async function studioPicker(context, home, touch) {
  const page = await context.newPage()
  try {
    await page.goto(new URL('studio/wikispeedia/?topic=music', home).href)
    await page.locator('[data-visible-articles="96"]').waitFor()
    const trigger = page.getByRole('combobox', { name: 'Graph', exact: true })
    const list = page.getByRole('listbox', { name: 'Demo graphs' })
    await (touch ? trigger.tap() : trigger.click())
    await list.waitFor()
    assert.equal(await list.getByRole('group', { name: 'Wikipedia atlases' }).getByRole('option').count(), 3)
    assert.ok((await list.getByRole('option').count()) >= 8)
    assert.ok(await list.locator('[aria-selected=true] [data-graph-icon=check]').isVisible())
    const box = await list.boundingBox(),
      viewport = page.viewportSize()
    assert.ok(
      box.width >= 250 &&
        box.x >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height,
    )
    const shots = new URL('../artifacts/studio/', import.meta.url)
    await mkdir(shots, { recursive: true })
    await page.screenshot({
      path: fileURLToPath(new URL('graph-picker-' + (touch ? 'mobile' : 'desktop') + '.png', shots)),
    })
    await trigger.press('End')
    assert.equal(await list.locator('[data-focused]').getAttribute('data-value'), 'stress')
    await trigger.press('Escape')
    await list.waitFor({ state: 'hidden' })
    assert.ok(await trigger.evaluate((el) => document.activeElement === el))
    assert.equal(await page.locator('#dataset').inputValue(), 'wikispeedia')
    if (touch) await chooseGraph(page, 'cards', true)
    else {
      await trigger.press('a')
      assert.equal(await list.locator('[data-focused]').getAttribute('data-value'), 'cards')
      await trigger.press('Enter')
    }
    await page.getByRole('heading', { name: 'Around Canva' }).waitFor()
    await chooseGraph(page, 'bauhaus', touch)
    await page.locator('[data-atlas=bauhaus]').waitFor()
    assert.equal(await page.locator('#dataset').inputValue(), 'bauhaus')
  } finally {
    await page.close()
  }
}
