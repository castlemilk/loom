import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function lightPathJourney(context, home, touch = false) {
  const page = await context.newPage()
  const archiveRequests = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', req => {
    if (/\/(?:examples\/wikispeedia|graphs\/light-path)\//.test(new URL(req.url()).pathname)) archiveRequests.push(req.url())
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
    await exploreNeighborhoods(page, study, touch, shots)
    assert.equal(archiveRequests.filter(url => url.endsWith('/3752.json')).length, 1, 'Revisiting Rainbow reuses its neighborhood')
    await activate(steps.getByRole('link', { name: 'Radio → Light' }))
    await activate(study.getByRole('link', { name: 'Inspect in Studio' }))
    const details = page.getByRole('region', { name: 'Connection details' })
    await details.getByRole('heading', { name: /Radio.*Light/ }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('edge'), '593:2557')
    assert.match(await details.locator('blockquote').innerText(), /wireless transmission/)
    assert.equal(new URL(await details.getByRole('link', { name: /Read the archived source/ }).getAttribute('href')).pathname, new URL(citation).pathname)
    assert.deepEqual(errors, [])
    if (!touch) await navigationRecovery(context, home)
  } finally { await page.close() }
}

async function navigationRecovery(context, home) {
  const page = await context.newPage()
  const study = page.locator('#light-path')
  let release
  const hold = new Promise(resolve => { release = resolve })
  try {
    await page.route('**/graphs/light-path/v1/3752.json', route => route.abort(), { times: 1 })
    await page.goto(home)
    await study.getByRole('button', { name: 'Explore Rainbow' }).click()
    await study.getByRole('status').getByRole('button', { name: 'Retry' }).click()
    await study.getByRole('link', { name: 'Read the archived Rainbow article' }).waitFor()
    await study.getByRole('button', { name: 'Return to Light, step 1' }).click()

    // The reader can choose another article while a slow request is still on the wire.
    await page.route('**/graphs/light-path/v1/448.json', async route => {
      await hold
      await route.continue().catch(() => {}) // A canceled fetch may already be gone.
    })
    await Promise.all([
      page.waitForRequest('**/graphs/light-path/v1/448.json'),
      study.getByRole('link', { name: 'Trace Architecture to Light' }).dblclick(),
    ])
    await study.getByText('Opening Architecture…').waitFor()
    await study.getByRole('link', { name: 'Trace Radio to Light' }).dblclick()
    await study.getByRole('link', { name: 'Read the archived Radio article' }).waitFor()
    release()
    await page.waitForLoadState('networkidle')
    assert.equal(await study.locator('.hub-name').innerText(), 'Radio')
    const back = study.getByRole('button', { name: 'Return to Light, step 1' })
    assert.equal(await study.locator('.light-history li').count(), 2)
    await back.click()

    // The first six links are inline. The first page turn loads the full Light
    // neighborhood, including its last partial page, and wraps without skipping.
    const next = study.getByRole('button', { name: /Show next incoming links for Light/ })
    const incoming = study.getByRole('group', { name: 'Choose a starting article' })
    const ids = new Set()
    for (let i = 0; i < 8; i++) {
      for (const id of await incoming.locator('[data-edge]').evaluateAll(links => links.map(a => a.dataset.edge))) ids.add(id)
      await next.click()
      const start = i === 7 ? 1 : (i + 1) * 3 + 1
      await study.getByRole('button', { name: new RegExp('showing ' + start + ' to .* of 22') }).waitFor()
    }
    assert.equal(ids.size, 22)
  } finally { release(); await page.close() }
}

async function exploreNeighborhoods(page, study, touch, shots) {
  const article = (from, to) => study.getByRole('link', { name: 'Trace ' + from + ' to ' + to, exact: true })
  const center = name => study.getByRole('link', { name: 'Read the archived ' + name + ' article' })
  const history = study.getByRole('navigation', { name: 'Exploration path' })
  const selected = () => study.locator('.passage-steps [aria-current=step]').innerText()
  const activate = el => touch ? el.tap() : el.click()
  const rainbow = article('Light', 'Rainbow')
  if (touch) {
    await rainbow.tap()
    await study.getByRole('button', { name: 'Explore Rainbow' }).tap()
  } else await rainbow.dblclick()
  await center('Rainbow').waitFor()
  assert.equal(await history.locator('[aria-current=location]').innerText(), 'Rainbow')
  assert.equal(await selected(), 'Light → Rainbow', 'Keep the directed link we arrived along')
  assert.match(await center('Rainbow').getAttribute('href'), /Rainbow\.htm$/)
  assert.ok(await center('Rainbow').evaluate(el => el === document.activeElement))
  assert.match(await study.locator('blockquote').innerText(), /rainbows offers many clues/)
  assert.equal(await study.locator('.hub-specimen').evaluate(el => el.getAnimations().length), 0, 'Respect reduced motion')
  assert.ok(await article('Rainbow', 'Color').isVisible())
  await activate(study.getByRole('button', { name: 'Show next outgoing links for Rainbow, showing 1 to 3 of 12' }))
  assert.equal(await selected(), 'Rainbow → Sphere')
  const spherePassage = await study.locator('blockquote').innerText()
  if (touch) {
    // A real double tap on the graph is equivalent to the explicit Explore action.
    const pin = await article('Rainbow', 'Sphere').boundingBox()
    await page.touchscreen.tap(pin.x + pin.width / 2, pin.y + pin.height / 2)
    await page.touchscreen.tap(pin.x + pin.width / 2, pin.y + pin.height / 2)
  } else {
    await article('Rainbow', 'Sphere').press('Enter')
    await study.getByRole('button', { name: 'Explore Sphere' }).press('Enter')
  }
  await center('Sphere').waitFor()
  assert.equal(await selected(), 'Rainbow → Sphere')
  await activate(history.getByRole('button', { name: 'Return to Rainbow, step 2' }))
  assert.equal(await selected(), 'Rainbow → Sphere')
  assert.equal(await study.locator('blockquote').innerText(), spherePassage)
  assert.ok(await study.getByRole('button', { name: 'Show next outgoing links for Rainbow, showing 4 to 6 of 12' }).isVisible())

  // A source-only article can still be centered, inspected and left by its breadcrumb.
  await activate(article('Wave–particle duality', 'Rainbow'))
  await activate(study.getByRole('button', { name: 'Explore Wave–particle duality' }))
  await center('Wave–particle duality').waitFor()
  assert.equal(await study.locator('.passage-steps a').count(), 1)
  assert.equal(await selected(), 'Wave–particle duality → Rainbow')
  assert.ok(await study.getByText('No incoming passages').isVisible())
  await activate(history.getByRole('button', { name: 'Return to Light, step 1' }))
  assert.equal(await selected(), touch ? 'Light → Rainbow' : 'Radio → Light', 'Restore the selection from before the focus gesture')
  assert.equal(await history.count(), 0)
  if (touch) { await rainbow.tap(); await study.getByRole('button', { name: 'Explore Rainbow' }).tap() }
  else await rainbow.dblclick()
  await center('Rainbow').waitFor()
  await page.screenshot({ path: fileURLToPath(new URL('rainbow-neighborhood-' + (touch ? 'mobile' : 'desktop') + '.png', shots)) })
  await activate(study.getByRole('button', { name: 'Back to Light' }))
  await center('Light').waitFor()
  assert.equal(await history.count(), 0)
}
