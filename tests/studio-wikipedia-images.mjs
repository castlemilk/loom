import assert from 'node:assert/strict'

export async function studioWikipediaImages(context, home, touch = false) {
  const page = await context.newPage(), requests = [], decoded = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  const toggle = page.getByRole('checkbox', { name: 'Wikipedia node images' })
  const photo = '[data-node-photo="article:97"]'
  let gate, release
  function pause() { gate = new Promise(resolve => { release = resolve }) }
  await page.route('https://en.wikipedia.org/w/api.php*', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'api-user-agent' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers, body: '' })
    const titles = new URL(route.request().url()).searchParams.get('titles').split('|')
    requests.push(...titles)
    if (gate) await gate
    await route.fulfill({ headers, json: { query: { pages: titles.map(title => title === 'The Beatles' ? { title } : {
      title, pageimage: title + '.jpg', thumbnail: {
        source: 'https://upload.wikimedia.org/wikipedia/commons/' + encodeURIComponent(title) + '.jpg',
        width: 80, height: 60,
      },
    }) } } }).catch(() => {})
  })
  await page.route('https://upload.wikimedia.org/**', async route => {
    decoded.push(route.request().url())
    await route.fulfill({ contentType: 'image/svg+xml', body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><circle cx="40" cy="30" r="30" fill="green"/></svg>' })
  })
  const anchor = page.locator('.wiki-article-photo')
  try {
    await page.goto(new URL('studio/wikispeedia/?topic=music&images=off', home).href)
    await page.locator('[data-visible-articles="96"]').waitFor()
    await page.locator('[data-map-topic="1"]').press('Enter')
    await page.locator('[data-article-id="97"]').click()
    assert.equal(await toggle.isChecked(), false)
    assert.deepEqual(requests, [])
    const reads = await page.locator('[data-read-requests]').textContent()
    pause()
    const request = page.waitForRequest(r => r.url().startsWith('https://en.wikipedia.org/w/api.php') && r.method() === 'GET')
    await toggle.check()
    await request
    await toggle.uncheck()
    release(); gate = null
    assert.equal(await page.locator('[data-node-photo]').count(), 0)
    assert.deepEqual(decoded, [], 'Turning off a pending lookup does not download a stale thumbnail')
    await toggle.check()
    await page.locator(photo).waitFor()
    await anchor.waitFor()
    assert.match(await anchor.getAttribute('href'), /File:Piano\.jpg$/)
    assert.ok(await page.locator(photo).evaluate(img => img.complete && img.naturalWidth > 0))
    const positions = await page.evaluate(sel => {
      const pic = document.querySelector(sel).getBoundingClientRect(), svg = document.querySelector('.atlas-crossing-overlay').getBoundingClientRect()
      const chosen = document.querySelector('[data-map-marker="selected"]')
      return Math.hypot(pic.x + pic.width / 2 - svg.x - Number(chosen.getAttribute('cx')),
        pic.y + pic.height / 2 - svg.y - Number(chosen.getAttribute('cy')))
    }, photo)
    assert.ok(positions < 1, 'The decoded picture sits on the selected WebGL node')
    assert.ok(await page.locator('[data-node-photo]').count() <= (touch ? 5 : 9))
    assert.ok(new Set(requests).size <= (touch ? 5 : 9), 'Opening Music did not request all 96 titles')
    const pianoRequests = requests.filter(t => t === 'Piano').length
    pause()
    await page.getByRole('button', { name: 'View article cards' }).click()
    const cards = page.locator('.atlas-card-svg')
    await cards.waitFor()
    await page.locator('.atlas-card-stage').getByRole('button', { name: 'Zoom in' }).click()
    const box = await cards.getAttribute('viewBox')
    release(); gate = null
    await cards.locator('[data-card-id="article:97"] image').waitFor()
    assert.equal(await cards.getAttribute('viewBox'), box, 'Arriving card images preserve the camera')
    await page.getByRole('button', { name: 'Return to topic map' }).click()
    await toggle.uncheck()
    assert.equal(await page.locator('[data-node-photo]').count(), 0)
    assert.equal(await anchor.count(), 0)
    await toggle.check()
    await page.locator(photo).waitFor()
    assert.equal(requests.filter(t => t === 'Piano').length, pianoRequests, 'Map, cards and repeat views reuse the result')
    await page.locator('[data-article-id="114"]').click()
    await page.getByRole('heading', { name: 'The Beatles', exact: true }).waitFor()
    assert.equal(await anchor.count(), 0, 'An article without a picture still opens normally')
    assert.equal(await page.locator('[data-read-requests]').textContent(), reads)
    assert.deepEqual(errors, [])
    return { titlesRequested: new Set(requests).size, checkedMapAndCards: true }
  } finally { release?.(); await page.close() }
}
