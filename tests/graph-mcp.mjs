import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const shots = new URL('../artifacts/studio/', import.meta.url)

export async function graphMcpJourney(context, home, { touch = false, live = false } = {}) {
  const page = await context.newPage()
  const device = touch ? 'mobile' : 'desktop'
  const activate = element => touch ? element.tap() : element.click()
  const failures = []
  page.on('pageerror', e => failures.push(e.message))
  async function fits() {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), page.url() + ' exceeds viewport')
  }
  async function capture(name, target = page) {
    await target.screenshot({ path: fileURLToPath(new URL(name + '-' + device + '.png', shots)), animations: 'disabled' })
  }
  try {
    await mkdir(shots, { recursive: true })
    await page.goto(home)
    await page.evaluate(() => document.fonts.ready)
    const nav = page.getByRole('navigation', { name: 'Field guide' })
    for (const name of ['Components', 'Examples', 'SDK docs', 'Graph MCP']) assert.ok(await nav.getByRole('link', { name }).isVisible())
    await activate(nav.getByRole('link', { name: 'Components' }))
    assert.equal(new URL(page.url()).hash, '#components')
    const studio = page.getByRole('tab', { name: /Graph Studio/ })
    const sdk = page.getByRole('tab', { name: /TypeScript SDK/ })
    const connector = page.getByRole('tab', { name: /Graph MCP/ })
    const panel = page.getByRole('tabpanel')
    assert.equal(await studio.getAttribute('aria-selected'), 'true')
    assert.ok(await panel.getByRole('link', { name: /Open the Bauhaus graph/ }).isVisible())
    if (touch) await activate(sdk)
    else {
      await studio.focus()
      await studio.press('ArrowDown')
      assert.ok(await sdk.evaluate(el => el === document.activeElement))
    }
    assert.match(await panel.textContent(), /createGraphIndex/)
    if (touch) await activate(connector)
    else await sdk.press('End')
    assert.equal(await connector.getAttribute('aria-selected'), 'true')
    assert.match(await panel.locator('blockquote').textContent(), /audible sounds/)
    await fits()
    await capture('component-showcase', page.locator('#components'))
    await activate(panel.getByRole('link', { name: 'Explore Graph MCP' }))
    await page.getByRole('heading', { level: 1, name: 'Graph MCP' }).waitFor()
    assert.equal(await nav.getByRole('link', { name: 'Graph MCP' }).getAttribute('aria-current'), 'page')
    await capture('graph-mcp')
    const input = page.getByRole('searchbox', { name: 'Find an article' })
    const headline = page.locator('.explorer-node h3')
    assert.equal(await headline.textContent(), 'Anni Albers')
    await input.fill('zzzzzz')
    await page.getByRole('status').filter({ hasText: /No matching articles/ }).waitFor()
    await input.fill('Gropius')
    await activate(page.getByRole('list', { name: 'Article search results' }).getByRole('button', { name: 'Walter Gropius', exact: true }))
    assert.equal(await headline.textContent(), 'Walter Gropius')
    assert.match(await page.getByRole('link', { name: /Wikipedia source/ }).getAttribute('href'), /oldid=\d+/)
    await activate(page.getByRole('button', { name: 'Linked from', exact: true }))
    await activate(page.locator('.tool-response summary'))
    const neighbors = page.getByRole('list', { name: 'Connected articles' }).getByRole('button')
    const response = JSON.parse(await page.locator('.tool-response pre').innerText())
    assert.equal(response.direction, 'incoming')
    assert.equal(response.total, await neighbors.count())
    const target = response.items[0].node
    await activate(neighbors.first())
    assert.equal(await headline.textContent(), target.label)
    await activate(page.getByRole('button', { name: /Back$/ }))
    assert.equal(await headline.textContent(), 'Walter Gropius')
    if (touch) await page.setViewportSize({ width: 320, height: 720 })
    const source = page.getByRole('radio', { name: 'My Studio export' })
    await activate(source)
    const config = page.locator('.mcp-connect > figure pre code')
    assert.equal(await config.count(), 0)
    const path = page.getByLabel('Path on your computer')
    await path.fill('scene.json')
    assert.equal(await config.count(), 0)
    const filename = "/graphs/Loom's project/scene.json"
    await path.fill(filename)
    const { command, args } = JSON.parse(await config.textContent()).mcpServers.loom
    assert.equal(command, 'npx')
    assert.deepEqual([args[0], ...args.slice(2)], ['--yes', 'loom-graph-mcp', '--graph', filename])
    const packageURL = new URL(args[1].slice('--package='.length))
    assert.equal(packageURL.origin, 'https://castlemilk.github.io')
    assert.match(packageURL.pathname, /\/loom-graph-mcp-[\d.]+\.tgz$/)
    if (live) {
      const revision = (await (await context.request.get(new URL('revision.txt?sha=' + (process.env.GITHUB_SHA || ''), home).href)).text()).trim()
      assert.ok(packageURL.pathname.includes('/packages/' + revision + '/'))
    }
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(home).origin })
    await activate(page.getByRole('button', { name: 'Copy MCP configuration' }))
    await page.getByText('Copied', { exact: true }).waitFor()
    assert.deepEqual(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).mcpServers.loom, { command, args })
    await activate(page.locator('.codex-setup summary'))
    assert.match(await page.locator('.codex-setup code').textContent(), /^codex mcp add loom -- npx --yes --package=https:/)
    await activate(page.getByRole('radio', { name: 'Bundled graphs' }))
    assert.equal(JSON.parse(await config.textContent()).mcpServers.loom.args.length, 3)
    const download = await page.getByRole('link', { name: /Download the server package/ }).getAttribute('href')
    assert.ok((await context.request.head(new URL(download, home).href)).ok())
    await fits()
    assert.deepEqual(failures, [])
    return { device, visited: target.label, archive: packageURL.pathname.split('/').at(-1) }
  } finally { await page.close() }
}
