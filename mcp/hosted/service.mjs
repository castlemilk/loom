import { createPublicKey } from 'node:crypto'
import { createServer } from 'node:http'
import { createLoomMcpServerFactory, loadBuiltinGraphs } from '../server.js'
import { graphHttpHandler } from '../http.js'
import { guestProvider } from './provider.mjs'
import { openStore } from './store.mjs'

export async function hostedService({ issuer, callback, database, revision }) {
  const base = new URL(issuer), redirect = new URL(callback)
  for (const url of [base, redirect]) {
    if (!(url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1')) || url.username || url.password || url.search || url.hash) {
      throw new Error('Configure HTTPS or a loopback test URL.')
    }
  }
  if (issuer !== base.origin) throw new Error('The hosted issuer must be an origin.')
  const store = openStore(database)
  try {
    const auth = guestProvider({ issuer, callback, store })
    const key = createPublicKey({ key: store.jwk, format: 'jwk' }).export({ format: 'jwk' })
    const handler = await graphHttpHandler(createLoomMcpServerFactory(await loadBuiltinGraphs()), {
      issuer, resourceUrl: issuer + '/mcp', browserOrigin: redirect.origin,
      issuerJwks: { keys: [{ ...key, alg: 'RS256', use: 'sig', kid: store.jwk.kid }] },
    })
    const server = createServer({ maxHeaderSize: 16_384, requestTimeout: 30_000 }, (req, res) => {
      const path = req.url.split('?')[0]
      if (path === '/healthz' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ status: 'ready', revision })); return
      }
      if (req.headers.host !== base.host) { res.writeHead(403).end(); return }
      if (path === '/') { res.writeHead(302, { Location: callback }).end(); return }
      // The public gateway terminates TLS. Never derive the issuer or callback from forwarded client input.
      req.headers['x-forwarded-proto'] = base.protocol.slice(0, -1)
      req.headers['x-forwarded-host'] = base.host
      const graph = path === '/mcp' || path === '/.well-known/oauth-protected-resource/mcp'
      Promise.resolve(graph ? handler(req, res) : auth(req, res, path)).catch(() => {
        if (!res.headersSent) res.writeHead(500, { 'Cache-Control': 'no-store' })
        res.end('Could not complete the request.')
      })
    })
    server.once('close', () => store.close())
    return server
  } catch (error) { store.close(); throw error }
}
