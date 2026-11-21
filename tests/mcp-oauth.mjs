import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const click = (page, name) => page.getByRole('button', { name, exact: false }).click()

async function reachConsent(page, { provider, resource, issuer: expectedIssuer }) {
  const demo = new URL('/demo/', resource).href
  await page.goto(demo)
  const [response, document] = await Promise.all([
    page.waitForResponse(r => r.url() === resource && r.status() === 401),
    page.waitForResponse(r => new URL(r.url()).pathname === '/.well-known/oauth-protected-resource/mcp'),
    click(page, 'Connect over HTTP'),
  ])
  const { authorization_servers: [issuer], scopes_supported: [scope] } = await document.json()
  assert.equal(issuer, expectedIssuer)
  assert.ok((await response.headerValue('www-authenticate')).includes('resource_metadata="' + document.url() + '"'))
  await click(page, 'Review access')
  const request = page.waitForRequest(req => new URL(req.url()).searchParams.has('code_challenge'))
  await click(page, 'Continue to ' + provider)
  const isKeycloak = provider === 'Keycloak'
  await page.locator(isKeycloak ? '#username' : '[name=login]').fill('reader')
  const authorization = new URL((await request).url()).searchParams
  assert.equal(authorization.get('resource'), resource)
  assert.equal(authorization.get('response_type'), 'code')
  assert.equal(authorization.get('scope'), scope)
  assert.equal(authorization.get('code_challenge_method'), 'S256')
  assert.ok(authorization.get('code_challenge') && authorization.get('state'))
  await page.locator('[name=password]').fill('loom-demo')
  await click(page, isKeycloak ? 'Sign In' : 'Sign-in')
  await page.getByText(isKeycloak ? 'Read Loom graphs and their source passages' : 'graph:read', { exact: true }).waitFor()
  return { provider, resource, issuer, scope, challenge: response.status(),
    metadataUrl: document.url(), pkce: authorization.get('code_challenge_method') }
}

