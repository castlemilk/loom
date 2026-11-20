import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import pkg from '../package.json' with { type: 'json' }

const base = process.argv[2]
const archive = pkg.name + '-' + pkg.version + '.tgz'
const spec = /^https?:/.test(base) ? new URL(archive, base).href : resolve(base, archive)
const cwd = await mkdtemp(join(tmpdir(), 'loom-installed-mcp-'))
const client = new Client({ name: 'loom-package-consumer', version: '1' })
try {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', spec], { cwd, stdio: 'inherit' })
  await writeFile(join(cwd, 'consumer.mts'), `
import { createLoomMcpServer, createLoomMcpServerFactory, loadBuiltinGraphs, loadGraphFile, type KnowledgeGraph } from 'loom-graph-mcp'
interface Article { id: string; revision: number }
interface Citation { source: string; target: string; page: number }
const graph: KnowledgeGraph<Article, Citation> = {
  id: 'citations', name: 'Citations',
  data: { nodes: [{ id: 'one', revision: 10 }], links: [{ source: 'one', target: 'one', page: 4 }] },
  async evidence(from, to) { return { revisions: [from.revision, to.revision] } }
}
createLoomMcpServer([graph])
createLoomMcpServerFactory([graph])()
createLoomMcpServer(await loadBuiltinGraphs())
createLoomMcpServer([await loadGraphFile('scene.json')])
// @ts-expect-error Node IDs are strings in every document.
createLoomMcpServer([{ id: 'x', name: 'Invalid', data: { nodes: [{ id: 123 }], links: [] } }])
`)
  const compiler = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url))
  execFileSync(process.execPath, [compiler, '--strict', '--skipLibCheck', '--noEmit', '--target', 'ES2022',
    '--module', 'NodeNext', 'consumer.mts'], { cwd, stdio: 'inherit' })
  await client.connect(new StdioClientTransport({ command: join(cwd, 'node_modules/.bin/loom-graph-mcp'), args: [], cwd }))
  const { structuredContent } = await client.callTool({ name: 'get_connection', arguments: { graph: 'wikispeedia', from: 'article:74', to: 'article:2863' } })
  assert.match(structuredContent.evidence.excerpt, /audible sounds/)
  console.log('Installed Graph MCP and verified the Music → Sound source passage over stdio.')
  const studioScene = process.argv[3]
  if (studioScene) {
    const sceneClient = new Client({ name: 'loom-studio-export', version: '1' })
    try {
      await sceneClient.connect(new StdioClientTransport({ command: join(cwd, 'node_modules/.bin/loom-graph-mcp'),
        args: ['--graph', resolve(studioScene)], cwd }))
      const catalog = (await sceneClient.callTool({ name: 'list_graphs', arguments: {} })).structuredContent.graphs
      assert.deepEqual(catalog.map(g => [g.id, g.name, g.nodes, g.links]), [['local', 'Studio signal path', 2, 1]])
      const edge = await sceneClient.callTool({ name: 'get_connection', arguments: { graph: 'local', from: 'emitter', to: 'receiver' } })
      assert.equal(edge.structuredContent.items[0].kind, 'feeds')
      console.log('Queried the graph authored and downloaded by the Studio browser test.')
    } finally { await sceneClient.close() }
  }
} finally {
  await client.close()
  await rm(cwd, { recursive: true, force: true })
}
