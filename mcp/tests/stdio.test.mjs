import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const cli = fileURLToPath(new URL('../cli.js', import.meta.url))
async function withClient(args, verify, env) {
  const client = new Client({ name: 'loom-integration', version: '1.0.0' })
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, ...args], env }))
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args })
      assert.ok(!result.isError, JSON.stringify(result.content))
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
      return result.structuredContent
    }
    await verify(client, call)
  } finally { await client.close() }
}

test('a stdio client discovers and traverses the shipped Wikipedia and console graphs', async () => {
  await withClient([], async (client, call) => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map(t => t.name).sort(), ['find_path', 'get_connection', 'get_neighbors', 'get_node', 'list_graphs', 'search_nodes'])
    assert.ok(tools.every(t => t.annotations.readOnlyHint))
    assert.ok(tools.every(t => t.inputSchema.type === 'object' && t.outputSchema.type === 'object'))
    assert.match(client.getServerVersion().icons[0].src, /^data:image\/png;base64,/)
    const catalog = await call('list_graphs', {})
    const resource = (await client.listResources()).resources[0]
    assert.deepEqual(JSON.parse((await client.readResource({ uri: resource.uri })).contents[0].text), catalog)
    assert.deepEqual(catalog.graphs.map(g => [g.id, g.nodes, g.links]),
      [['wikispeedia',4604,119882], ['knowledge',508,746], ['bauhaus',15,52], ['outer-solar-system',16,62]])
    const graph = 'wikispeedia'
    const search = await call('search_nodes', { graph, query: 'Music', limit: 1 })
    assert.equal(search.items[0].id, 'article:74')
    const from = search.items[0].id, to = 'article:2863'
    const details = await call('get_node', { graph, id: from })
    assert.deepEqual(JSON.parse((await client.readResource({ uri: details.uri })).contents[0].text), details)
    const link = await call('get_connection', { graph, from, to })
    assert.equal(link.to.label, 'Sound')
    assert.match(link.evidence.excerpt, /audible sounds/)
    assert.equal(link.evidence.sourceUrl, 'https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm')
    assert.deepEqual((await call('find_path', { graph, from, to })).path.map(n => n.id), [from,to])
    const first = await call('get_neighbors', { graph, id: from, limit: 1 })
    const second = await call('get_neighbors', { graph, id: from, limit: 1, offset: first.nextOffset })
    assert.notEqual(first.items[0].node.id, second.items[0].node.id)
    assert.equal((await call('search_nodes', { graph: 'knowledge', query: 'Accelerator-day' })).items[0].id, 'concept:accelerator-day')
    assert.equal((await client.callTool({ name: 'get_node', arguments: { graph, id: 'missing' } })).isError, true)
  })
})

test('a client can discover the modern server and then use an initialize-based connection', { timeout: 10000 }, async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli] })
  const clientInfo = { name: 'loom-compatibility', version: '1' }
  let sequence = 0
  function request(method, params) {
    const id = ++sequence
    return new Promise((resolve, reject) => {
      transport.onmessage = message => {
        if (message.id === id) message.error ? reject(new Error(message.error.message)) : resolve(message.result)
      }
      transport.send({ jsonrpc: '2.0', id, method, params }).catch(reject)
    })
  }
  try {
    await transport.start()
    const discovery = await request('server/discover', { _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {}, 'io.modelcontextprotocol/clientInfo': clientInfo,
    } })
    assert.ok(discovery.supportedVersions.includes('2026-07-28'))
    const session = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo })
    assert.equal(session.protocolVersion, '2025-11-25')
    await transport.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    assert.equal((await request('tools/list', {})).tools.length, 6)
  } finally { await transport.close() }
})

test('a Studio scene preserves custom fields, direction, parallel edges and opaque IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'loom-mcp-scene-'))
  const special = 'A / %2F+? &#Ω'
  try {
    const file = join(dir, 'my graph.json')
    await writeFile(file, JSON.stringify({ version: 1, data: { nodes: [{ id: special, label: 'Alpha', note: 'a custom field' }, { id: 'b' }, { id: 'c' }],
      links: [{ source: special, target: 'b', kind: 'first' }, { source: special, target: 'b', kind: 'again' }, { source: 'b', target: 'c' }, { source: 'c', target: 'c' }] } }))
    await withClient(['--graph', file], async (client, call) => {
      const graph = 'local'
      assert.deepEqual((await call('list_graphs', {})).graphs.map(g => g.id), [graph])
      const node = await call('get_node', { graph, id: special })
      assert.equal(JSON.parse((await client.readResource({ uri: node.uri })).contents[0].text).node.note, 'a custom field')
      assert.equal((await call('get_neighbors', { graph, id: 'b', direction: 'incoming' })).items[0].linkCount, 2)
      const connection = await call('get_connection', { graph, from: special, to: 'b', offset: 1, limit: 1 })
      assert.equal(connection.items[0].kind, 'again')
      assert.equal(connection.evidence, null)
      assert.equal((await call('get_connection', { graph, from: 'b', to: special })).total, 0)
      assert.equal((await call('find_path', { graph, from: special, to: 'c', maxHops: 1 })).found, false)
      assert.deepEqual((await call('find_path', { graph, from: special, to: 'c' })).path.map(n => n.id), [special,'b','c'])
      assert.equal((await call('find_path', { graph, from: 'c', to: 'c', maxHops: 0 })).hops, 0)
      assert.equal((await client.callTool({ name: 'search_nodes', arguments: { graph, query: 'a', limit: 100 } })).isError, true)
    }, { LOOM_GRAPH_FILE: join(dir, 'wrong-file.json') })
    await withClient([], async (_client, call) => {
      assert.deepEqual((await call('list_graphs', {})).graphs.map(g => [g.id, g.nodes]), [['local', 3]])
    }, { LOOM_GRAPH_FILE: file })
    await writeFile(file, JSON.stringify({ nodes: [{ id: 'a' }], links: [{ source: 'a', target: 'missing' }] }))
    const broken = spawnSync(process.execPath, [cli], { env: { ...process.env, LOOM_GRAPH_FILE: file }, encoding: 'utf8' })
    assert.equal(broken.status, 1)
    assert.equal(broken.stdout, '')
    assert.match(broken.stderr, /Unknown node/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
