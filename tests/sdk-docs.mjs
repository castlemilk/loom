import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = new URL('../docs/examples/signal-path.ts', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const chapters = ['Your first graph', 'Layouts and styling', 'Search and drilldowns', 'Stream a Wikipedia atlas',
  'Edit a graph document', 'Build an AI graph tool', 'Measure graph performance', 'Optimise large graphs', 'API reference', 'SDK roadmap']

async function markdownFiles(context, home, links) {
  async function get(url) {
    const response = await context.request.get(url)
    assert.equal(response.status(), 200, url)
    return response.text()
  }
  const [index, full, benchmark, ...pages] = await Promise.all([
    get(new URL('llms.txt', home).href), get(new URL('llms-full.txt', home).href),
    get(new URL('benchmarks/m2-max.json', home).href),
    ...links.map(chapter => get(new URL('index.md', chapter.url).href)),
  ])
  assert.deepEqual(JSON.parse(benchmark), JSON.parse(await readFile(new URL('../benchmarks/m2-max.json', import.meta.url), 'utf8')))
  for (const [i, chapter] of links.entries()) {
    const pathname = new URL('index.md', chapter.url).pathname
    assert.ok(index.includes('[' + chapter.title + '](') && index.includes(pathname + ')'))
    assert.ok(pages[i].startsWith('# ' + chapter.title + '\n'))
    assert.ok(full.includes(pages[i]))
    assert.doesNotMatch(pages[i], /<(?:ExampleFile|InstallLoom|DocLink|StudioLink|AssetLink|ApiExplorer|SignalPreview|CardPreview|PerformancePreview)\b/)
  }
  assert.ok(full.includes((await readFile(new URL('../docs/examples/graph-tools.ts', import.meta.url), 'utf8')).trimEnd()))
  assert.match(full, /\bobservePerformance\(graph, sample/)
  assert.match(full, /\.setLayoutSpeed\(value: number\)/)
  assert.ok(index.includes(new URL('mcp/index.md', home).pathname + ')'))
  assert.ok(full.includes(await get(new URL('mcp/index.md', home).href)))
}

async function profileInteraction(page) {
  const panel = page.locator('.docs-measure')
  const frames = panel.getByText('Frames', { exact: true }).locator('+ dd')
  await panel.getByText('Idle', { exact: true }).waitFor()
  const before = Number(await frames.textContent())
  await panel.getByRole('button', { name: 'Orbit', exact: true }).click()
  await page.waitForFunction(initial => {
    const frameLabel = [...document.querySelectorAll('.docs-measure dt')].find(el => el.textContent === 'Frames')
    return Number(frameLabel?.nextElementSibling?.textContent) > initial
  }, before)
  await panel.getByText('Idle', { exact: true }).waitFor()
  assert.equal(await panel.getByText('Graph FPS', { exact: true }).locator('+ dd').textContent(), '0')
}

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
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
    if (!mobile) {
      await page.getByRole('button', { name: 'Copy signal-path.ts', exact: true }).click()
      await page.getByText('Copied', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), (await readFile(source, 'utf8')).trimEnd())
    }
    if (mobile) await page.getByText('Browse SDK docs', { exact: true }).click()
    const nav = page.getByRole('navigation', { name: 'SDK chapters' })
    const links = await nav.getByRole('link').evaluateAll(items => items.map(a => ({ url: a.href, title: a.textContent })))
    assert.deepEqual(links.map(link => link.title), chapters)
    if (!mobile) await markdownFiles(context, home, links)
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
      const markdown = new URL('index.md', chapter.url)
      assert.equal(new URL(await page.getByRole('link', { name: 'View Markdown' }).getAttribute('href'), home).pathname, markdown.pathname)
      assert.equal(new URL(await page.locator('link[rel=alternate][type="text/markdown"]').getAttribute('href'), home).pathname, markdown.pathname)
      if (chapter.title === 'Build an AI graph tool') {
        const copy = page.getByRole('button', { name: 'Copy page for AI' })
        if (mobile) await copy.tap()
        else await copy.click()
        await copy.filter({ hasText: 'Copied' }).waitFor()
        const raw = await context.request.get(markdown.href)
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await raw.text())
      }
      if (chapter.title === 'Measure graph performance') await profileInteraction(page)
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
