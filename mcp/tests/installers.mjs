import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { unzipSync } from 'fflate'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { OpenAIUiResourceMetadataSchema, OpenAIUiToolMetadataSchema } from '@openai/mcp-extensions/server'
import { marketplaceFile, desktopFile } from '../distribution.mjs'
import pkg from '../package.json' with { type: 'json' }

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'))
const base = resolve(process.argv[2])
const temp = await mkdtemp(join(tmpdir(), 'loom plugin test '))
const market = join(temp, 'loom-marketplace'), desktop = join(temp, 'desktop')
const expected = 'loom-graph@loom'

async function extract(filename, target) {
  for (const [name, bytes] of Object.entries(unzipSync(await readFile(join(base, filename))))) {
    const path = resolve(target, name)
    assert.ok(path.startsWith(target + sep), 'Package entry must stay inside the install directory')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
  }
}

async function verify(config, dir, variable) {
  const client = new Client({ name: 'loom-plugin-consumer', version: '1' })
  try {
    const args = config.args.map(arg => variable ? arg.replace(variable, dir) : arg)
    await client.connect(new StdioClientTransport({ command: config.command, args, cwd: temp }))
    assert.equal(client.getServerVersion().version, pkg.version)
    const { tools } = await client.listTools()
    assert.equal(tools.length, 6)
    const catalog = tools.find(t => t.name === 'list_graphs')
    assert.deepEqual(OpenAIUiToolMetadataSchema.parse(catalog._meta['openai/ui']).entrypoints, [{ type: 'global' }])
    const uri = tools.find(t => t.name === 'get_connection')._meta.ui.resourceUri
    assert.equal(catalog._meta.ui.resourceUri, uri)
    const [view] = (await client.readResource({ uri })).contents
    assert.equal(view.mimeType, 'text/html;profile=mcp-app')
    assert.ok(OpenAIUiResourceMetadataSchema.parse(view._meta['openai/ui']).availableDisplayModes.includes('inline'))
    assert.match(view.text, /<title>Loom graph browser<\/title>/)
    assert.equal((await client.callTool({ name: catalog.name, arguments: {} })).structuredContent.graphs.length, 4)
    const result = await client.callTool({ name: 'get_connection', arguments: { graph: 'wikispeedia', from: 'article:74', to: 'article:2863' } })
    assert.match(result.structuredContent.evidence.excerpt, /audible sounds/)
    assert.equal(result.structuredContent.evidence.sourceUrl, 'https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm')
  } finally { await client.close() }
}

try {
  await extract(marketplaceFile, temp)
  await extract(desktopFile, desktop)
  const codexMarket = await readJSON(join(market, '.agents/plugins/marketplace.json'))
  const claudeMarket = await readJSON(join(market, '.claude-plugin/marketplace.json'))
  assert.equal(codexMarket.name, claudeMarket.name)
  const dir = join(market, codexMarket.plugins[0].source.path)
  assert.equal(dir, join(market, claudeMarket.plugins[0].source))
  const plugin = await readJSON(join(dir, 'plugin.json'))
  const claude = await readJSON(join(dir, '.claude-plugin/plugin.json'))
  assert.equal(plugin.name + '@' + codexMarket.name, expected)
  assert.equal(plugin.version, pkg.version)
  assert.equal(claude.name, plugin.name)
  assert.equal(claude.version, pkg.version)
  const extension = await readJSON(join(desktop, 'manifest.json'))
  assert.equal(extension.version, pkg.version)
  await verify(extension.server.mcp_config, desktop, '${__dirname}')
  await verify((await readJSON(join(dir, 'mcp.json'))).mcpServers.loom, dir, '${PLUGIN_ROOT}')
  await verify(claude.mcpServers.loom, dir, '${CLAUDE_PLUGIN_ROOT}')
  console.log('Verified both marketplace launchers and the desktop extension, including the MCP App and archived evidence.')

  if (process.argv.includes('--hosts')) {
    const codexHome = join(temp, 'codex'), claudeHome = join(temp, 'claude')
    await Promise.all([mkdir(codexHome), mkdir(claudeHome)])
    function run(cli, ...args) {
      return execFileSync(cli, args, { cwd: temp, encoding: 'utf8', timeout: 90_000,
        env: { ...process.env, CODEX_HOME: codexHome, CLAUDE_CONFIG_DIR: claudeHome } })
    }
    run('codex', 'plugin', 'marketplace', 'add', market, '--json')
    const installed = JSON.parse(run('codex', 'plugin', 'add', expected, '--json'))
    assert.equal(installed.version, pkg.version)
    const server = JSON.parse(run('codex', 'mcp', 'list', '--json')).find(s => s.name === 'loom')
    assert.ok(server.enabled && server.transport.args[0].startsWith(installed.installedPath + sep))
    await verify(server.transport)
    run('claude', 'plugin', 'marketplace', 'add', market, '--json')
    run('claude', 'plugin', 'install', expected, '--json')
    assert.match(run('claude', 'mcp', 'list'), /plugin:loom-graph:loom:.*Connected/)
    console.log('Codex and Claude Code installed Loom Graph from the ZIP in clean profiles and connected to the registered servers.')
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}
