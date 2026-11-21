import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { indexGraph, searchNodes, getNeighbors, getConnection, shortestPath } from './query.js'
import pkg from './package.json' with { type: 'json' }

export { loadBuiltinGraphs, loadGraphFile } from './catalog.js'

const icons = [{ src: 'data:image/png;base64,' + readFileSync(new URL('./data/icon.png', import.meta.url)).toString('base64'), mimeType: 'image/png', sizes: ['256x256'] }]
const browserUri = 'ui://loom/graph-browser.html'
const browserMime = 'text/html;profile=mcp-app'
const browserMeta = { ui: { resourceUri: browserUri } }
const entrypointMeta = { ...browserMeta, 'openai/ui': { entrypoints: [{ type: 'global' }] } }
const resourceMeta = { ui: { csp: { connectDomains: [], resourceDomains: [] } },
  'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'] } }
const graph = z.string().min(1).describe('Graph ID from list_graphs')
const nodeId = z.string().min(1).describe('Exact node ID from search_nodes or get_neighbors')
const count = z.number().int().nonnegative()
const pagination = { offset: count.default(0), limit: z.number().int().min(1).max(50).default(10) }
const direction = z.enum(['incoming', 'outgoing'])
const ref = z.object({ id: nodeId, label: z.string(), uri: z.string(), kind: z.string().nullish(), section: z.string().nullish() })
const pageOf = item => ({ items: z.array(item), total: count, nextOffset: count.nullable() })
const outputs = {
  list_graphs: { graphs: z.array(z.object({ id: graph, name: z.string(), nodes: count, links: count,
    source: z.string().optional(), attribution: z.string().optional(), licenseUrl: z.string().optional() })) },
  search_nodes: pageOf(ref),
  get_node: { node: z.looseObject({ id: nodeId }), uri: z.string(), incoming: count, outgoing: count },
  get_neighbors: { ...pageOf(z.object({ node: ref, linkCount: count })), direction },
  get_connection: { from: ref, to: ref, ...pageOf(z.looseObject({ source: nodeId, target: nodeId })),
    evidence: z.record(z.string(), z.unknown()).nullable() },
  find_path: { found: z.boolean(), hops: count.optional(), maxHops: count.optional(), path: z.array(ref) },
}

export function createLoomMcpServerFactory(sources) {
  const graphs = new Map()
  for (const source of sources) {
    if (!source.id || graphs.has(source.id)) throw new Error('Expected a unique non-empty graph ID: ' + source.id)
    graphs.set(source.id, indexGraph(source))
  }
  const catalog = { graphs: [...graphs.values()].map(g => g.info) }
  function collection(id) {
    const g = graphs.get(id)
    if (!g) throw new Error('Unknown graph: ' + id + '. Use list_graphs to discover its ID.')
    return g
  }
  return () => registerServer(catalog, collection)
}

export function createLoomMcpServer(sources) {
  return createLoomMcpServerFactory(sources)()
}

function registerServer(catalog, collection) {
  const server = new McpServer({ name: pkg.name, version: pkg.version, title: 'Loom Graph MCP', websiteUrl: pkg.homepage, icons },
    { instructions: 'List the available graphs, search for exact node IDs, then follow directed links. Cite source URLs when reporting article evidence.' })
  function tool(name, title, description, shape, query, meta) {
    server.registerTool(name, { title, description, inputSchema: z.object(shape), outputSchema: z.object(outputs[name]),
      ...(meta && { _meta: meta }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
      async args => {
        const result = await query(args)
        return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }
      })
  }
  tool('list_graphs', 'Loom graph browser', 'List available graph IDs, sizes and source attribution.', {}, () => catalog, entrypointMeta)
  tool('search_nodes', 'Search nodes', 'Search labels, IDs, sections, kinds and summaries. Exact labels rank first.', {
    graph, query: z.string().trim().min(1), ...pagination,
  }, args => searchNodes(collection(args.graph), args))
  tool('get_node', 'Read a node', 'Read the original node fields and incoming and outgoing edge counts.', { graph, id: nodeId },
    args => collection(args.graph).details(args.id))
  tool('get_neighbors', 'Browse neighbors', 'Follow incoming or outgoing links. Parallel links count toward the same neighbor.', {
    graph, id: nodeId, direction: direction.default('outgoing'), ...pagination,
  }, args => getNeighbors(collection(args.graph), args))
  tool('get_connection', 'Inspect a connection', 'Read directed edges between two nodes and the archived Wikipedia passage when available. A missing passage is returned as null.', {
    graph, from: nodeId, to: nodeId, ...pagination,
  }, args => getConnection(collection(args.graph), args), browserMeta)
  tool('find_path', 'Trace a path', 'Find a shortest directed path within the maxHops limit. Use get_connection to inspect any step.', {
    graph, from: nodeId, to: nodeId, maxHops: z.number().int().min(0).max(8).default(4),
  }, args => shortestPath(collection(args.graph), args.from, args.to, args.maxHops))
  const resource = (uri, result) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(result) }] })
  server.registerResource('graph-catalog', 'loom://graphs/catalog', { title: 'Loom graph catalog', mimeType: 'application/json' }, uri => resource(uri, catalog))
  server.registerResource('graph-browser', browserUri, { title: 'Loom graph browser', mimeType: browserMime, _meta: resourceMeta },
    async uri => ({ contents: [{ uri: uri.href, mimeType: browserMime, _meta: resourceMeta,
      text: await readFile(new URL('./data/graph-browser.html', import.meta.url), 'utf8') }] }))
  server.registerResource('graph-node', new ResourceTemplate('loom://graphs/node?graph={graph}&id={id}', { list: undefined }),
    { title: 'Loom graph node', mimeType: 'application/json' }, uri => resource(uri, collection(uri.searchParams.get('graph')).details(uri.searchParams.get('id'))))
  return server
}
