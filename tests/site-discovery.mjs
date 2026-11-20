import assert from 'node:assert/strict'

export async function searchPages(browser, home) {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const request = context.request
  const page = await context.newPage()
  const base = new URL(home)
  const published = new URL(base.pathname, 'https://castlemilk.github.io')
  try {
    await page.goto(home)
    await page.getByRole('heading', { level: 1, name: /Interactive graphs.*TypeScript/ }).waitFor()
    const library = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
    assert.equal(library['@type'], 'SoftwareSourceCode')
    assert.equal(library.codeRepository, 'https://github.com/castlemilk/loom')
    assert.equal(library.url, published.href)
    assert.equal(library.alternateName, 'loom-core')
    assert.equal(library.license, 'https://github.com/castlemilk/loom/blob/main/LICENSE')
    const imageURL = new URL('illustrations/loom-social.jpg', published).href
    assert.equal(library.image, imageURL)
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), imageURL)
    assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), imageURL)
    assert.equal(await page.locator('meta[property="og:image:width"]').getAttribute('content'), '1200')
    assert.equal(await page.locator('meta[property="og:image:height"]').getAttribute('content'), '630')
    assert.match(await page.locator('meta[property="og:image:alt"]').getAttribute('content'), /Interactive graphs in TypeScript/)
    assert.deepEqual(await page.evaluate(async path => {
      const photo = new Image()
      photo.src = path
      await photo.decode()
      return [photo.naturalWidth, photo.naturalHeight]
    }, new URL(imageURL).pathname), [1200, 630])
    const logo = page.getByRole('link', { name: 'Loom home' }).locator('img')
    assert.equal(await logo.evaluate(img => img.naturalWidth), 256)
    const shortcuts = page.getByRole('navigation', { name: 'SDK shortcuts' })
    assert.equal(await shortcuts.getByRole('link').count(), 3)
    const sitemap = await request.get(new URL(await page.locator('link[rel=sitemap]').getAttribute('href'), base).href)
    assert.equal(sitemap.status(), 200)
    assert.match(sitemap.headers()['content-type'], /xml/)
    const urls = await page.evaluate(source => [...new DOMParser().parseFromString(source, 'application/xml')
      .querySelectorAll('urlset > url > loc')].map(loc => loc.textContent), await sitemap.text())
    await page.getByRole('link', { name: 'Build your first graph' }).click()
    const chapters = await page.locator('.docs-sidebar nav li a').evaluateAll(links => links.map(a => a.pathname))
    const expected = ['', 'artwork/', 'studio/', 'studio/cards/', 'studio/wikispeedia/', 'examples/bauhaus/', 'examples/outer-solar-system/'].map(path => new URL(path, published).href)
    assert.deepEqual(urls.slice().sort(), [...expected, ...chapters.map(path => new URL(path, published).href)].sort())
    const pages = await Promise.all(urls.map(async url => {
      const response = await request.get(new URL(new URL(url).pathname, base).href)
      assert.equal(response.status(), 200, url)
      return response.text()
    }))
    const metadata = await page.evaluate(sources => sources.map(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      return { title: doc.title, summary: doc.querySelector('meta[name=description]')?.content,
        canonical: doc.querySelector('link[rel=canonical]')?.getAttribute('href'),
        shareURL: doc.querySelector('meta[property="og:url"]')?.content,
        image: doc.querySelector('meta[property="og:image"]')?.content,
        card: doc.querySelector('meta[name="twitter:card"]')?.content, headings: doc.querySelectorAll('main h1, header h1').length }
    }), pages)
    assert.equal(new Set(metadata.map(m => m.title)).size, urls.length)
    assert.equal(new Set(metadata.map(m => m.summary)).size, urls.length)
    for (const [i, m] of metadata.entries()) {
      assert.equal(m.canonical, urls[i])
      assert.equal(m.shareURL, urls[i])
      assert.ok(m.summary && m.title.includes('Loom') && m.headings === 1, urls[i])
      assert.equal(m.card, 'summary_large_image')
      assert.ok(m.image.startsWith(published.href))
    }
    for (const image of new Set(metadata.map(m => m.image))) {
      const preview = await request.head(new URL(new URL(image).pathname, base).href)
      assert.equal(preview.status(), 200, image)
      assert.match(preview.headers()['content-type'], /^image\//)
    }
    for (const [slug, articles] of [['bauhaus', 15], ['outer-solar-system', 16]]) {
      await page.goto(new URL('examples/' + slug + '/', home).href)
      const rows = page.locator('.article-groups li a')
      assert.equal(await rows.count(), articles)
      assert.ok((await rows.evaluateAll(links => links.map(a => a.search))).every(query => new URLSearchParams(query).get('example') === slug))
      assert.equal(await page.getByRole('link', { name: 'CC BY-SA 4.0' }).getAttribute('href'), 'https://creativecommons.org/licenses/by-sa/4.0/')
    }
    await page.goto(new URL('studio/wikispeedia/', base).href)
    await page.getByText(/4,604 articles and 119,882 hyperlinks/).waitFor()
    assert.equal(await page.getByRole('region', { name: 'Follow a Wikipedia link' }).getByRole('link').count(), 3)
    await page.getByRole('link', { name: 'Build a streaming Wikipedia atlas' }).click()
    await page.getByRole('heading', { level: 1, name: 'Stream a Wikipedia atlas' }).waitFor()
    return { canonicalPages: urls.length, previewImages: new Set(metadata.map(m => m.image)).size }
  } finally { await context.close() }
}

