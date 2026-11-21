import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { graphHttpHandler } from '../http.js'
import { createLoomMcpServerFactory } from '../server.js'

const factory = createLoomMcpServerFactory([{ id: 'test', name: 'Test graph', data: { nodes: [{ id: 'a' }], links: [] } }])
async function listener(t) {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return { server, origin: 'http://127.0.0.1:' + server.address().port }
}

test('a Streamable HTTP client can use the local transport without a provider', async t => {
  const { server, origin } = await listener(t), resourceUrl = origin + '/mcp'
  server.on('request', await graphHttpHandler(factory, { resourceUrl }))
  const client = new Client({ name: 'http-local', version: '1' })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(resourceUrl)))
    assert.equal((await client.listTools()).tools.length, 6)
    const catalog = await client.readResource({ uri: 'loom://graphs/catalog' })
    assert.equal(JSON.parse(catalog.contents[0].text).graphs[0].id, 'test')
  } finally { await client.close() }
  assert.equal((await fetch(origin + '/other')).status, 404)
  assert.equal((await fetch(resourceUrl, { headers: { origin: 'https://another.example' } })).status, 403)
  await assert.rejects(graphHttpHandler(factory, { resourceUrl: 'https://graphs.example/mcp' }), /requires an OAuth issuer/)
})

test('provider discovery and audience-bound read access over HTTP', async t => {
  const auth = await listener(t), graph = await listener(t)
  const issuer = auth.origin + '/realm', resourceUrl = graph.origin + '/mcp'
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const keys = { keys: [{ ...await exportJWK(publicKey), alg: 'RS256', kid: 'current', use: 'sig' }] }
  const metadata = { issuer, jwks_uri: auth.origin + '/keys', authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token' }
  auth.server.on('request', (req, res) => {
    const body = req.url === '/keys' ? keys : req.url === '/realm/.well-known/openid-configuration' ? metadata : null
    res.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
  })
  graph.server.on('request', await graphHttpHandler(factory, { issuer, resourceUrl }))
  const challenge = await fetch(resourceUrl, { method: 'POST' })
  assert.equal(challenge.status, 401)
  const metadataUrl = graph.origin + '/.well-known/oauth-protected-resource/mcp'
  assert.ok(challenge.headers.get('www-authenticate').includes('resource_metadata="' + metadataUrl + '"'))
  const resource = await (await fetch(metadataUrl)).json()
  assert.deepEqual([resource.resource, resource.authorization_servers, resource.scopes_supported], [resourceUrl, [issuer], ['graph:read']])
  const claims = { iss: issuer, aud: resourceUrl, exp: Math.floor(Date.now() / 1000) + 300, scope: 'graph:read', azp: 'local-reader' }
  const sign = (changes = {}) => new SignJWT({ ...claims, ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'current' }).sign(privateKey)
  for (const [changes, status] of [[{ aud: 'another-resource' }, 401], [{ iss: issuer + '/other' }, 401],
    [{ exp: 1 }, 401], [{ exp: undefined }, 401], [{ scope: 'other' }, 403]]) {
    const rejected = await fetch(resourceUrl, { method: 'POST', headers: { authorization: 'Bearer ' + await sign(changes) } })
    assert.equal(rejected.status, status)
    assert.match(rejected.headers.get('www-authenticate'), status === 403 ? /insufficient_scope/ : /invalid_token/)
  }
  const client = new Client({ name: 'http-oauth', version: '1' })
  try {
    const token = await sign({ aud: ['other-api', resourceUrl], client_id: 'registered-reader' })
    await client.connect(new StreamableHTTPClientTransport(new URL(resourceUrl), { authProvider: { token: () => token } }))
    const result = await client.callTool({ name: 'get_node', arguments: { graph: 'test', id: 'a' } })
    assert.equal(result.structuredContent.node.id, 'a')
  } finally { await client.close() }
  metadata.issuer = 'https://different.example/'
  await assert.rejects(graphHttpHandler(factory, { issuer, resourceUrl }), /differs from the configured issuer/)
})
