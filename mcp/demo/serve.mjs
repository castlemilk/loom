import { createServer } from 'node:http'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { build } from 'esbuild'
import { createLoomMcpServerFactory, loadBuiltinGraphs } from '../server.js'
import { graphHttpHandler } from '../http.js'
import { buildInstallers, desktopFile, marketplaceFile } from '../distribution.mjs'

const port = Number(process.env.LOOM_DEMO_PORT ?? 7341)
const origin = 'http://127.0.0.1:' + port
const resourceUrl = origin + '/mcp'
const profile = process.env.LOOM_DEMO_PROFILE ?? 'keycloak'
if (!['keycloak', 'local'].includes(profile)) throw new Error('Choose PROVIDER=keycloak or PROVIDER=local.')
const useLocal = !process.env.LOOM_DEMO_ISSUER && profile === 'local'
const providerPort = Number(process.env.LOOM_DEMO_PROVIDER_PORT ?? (useLocal ? 8181 : 8180))
const issuer = process.env.LOOM_DEMO_ISSUER ?? ('http://127.0.0.1:' + providerPort + (useLocal ? '' : '/realms/loom'))
if (process.env.LOOM_DEMO_ISSUER && !process.env.LOOM_DEMO_CLIENT_ID) throw new Error('Set LOOM_DEMO_CLIENT_ID to your registered public client ID.')
const config = { resource: resourceUrl, issuer, clientId: process.env.LOOM_DEMO_CLIENT_ID ?? 'loom-walkthrough',
  provider: process.env.LOOM_DEMO_PROVIDER ?? (process.env.LOOM_DEMO_ISSUER ? new URL(issuer).hostname : useLocal ? 'oidc-provider' : 'Keycloak'),
  localRealm: !process.env.LOOM_DEMO_ISSUER,
  marketplaceURL: '/demo/downloads/' + marketplaceFile, desktopURL: '/demo/downloads/' + desktopFile }

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./client.jsx', import.meta.url))], outfile: 'client.js',
  nodePaths: [fileURLToPath(new URL('../../web/node_modules', import.meta.url))],
  bundle: true, write: false, jsx: 'automatic', format: 'esm', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
})
const assets = new Map(bundle.outputFiles.map(file => [file.path.endsWith('.css') ? '/demo/client.css' : '/demo/client.js', file.contents]))
const page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Loom · Live MCP connection</title><link rel="stylesheet" href="/demo/client.css"><main id="demo"></main><script type="module" src="/demo/client.js"></script></html>'

const localProvider = useLocal ? await (await import('./local-provider.mjs')).startLocalProvider(config) : null
if (config.localRealm && !useLocal) {
  const discovery = issuer + '/.well-known/openid-configuration'
  const deadline = Date.now() + 240_000
  while (!(await fetch(discovery, { signal: AbortSignal.timeout(1500) }).then(r => r.ok, () => false))) {
    if (Date.now() >= deadline) throw new Error('Keycloak did not start on port ' + providerPort + ' in four minutes.')
    await delay(500)
  }
}
const handler = await graphHttpHandler(createLoomMcpServerFactory(await loadBuiltinGraphs()), { issuer, resourceUrl })
let installers
const server = createServer((req, res) => {
  if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return }
  const path = new URL(req.url, origin).pathname
  if (!path.startsWith('/demo/')) return handler(req, res)
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }).end(); return }
  if (path === config.marketplaceURL || path === config.desktopURL) {
    const filename = path === config.marketplaceURL ? marketplaceFile : desktopFile
    installers ??= buildInstallers().catch(error => { installers = undefined; throw error })
    installers.then(packages => {
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="' + filename + '"' }).end(packages.get(filename))
    }, () => res.writeHead(500).end('Could not build the installers. Retry the download.'))
    return
  }
  const body = path === '/demo/' ? page : path === '/demo/config.json' ? JSON.stringify(config) : assets.get(path)
  if (body === undefined) { res.writeHead(404).end(); return }
  const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' :
    path.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }).end(body)
})
server.listen(port, '127.0.0.1')
await once(server, 'listening')
console.log('Open ' + origin + '/demo/ for a live ' + config.provider + ' sign-in. Ctrl+C closes the demo.')
if (process.argv.includes('--test')) {
  try {
    const { testOAuthDemo } = await import('../../tests/mcp-oauth.mjs')
    await testOAuthDemo(config, process.argv.includes('--record'))
  } finally { server.close(); localProvider?.close() }
}