export async function exampleJourney(context, home, touch = false) {
  const page = await context.newPage()
  const click = locator => touch ? locator.tap() : locator.click()
  const details = page.getByRole('region', { name: 'Connection details' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    const [collection, article] = touch ? ['outer-solar-system', 'Voyager 2'] : ['bauhaus', 'Anni Albers']
    await page.goto(new URL('examples/' + collection + '/', home).href)
    await click(page.getByRole('link', { name: 'Start with ' + article }))
    await page.locator('#selection').getByText(article, { exact: true }).waitFor()
    await page.goto(home)
    await click(page.getByRole('link', { name: 'Follow Music → Sound' }))
    await details.getByRole('heading', { name: /Music.*Sound/ }).waitFor()
    await page.getByRole('button', { name: 'Music links to Sound', pressed: true }).waitFor()
    assert.match(await details.locator('blockquote').textContent(), /audible sounds/)
    const permalink = await details.getByRole('link', { name: 'Permalink to this connection' }).getAttribute('href')
    const pair = page.getByRole('region', { name: 'Topic connections' })
    assert.equal(await pair.getByRole('button', { name: 'Previous' }).isEnabled(), true)
    await click(pair.getByRole('button', { name: 'Previous' }))
    await page.waitForFunction(() => new URL(location.href).searchParams.get('edge') !== '74:2863')
    await page.goto(new URL(permalink, home).href)
    await details.getByRole('heading', { name: /Music.*Sound/ }).waitFor()
    await click(details.getByRole('button', { name: 'Show link on map' }))
    await page.locator('[data-crossing-line]').waitFor()
    assert.equal(await page.locator('[data-map-caption=target]').textContent(), 'Sound')
    await page.waitForFunction(() => {
      const topics = [...document.querySelectorAll('.atlas-map-label:not([hidden])')].map(label => label.getBoundingClientRect())
      return ['source', 'target'].every(end => {
        const rect = document.querySelector('[data-map-caption=' + end + ']').getBoundingClientRect()
        return rect.width > 0 && topics.every(t => t.right <= rect.left || t.left >= rect.right || t.bottom <= rect.top || t.top >= rect.bottom)
      })
    })
    await page.goto(new URL('studio/wikispeedia/?images=off&layout=orbit', home).href)
    await page.locator('[data-visible-articles="0"]').waitFor()
    await click(page.getByRole('link', { name: /Symmetry → Mosaic/ }))
    await details.getByRole('heading', { name: /Symmetry.*Mosaic/ }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('layout'), 'orbit')
    await page.goto(new URL('studio/wikispeedia/?connections=mathematics,computing&edge=99999:99&images=off', home).href)
    await page.getByRole('button', { name: /links to/, pressed: true }).waitFor()
    await page.waitForFunction(() => new URL(location.href).searchParams.get('edge') !== '99999:99')
    await page.goto(new URL('studio/cards/', home).href)
    await click(page.getByRole('link', { name: 'Build relationship cards with the SDK' }))
    await page.getByRole('heading', { name: 'Open relationship cards' }).waitFor()
    await page.goto(new URL('studio/?example=wires#settings-style', home).href)
    await click(page.getByRole('link', { name: 'Style nodes and wires in the SDK' }))
    await page.getByRole('heading', { name: 'Map data to appearance' }).waitFor()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
}