export async function testOAuthDemo(config, record = false) {
  const { provider, resource } = config
  const demo = new URL('/demo/', resource).href
  const isKeycloak = provider === 'Keycloak'
  const fixture = new URL('../web/showcase/' + (isKeycloak ? 'mcp-keycloak' : 'mcp-oidc') + '.json', import.meta.url)
  const browser = await chromium.launch({ channel: process.env.LOOM_BROWSER_CHANNEL })
  try {
    const page = await browser.newPage(), failures = []
    page.on('pageerror', e => failures.push(e.message))
    const receipt = await reachConsent(page, config)
    const exchange = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/token'))
    await (isKeycloak ? page.locator('[name=accept]') : page.getByRole('button', { name: 'Continue' })).click()
    const token = await exchange, form = new URLSearchParams(token.request().postData())
    assert.equal(form.get('grant_type'), 'authorization_code')
    assert.equal(form.get('resource'), resource)
    assert.ok(form.has('code_verifier') && !form.has('client_secret'))
    const { token_type, scope } = await token.json()
    Object.assign(receipt, { tokenStatus: token.status(), tokenEndpoint: token.url(), tokenType: token_type })
    assert.equal(receipt.tokenStatus, 200)
    assert.equal(scope, receipt.scope)
    await page.getByRole('heading', { name: 'Code exchanged' }).waitFor()
    assert.equal(new URL(page.url()).search, '')
    const toolReply = method => page.waitForResponse(r => r.url() === resource && r.request().method() === 'POST' &&
      r.request().postDataJSON()?.method === method)
    const listing = toolReply('tools/list')
    await click(page, 'List graph tools')
    const listed = await listing
    assert.ok((await listed.request().headerValue('authorization'))?.startsWith('Bearer '))
    await page.getByRole('heading', { name: 'Tools available' }).waitFor()
    Object.assign(receipt, { toolsStatus: listed.status(), tools: await page.locator('.frame-tools code').allTextContents() })
    assert.equal(receipt.tools.length, 6)
    const result = toolReply('tools/call')
    await click(page, 'Run get_connection')
    const called = await result
    const body = await called.text()
    // Older Streamable HTTP clients receive the same JSON-RPC result as an SSE message.
    const json = body.startsWith('event:') || body.startsWith('data:') ? body.split('\n').find(line => line.startsWith('data:')).slice(5) : body
    const { from, to, evidence } = JSON.parse(json).result.structuredContent
    Object.assign(receipt, { resultStatus: called.status(), from: from.label, to: to.label, evidence })
    await page.getByRole('link', { name: 'Archived Music article' }).waitFor()
    assert.equal(await page.locator('blockquote').innerText(), evidence.excerpt)
    assert.match(evidence.excerpt, /audible sounds/)
    const widget = toolReply('resources/read')
    await click(page, 'Open graph browser')
    const loaded = await widget
    assert.equal(loaded.status(), 200)
    assert.ok((await loaded.request().headerValue('authorization'))?.startsWith('Bearer '))
    await page.getByRole('dialog', { name: 'Graph browser' }).waitFor()
    const view = page.frameLocator('iframe[title="Loom graph browser"]')
    await view.getByRole('heading', { name: 'Music → Sound' }).waitFor()
    assert.equal(await view.locator('blockquote').textContent(), evidence.excerpt)
    assert.equal(await view.getByRole('link', { name: 'Open archived source' }).getAttribute('href'), evidence.sourceUrl)
    await view.getByRole('button', { name: 'Browse graphs' }).click()
    await view.getByRole('heading', { name: 'Graph browser', exact: true }).waitFor()
    await view.getByRole('combobox', { name: 'Graph', exact: true }).selectOption('bauhaus')
    await view.getByRole('searchbox').fill('Gropius')
    await view.getByRole('button', { name: 'Find nodes' }).click()
    await view.getByRole('button', { name: 'Walter Gropius', exact: true }).click()
    const neighbor = view.getByRole('list', { name: 'Graph results' }).getByRole('button').first()
    const destination = await neighbor.innerText()
    await neighbor.click()
    await view.getByRole('heading', { name: 'Walter Gropius → ' + destination }).waitFor()
    assert.match(await view.getByRole('status').innerText(), /directed link.*No archived passage/)
    await click(page, 'Close graph browser')
    await page.locator('iframe[title="Loom graph browser"]').waitFor({ state: 'detached' })
    const install = page.locator('.demo-install')
    await install.locator('summary').click()
    for (const [name, label] of [['Codex', 'Download Loom marketplace'], ['Claude Desktop', 'Download desktop extension']]) {
      await install.getByLabel(name, { exact: true }).check()
      const href = await install.getByRole('link', { name: label }).getAttribute('href')
      const packageResponse = await page.request.get(new URL(href, demo).href)
      assert.equal(packageResponse.status(), 200)
      assert.match(packageResponse.headers()['content-disposition'], /attachment; filename="loom-/)
      assert.deepEqual([...(await packageResponse.body()).subarray(0, 4)], [80, 75, 3, 4])
    }
    assert.deepEqual(failures, [])
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    let exchanges = 0
    phone.on('request', req => { if (new URL(req.url()).pathname.endsWith('/token')) exchanges++ })
    await reachConsent(phone, config)
    await (isKeycloak ? phone.locator('[name=cancel]') : phone.getByRole('link', { name: /Cancel/ })).click()
    await phone.getByRole('alert').filter({ hasText: 'declined' }).waitFor()
    assert.equal(exchanges, 0)
    await click(phone, 'Connect over HTTP')
    await phone.getByRole('heading', { name: 'Sign-in required' }).waitFor()
    await phone.goto(demo + '?code=unused&state=unmatched')
    await phone.getByRole('alert').filter({ hasText: 'state did not match' }).waitFor()
    assert.equal(exchanges, 0)
    // Publish only these public fields, after the positive and negative browser journeys pass.
    if (record) await writeFile(fixture, JSON.stringify(receipt, null, 2) + '\n')
    else {
      const expected = JSON.parse(await readFile(fixture, 'utf8'))
      // A second local demo can use different loopback ports with the same registered paths.
      for (const key of ['resource', 'metadataUrl', 'issuer', 'tokenEndpoint']) {
        const url = new URL(expected[key])
        url.port = new URL(key === 'issuer' || key === 'tokenEndpoint' ? config.issuer : resource).port
        expected[key] = url.href.replace(/\/$/, expected[key].endsWith('/') ? '/' : '')
      }
      assert.deepEqual(receipt, expected)
    }
    console.log(provider + ' sign-in, PKCE, cited result, interactive MCP App, consent denial and retry passed.')
  } finally { await browser.close() }
}
