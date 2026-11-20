import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function lightPathJourney(context, home, touch = false) {
  const page = await context.newPage()
  const archiveRequests = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', req => {
    if (/\/examples\/wikispeedia\//.test(new URL(req.url()).pathname)) archiveRequests.push(req.url())
  })
  const activate = link => touch ? link.tap() : link.press('Enter')
  try {
    await page.goto(home)
    const study = page.locator('#light-path')
    const start = study.getByRole('group', { name: 'Choose a starting article' })
    const end = study.getByRole('group', { name: 'Choose a destination article' })
    const steps = study.getByRole('navigation', { name: 'Read a link in this path' })
    const quote = study.locator('blockquote')
    await study.getByRole('link', { name: 'Read the archived Light article' }).locator('img').evaluate(img => img.decode())
    assert.equal(await start.locator('[aria-current=true]').getAttribute('aria-label'), 'Trace Radio to Light')
    assert.equal(await end.locator('[aria-current=true]').getAttribute('aria-label'), 'Trace Light to Rainbow')
    assert.match(await quote.innerText(), /rainbows offers many clues/)
    await page.evaluate(() => document.fonts.ready)
    const shots = new URL('../artifacts/studio/', import.meta.url)
    await mkdir(shots, { recursive: true })
    await page.screenshot({ path: fileURLToPath(new URL('light-path-' + (touch ? 'mobile' : 'desktop') + '.png', shots)) })

    const planckRay = study.locator('svg a[href$="2557%3A1064"] .ray-hit')
    const at = await planckRay.evaluate(line => {
      const point = line.getPointAtLength(line.getTotalLength() * .72).matrixTransform(line.getScreenCTM())
      return { x: point.x, y: point.y }
    })
    if (touch) await page.touchscreen.tap(at.x, at.y)
    else await page.mouse.click(at.x, at.y)
    assert.equal(await steps.locator('[aria-current=step]').innerText(), 'Light → Max Planck')
    assert.match(await quote.innerText(), /black body radiation/)

    // Walk the entire illustrated neighborhood. Each link is a real, directed
    // Studio permalink and selecting one side must preserve the other side.
    for (const origin of ['Saffron', 'Architecture', 'Radio']) {
      const select = start.getByRole('link', { name: 'Trace ' + origin + ' to Light' })
      await activate(select)
      assert.equal(await steps.locator('[aria-current=step]').innerText(), origin + ' → Light')
      if (origin === 'Saffron') assert.match(await quote.innerText(), /breaks down chemically in the presence of light/)
      for (const dest of ['Max Planck', 'Microscope', 'Rainbow']) {
        const selectEnd = end.getByRole('link', { name: 'Trace Light to ' + dest })
        await activate(selectEnd)
        assert.equal(await steps.locator('[aria-current=step]').innerText(), 'Light → ' + dest)
        assert.equal(await select.getAttribute('aria-current'), 'true')
        assert.equal(await study.locator('.light-name').innerText(), origin)
        assert.equal(await study.locator('.light-destination').innerText(), 'to ' + dest + '.')
        assert.equal(await study.locator('.path-ray[data-lit=true]').count(), 2)
        assert.equal(await study.getByRole('link', { name: 'Inspect in Studio' }).getAttribute('href'), await selectEnd.getAttribute('href'))
        assert.ok((await quote.getAttribute('cite')).includes('Light.htm'))
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      }
    }
    await activate(steps.getByRole('link', { name: 'Radio → Light' }))
    assert.match(await quote.innerText(), /wireless transmission/)
    assert.equal(await quote.locator('mark').innerText(), 'light')
    const citation = await quote.getAttribute('cite')
    assert.deepEqual(archiveRequests, [], 'The home page only needs its six extracted links')
    await activate(study.getByRole('link', { name: 'Inspect in Studio' }))
    const details = page.getByRole('region', { name: 'Connection details' })
    await details.getByRole('heading', { name: /Radio.*Light/ }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('edge'), '593:2557')
    assert.match(await details.locator('blockquote').innerText(), /wireless transmission/)
    assert.equal(new URL(await details.getByRole('link', { name: /Read the archived source/ }).getAttribute('href')).pathname, new URL(citation).pathname)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
}
