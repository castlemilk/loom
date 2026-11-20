import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = new URL('../docs/examples/signal-path.ts', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const chapters = ['Your first graph', 'Layouts and styling', 'Search and drilldowns', 'Stream a Wikipedia atlas',
  'Edit a graph document', 'API reference', 'SDK roadmap']

async function typeBeforeScriptsLoad(page, docsURL) {
  let resume
  const pending = new Promise(resolve => { resume = resolve })
  const scripts = /\/_next\/static\/chunks\/.*\.js/
  await page.route(scripts, async route => { await pending; await route.continue() })
  try {
    await page.goto(new URL('api/', docsURL).href, { waitUntil: 'commit' })
    await page.getByRole('searchbox', { name: 'Find an API' }).fill('setLayoutSpeed')
  } finally { resume() }
  await page.getByText('1 module matched', { exact: true }).waitFor()
  await page.unroute(scripts)
}

export async function sdkDocs(context, home, mobile = false) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const url = new URL('docs/', home).href
  try {
    await page.goto(url)
    await page.getByRole('heading', { level: 1, name: chapters[0] }).waitFor()
    for (const mode of ['Orbit', 'Cloud', 'Lanes']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await page.getByRole('button', { name: mode, pressed: true }).waitFor()
    }
    await page.getByRole('button', { name: 'Fit view' }).click()
    if (!mobile) {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
      await page.getByRole('button', { name: 'Copy signal-path.ts', exact: true }).click()
      await page.getByText('Copied', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), (await readFile(source, 'utf8')).trimEnd())
    }
    if (mobile) await page.getByText('Browse SDK docs', { exact: true }).click()
    const nav = page.getByRole('navigation', { name: 'SDK chapters' })
    const links = await nav.getByRole('link').evaluateAll(items => items.map(a => ({ url: a.href, title: a.textContent })))
    assert.deepEqual(links.map(link => link.title), chapters)
    await nav.getByRole('link', { name: 'API reference' }).click()
    const search = page.getByRole('searchbox', { name: 'Find an API' })
    await search.fill('setLayoutSpeed')
    await page.getByText('1 module matched', { exact: true }).waitFor()
    await page.getByText('setLayoutSpeed(value: number): void', { exact: true }).waitFor()
    await search.fill('GraphOptions')
    await page.getByLabel('GraphOptions', { exact: true }).filter({ hasText: 'extends GraphData' }).waitFor()
    await search.fill('nothing-matches-this-symbol')
    await page.getByRole('button', { name: 'Clear search' }).click()
    const names = Object.keys(pkg.exports).filter(key => pkg.exports[key].types).map(path => pkg.name + path.slice(1))
    await page.getByText(names.length + ' modules in loom-core ' + pkg.version, { exact: true }).waitFor()
    const apiLink = await page.getByRole('link', { name: 'Open the API index as JSON' }).getAttribute('href')
    const response = await context.request.get(new URL(apiLink, home).href)
    assert.equal(response.status(), 200)
    const index = await response.json()
    assert.deepEqual(index.modules.map(mod => mod.name), names)
    assert.equal(index.formatVersion, 1)
    for (const chapter of links) {
      assert.equal((await page.goto(chapter.url)).status(), 200)
      await page.getByRole('heading', { level: 1, name: chapter.title, exact: true }).waitFor()
      if (chapter.title === 'Search and drilldowns') {
        const preview = page.locator('.docs-card-preview')
        await preview.locator('[data-card-caption] text').filter({ hasText: 'Listed in portfolio' }).waitFor()
        const founder = preview.getByRole('button', { name: 'Melanie Perkins · Person' })
        await founder.press('Enter')
        assert.equal(await founder.getAttribute('aria-pressed'), 'true')
        await preview.getByRole('button', { name: 'Fit view' }).click()
      }
      const { fit, anchors } = await page.evaluate(() => ({
        fit: document.documentElement.scrollWidth <= innerWidth,
        anchors: [...document.querySelectorAll('.docs-outline a')].map(a => [a.hash, document.getElementById(a.hash.slice(1))?.tagName]),
      }))
      assert.ok(fit, 'Page should fit its viewport: ' + chapter.title)
      assert.ok(anchors.length > 0 && anchors.every(([, tag]) => tag === 'H2'), 'Chapter headings should be linkable: ' + chapter.title)
    }
    if (!mobile) await typeBeforeScriptsLoad(page, url)
    assert.deepEqual(errors, [])
    return { chapters: links.length, publicModules: names.length, layouts: 3 }
  } finally {
    await page.close()
  }
}
