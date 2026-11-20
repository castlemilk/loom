import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const shots = new URL('../artifacts/studio/', import.meta.url)

async function searchBeforeHydration(context, home) {
  const page = await context.newPage()
  let release
  const scripts = new Promise(resolve => { release = resolve })
  try {
    await page.route('**/_next/static/**/*.js*', async route => {
      await scripts
      await route.continue()
    })
    await page.goto(new URL('mcp/', home).href, { waitUntil: 'commit' })
    const input = page.getByRole('searchbox', { name: 'Find an article' })
    await input.fill('Gropius')
    release()
    const matches = page.getByRole('list', { name: 'Article search results' }).getByRole('button')
    await page.waitForFunction(() => document.querySelectorAll('.explorer-index li').length === 1)
    assert.equal(await input.inputValue(), 'Gropius')
    assert.match(await matches.innerText(), /Walter Gropius/)
    await input.fill('')
    await page.waitForFunction(() => document.querySelectorAll('.explorer-index li').length === 5)
  } finally {
    release()
    await page.close()
  }
}

async function dataSavingPlayback(context, home) {
  const page = await context.newPage()
  try {
    await page.addInitScript(() => {
      const connection = Object.assign(new EventTarget(), { saveData: true })
      Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
    })
    let requests = 0
    await page.route('**/showcase/*.mp4', route => ++requests === 1 ? route.abort('failed') : route.continue())
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(home)
    await page.getByRole('tab', { name: 'Graph MCP' }).click()
    const panel = page.getByRole('tabpanel')
    await panel.locator('img').evaluate(img => img.decode())
    assert.equal(requests, 0)
    assert.equal(await panel.locator('video').getAttribute('src'), null)
    await panel.getByRole('button', { name: 'Play Graph MCP walkthrough' }).click()
    await panel.getByRole('button', { name: 'Retry Graph MCP walkthrough' }).waitFor()
    assert.equal(await panel.locator('video').getAttribute('data-visible'), 'false')
    assert.ok(await panel.getByRole('link', { name: 'Explore Graph MCP' }).isVisible())
    await panel.getByRole('button', { name: 'Retry Graph MCP walkthrough' }).click()
    await panel.getByRole('button', { name: 'Pause Graph MCP walkthrough' }).waitFor()
  } finally { await page.close() }
}

export async function graphMcpJourney(context, home, { touch = false, live = false } = {}) {
  const page = await context.newPage()
  const device = touch ? 'mobile' : 'desktop'
  const activate = element => touch ? element.tap() : element.click()
  const failures = [], clips = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('.mp4')) clips.push(new URL(request.url()).pathname)
  })
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
    const movie = panel.locator('video')
    const play = panel.getByRole('button', { name: 'Play Graph Studio walkthrough' })
    const pause = panel.getByRole('button', { name: 'Pause Graph Studio walkthrough' })
    const layout = touch ? 'compact' : 'wide'
    assert.ok(await play.isVisible())
    assert.ok(await panel.locator('img').evaluate((img, suffix) => img.currentSrc.endsWith(suffix), 'studio-' + layout + '.webp'))
    assert.deepEqual(clips, [], 'Reduced motion should show the poster without fetching films')
    await activate(play)
    await pause.waitFor()
    await page.waitForFunction(() => document.querySelector('#components video').currentTime > .1)
    assert.ok(await movie.evaluate((v, suffix) => v.muted && v.playsInline && v.currentSrc.endsWith(suffix), 'studio-' + layout + '.mp4'))
    await activate(pause)
    const frozen = await movie.evaluate(v => v.currentTime)
    await page.locator('.guide-footer').scrollIntoViewIfNeeded()
    await movie.scrollIntoViewIfNeeded()
    assert.equal(await movie.evaluate(v => v.currentTime), frozen)
    await activate(play)
    await pause.waitFor()
    await page.locator('.guide-footer').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('#components video').paused)
    await movie.scrollIntoViewIfNeeded()
    await pause.waitFor()
    await movie.evaluate(v => { v.playbackRate = 8 })
    const replay = panel.getByRole('button', { name: 'Replay Graph Studio walkthrough' })
    await replay.waitFor()
    await activate(replay)
    await pause.waitFor()
    assert.ok(await movie.evaluate(v => v.currentTime < v.duration))
    assert.ok(clips.every(path => path.endsWith('studio-' + layout + '.mp4')), 'Only the visible chapter should be fetched')
    await activate(panel.getByRole('link', { name: 'Open Music in Studio' }))
    await page.getByRole('searchbox', { name: 'Find in Music' }).fill('Jazz')
    await page.getByRole('group', { name: 'Articles in topic' }).getByRole('button', { name: 'Jazz', exact: true }).waitFor()
    await page.goBack()
    await studio.waitFor()
    if (touch) await activate(sdk)
    else {
      await studio.focus()
      await studio.press('ArrowRight')
      assert.ok(await sdk.evaluate(el => el === document.activeElement))
    }
    await activate(panel.locator('summary'))
    assert.match(await panel.locator('pre').innerText(), /createGraphIndex/)
    const sdkLink = await panel.getByRole('link', { name: 'Read the SDK example' }).getAttribute('href')
    const guide = await context.request.get(new URL(sdkLink, home).href)
    assert.ok((await guide.text()).includes('id="inspect-a-connection"'))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await panel.getByRole('button', { name: 'Pause TypeScript SDK walkthrough' }).waitFor()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => !document.querySelector('#components video').hasAttribute('src'))
    if (touch) await activate(connector)
    else await sdk.press('End')
    assert.equal(await connector.getAttribute('aria-selected'), 'true')
    assert.match(await panel.locator('blockquote').textContent(), /audible sounds/)
    await activate(panel.locator('summary'))
    assert.ok(await panel.getByRole('link', { name: /2007 Schools Wikipedia source/ }).isVisible())
    await activate(panel.locator('summary'))
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
    if (!touch) {
      await dataSavingPlayback(context, home)
      await searchBeforeHydration(context, home)
    }
    return { device, visited: target.label, archive: packageURL.pathname.split('/').at(-1) }
  } finally { await page.close() }
}
