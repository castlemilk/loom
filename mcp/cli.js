#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createLoomMcpServerFactory, loadBuiltinGraphs, loadGraphFile } from './server.js'

try {
  const { values } = parseArgs({ options: {
    graph: { type: 'string' }, http: { type: 'boolean' }, port: { type: 'string' },
    issuer: { type: 'string' }, 'resource-url': { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } })
  if (values.help) {
    console.log(`loom-graph-mcp [--graph /path/to/scene.json] [--http [--port 7341] [--issuer URL] [--resource-url URL]]
Serve graph tools over stdio (default) or Streamable HTTP at http://127.0.0.1:7341/mcp.
--issuer enables OAuth with an OpenID Connect provider. Use --resource-url for the public HTTPS endpoint behind a reverse proxy.`)
  } else {
    if (!values.http && [values.port, values.issuer, values['resource-url']].some(value => value !== undefined)) {
      throw new Error('--port, --issuer and --resource-url require --http.')
    }
    const sources = values.graph === undefined ? await loadBuiltinGraphs() : [await loadGraphFile(values.graph)]
    const factory = createLoomMcpServerFactory(sources)
    if (values.http) {
      const advertised = values['resource-url'] === undefined ? null : new URL(values['resource-url'])
      const port = Number(values.port ?? (advertised?.protocol === 'http:' ? advertised.port || 80 : 7341))
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a port from 1 to 65535.')
      const { createServer } = await import('node:http')
      const { graphHttpHandler } = await import('./http.js')
      const resourceUrl = values['resource-url'] ?? 'http://127.0.0.1:' + port + '/mcp'
      const server = createServer(await graphHttpHandler(factory, { resourceUrl, issuer: values.issuer }))
      server.on('error', error => { console.error(error.message); process.exitCode = 1 })
      server.listen(port, advertised?.hostname === '[::1]' ? '::1' : '127.0.0.1',
        () => console.error('Loom Graph MCP · ' + resourceUrl + (values.issuer ? ' · OAuth required' : ' · local HTTP')))
    } else {
      serveStdio(factory, { onerror: error => console.error(error.message) })
    }
  }
} catch (error) {
  console.error('Loom Graph MCP: ' + error.message)
  process.exitCode = 1
}
