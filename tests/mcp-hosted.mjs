import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import { guestConfig, pagesCallback } from '../mcp/hosted/config.mjs'

// The preview uses different origins for the Pages client and the real issuer.
// On the public run the browser follows the actual link from the published guide.
const published = process.argv.includes('--live')
const config = guestConfig(published ? undefined : 'http://127.0.0.1:' + (process.env.LOOM_HOSTED_TEST_PORT || 7377))
let callback = pagesCallback, directory, pages, service, browser, container
let expectedRevision = process.env.LOOM_EXPECTED_REVISION
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
try {
  if (!published) {
    const { demoAssets } = await import('../mcp/demo/page.mjs')
    const assets = await demoAssets()
    assets.set('config.json', JSON.stringify(config))
    pages = createServer((req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname
      const prefix = '/loom/mcp/live/'
      const file = path.slice(prefix.length) || 'index.html'
      if (!path.startsWith(prefix) || !assets.has(file)) { res.writeHead(404).end(); return }
      res.writeHead(200, { 'Content-Type': { html: 'text/html', js: 'text/javascript', json: 'application/json', css: 'text/css' }[file.split('.').pop()] }).end(assets.get(file))
    }).listen(0, '127.0.0.1')
    await once(pages, 'listening')
    callback = 'http://127.0.0.1:' + pages.address().port + '/loom/mcp/live/'
    directory = await mkdtemp(join(tmpdir(), 'loom-hosted-'))
    const port = new URL(config.issuer).port
    const index = process.argv.indexOf('--archive')
    if (index >= 0) {
      const archive = resolve(process.argv[index + 1])
      expectedRevision = JSON.parse(execFileSync('tar', ['-xOzf', archive, './release.json'])).revision
      const manifest = await readFile(new URL('../deploy/hosted/resources.yaml', import.meta.url), 'utf8')
      const [, image] = manifest.match(/image: &runtime (\S+)/)
      const name = 'loom-hosted-test-' + randomUUID()
      execFileSync('docker', ['run', '-d', '--rm', '--name', name, '--platform', 'linux/amd64', '--read-only', '--user', '1000:1000',
        '--tmpfs', '/var/lib/loom:rw,uid=1000,gid=1000,mode=0700', '--tmpfs', '/app:rw,uid=0,gid=1000,mode=0770',
        '-v', archive + ':/release.tgz:ro', '--workdir', '/app',
        '-p', '127.0.0.1:' + port + ':8080', '-e', 'LOOM_PAGES_CALLBACK=' + callback, '-e', 'LOOM_PUBLIC_ORIGIN=' + config.issuer,
        image, '/bin/sh', '-ec', 'mkdir -p runtime && tar --no-same-owner --no-overwrite-dir -xzf /release.tgz -C runtime && exec node /app/runtime/hosted/start.mjs'])
      container = name
      const deadline = Date.now() + 90_000
      while (!(await fetch(config.issuer + '/healthz').then(r => r.ok, () => false))) {
        if (Date.now() > deadline) throw new Error('Packaged service did not become ready: ' + execFileSync('docker', ['logs', '--tail', '8', name]))
        await delay(300)
      }
    } else {
      const { hostedService } = await import('../mcp/hosted/service.mjs')
      service = await hostedService({ issuer: config.issuer, callback, database: join(directory, 'auth.sqlite'), revision: 'test' })
      service.listen(Number(port), '127.0.0.1')
      await once(service, 'listening')
    }
  }
  const info = await (await fetch(config.issuer + '/healthz')).json()
  assert.equal(info.status, 'ready')
  if (expectedRevision) assert.equal(info.revision, expectedRevision)
  const challenge = await fetch(config.resource, { method: 'POST' })
  assert.equal(challenge.status, 401)
  assert.match(challenge.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/)
  browser = await chromium.launch({ channel: process.env.LOOM_BROWSER_CHANNEL || 'chrome' })
  for (const mobile of [false, true]) {
    const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {})
    try {
      const page = await context.newPage()
      const exchanges = []
      page.on('response', r => { if (r.url() === config.issuer + '/token' && r.request().method() === 'POST') exchanges.push(r) })
      if (published) {
        await page.goto(new URL('../#http', callback).href)
        await page.getByRole('link', { name: 'Try the live OAuth demo' }).click()
      } else await page.goto(callback)
      await page.getByRole('button', { name: 'Connect over HTTP' }).click()
      await page.getByRole('heading', { name: 'Sign-in required' }).waitFor()
      await page.getByRole('button', { name: 'Review access' }).click()
      const authorization = page.waitForRequest(r => r.url().startsWith(config.issuer + '/auth?'))
      await page.getByRole('button', { name: 'Continue to Loom Guest' }).click()
      const request = new URL((await authorization).url()).searchParams
      assert.equal(request.get('code_challenge_method'), 'S256')
      assert.equal(request.get('redirect_uri'), callback)
      assert.equal(request.get('resource'), config.resource)
      await page.getByRole('button', { name: 'Continue as guest' }).click()
      await page.getByRole('heading', { name: 'Allow read access?' }).waitFor()
      if (mobile) {
        await page.getByRole('button', { name: 'Cancel' }).click()
        await page.getByRole('alert').filter({ hasText: 'declined' }).waitFor()
        assert.equal(exchanges.length, 0)
        assert.equal(page.url(), callback)
        await page.getByRole('button', { name: 'Connect over HTTP' }).click()
        await page.getByRole('heading', { name: 'Sign-in required' }).waitFor()
        continue
      }
      await page.getByRole('button', { name: 'Allow graph access' }).click()
      await page.getByRole('heading', { name: 'Code exchanged' }).waitFor()
      assert.equal(page.url(), callback)
      assert.equal(exchanges.length, 1)
      assert.equal(exchanges[0].status(), 200)
      const tokenRequest = new URLSearchParams(exchanges[0].request().postData())
      assert.equal(tokenRequest.get('grant_type'), 'authorization_code')
      assert.ok(tokenRequest.has('code_verifier'))
      assert.equal((await exchanges[0].json()).scope, 'graph:read')
      await page.getByRole('button', { name: 'List graph tools' }).click()
      await page.getByRole('heading', { name: 'Tools available' }).waitFor()
      assert.equal(await page.locator('.frame-tools li').count(), 6)
      const query = page.waitForResponse(r => r.url() === config.resource && r.request().method() === 'POST' &&
        r.request().postDataJSON()?.method === 'tools/call')
      await page.getByRole('button', { name: 'Run get_connection' }).click()
      const result = await query
      assert.equal(result.status(), 200)
      assert.ok((await result.request().headerValue('authorization'))?.startsWith('Bearer '))
      await page.getByRole('link', { name: 'Archived Music article' }).waitFor()
      assert.match(await page.locator('blockquote').innerText(), /audible sounds/)
      assert.equal(await page.locator('.frame-source').getAttribute('href'), 'https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm')
      const shots = new URL('../artifacts/studio/', import.meta.url)
      await mkdir(shots, { recursive: true })
      await page.screenshot({ path: join(shots.pathname, 'hosted-oauth-result.png'), fullPage: true })
      await page.getByRole('button', { name: 'Open graph browser' }).click()
      await page.frameLocator('iframe[title="Loom graph browser"]').getByText('Music → Sound', { exact: true }).first().waitFor()
    } finally { await context.close() }
  }
  console.log('Verified guest consent, PKCE, six tools, the cited Music → Sound query, the MCP App and mobile cancellation. Service ' + info.revision + '.')
} finally {
  await browser?.close()
  if (container) execFileSync('docker', ['stop', container], { stdio: 'ignore' })
  if (service) await close(service)
  if (pages) await close(pages)
  if (directory) await rm(directory, { recursive: true, force: true })
}
