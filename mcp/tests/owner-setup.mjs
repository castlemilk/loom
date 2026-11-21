import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { serveExport } from '../../scripts/serve-export.mjs'
import pkg from '../package.json' with { type: 'json' }

const published = process.argv.slice(2).find(arg => /^https?:/.test(arg))
const local = published ? null : await serveExport((process.env.PAGES_BASE_PATH ?? '/loom') + '/')
const home = published || local.url
const temp = await realpath(await mkdtemp(join(tmpdir(), 'loom owner ')))
const path = join(temp, "Owner's graph.json")
const graph = { name: 'Library services', nodes: [{ id: 'catalog', label: 'Catalog' }, { id: 'library', label: 'Library team' }],
  links: [{ source: 'catalog', target: 'library', kind: 'maintained_by', record: 'owner-e2e-917' }] }
let browser, client
try {
  await writeFile(path, JSON.stringify(graph))
  browser = await chromium.launch({ channel: process.env.LOOM_BROWSER_CHANNEL || 'chrome' })
  const page = await browser.newPage()
  const leaks = []
  page.on('request', request => {
    if ((request.url() + (request.postData() || '')).includes('owner-e2e-917')) leaks.push(request.url())
  })
  await page.goto(new URL('mcp/', home).href)
  await page.getByRole('link', { name: 'Connect my graph' }).first().click()
  const setup = page.locator('#connect'), file = setup.getByLabel('Preview a graph file')
  const snippet = setup.locator('.mcp-connect > figure pre')
  await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"nodes":[{"id":"a"}],"links":[{"source":"a","target":"missing"}]}') })
  await setup.getByRole('alert').filter({ hasText: /Unknown node/ }).waitFor()
  await setup.getByLabel('Path on your computer').fill(path)
  assert.equal(await snippet.count(), 0)
  await file.setInputFiles({ name: 'single.json', mimeType: 'application/json', buffer: Buffer.from('{"data":{"nodes":[{"id":"Only node"}],"links":[]}}') })
  await setup.getByText('get_node', { exact: true }).waitFor()
  await file.setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from('{"nodes":[],"edges":[]}') })
  await setup.getByText('list_graphs', { exact: true }).waitFor()
  await file.setInputFiles(path)
  await setup.getByRole('heading', { name: 'Catalog → Library team' }).waitFor()
  await setup.locator('.owner-receipt summary').click()
  const preview = JSON.parse(await setup.locator('.owner-receipt pre').innerText())
  assert.deepEqual(preview.result.items, graph.links)
  assert.deepEqual(leaks, [])

  const picker = setup.getByLabel('MCP client', { exact: true })
  const commands = {}, folderCommands = {}
  for (const host of ['Codex', 'Claude Code']) {
    await picker.selectOption(host)
    folderCommands[host] = await snippet.innerText()
  }
  await setup.getByLabel('Path on your computer').fill(path)
  for (const host of ['Codex', 'Claude Code']) {
    await picker.selectOption(host)
    commands[host] = await snippet.innerText()
  }
  await picker.selectOption('Client JSON')
  const config = JSON.parse(await snippet.innerText()).mcpServers['my-graph']
  assert.equal(config.command, 'npx')
  const archive = new URL(config.args[1].slice('--package='.length))
  assert.equal(archive.origin, new URL(home).origin)
  const revision = published && (await (await page.request.get(new URL('revision.txt?sha=' + (process.env.GITHUB_SHA || ''), home).href)).text()).trim()
  if (published) assert.match(revision, /^[a-f0-9]{40}$/)
  assert.equal(archive.href, new URL((published ? 'packages/' + revision + '/' : '') + pkg.name + '-' + pkg.version + '.tgz', home).href)
  assert.deepEqual(config.args, ['--yes', '--package=' + archive.href, 'loom-graph-mcp', '--graph', path])
  const quotedPath = "'" + path.replaceAll("'", "'\\''") + "'"
  for (const [host, cli] of [['Codex', 'codex'], ['Claude Code', 'claude']]) {
    assert.equal(commands[host], cli + ' mcp add my-graph -- npx ' + config.args.slice(0, -1).join(' ') + ' ' + quotedPath)
    assert.equal(folderCommands[host], commands[host].slice(0, -quotedPath.length) + '"$PWD"/' + "'Owner'\\''s graph.json'")
  }

  client = new Client({ name: 'graph-owner', version: '1' })
  await client.connect(new StdioClientTransport({ ...config, cwd: temp }))
  const catalog = await client.callTool({ name: 'list_graphs', arguments: {} })
  assert.deepEqual(catalog.structuredContent.graphs.map(g => [g.id, g.name, g.nodes, g.links]), [['local', graph.name, 2, 1]])
  assert.equal((await client.listTools()).tools.length, 6)
  const actual = await client.callTool({ name: preview.name, arguments: preview.arguments })
  assert.deepEqual(actual.structuredContent, preview.result)
  console.log('The generated configuration launched the packaged MCP server and returned the same custom relationship as the private browser preview.')
  if (process.argv.includes('--hosts')) {
    const run = promisify(execFile)
    const codexProfile = join(temp, 'codex'), claudeProfile = join(temp, 'claude')
    await Promise.all([mkdir(codexProfile), mkdir(claudeProfile)])
    const options = { cwd: temp, env: { ...process.env, CODEX_HOME: codexProfile, CLAUDE_CONFIG_DIR: claudeProfile }, timeout: 90_000 }
    // Only execute commands after verifying every argument and the expected archive above.
    for (const command of Object.values(folderCommands)) await run('/bin/sh', ['-c', command], options)
    const registered = JSON.parse((await run('codex', ['mcp', 'get', 'my-graph', '--json'], options)).stdout)
    assert.deepEqual(registered.transport.args, config.args)
    assert.match((await run('claude', ['mcp', 'get', 'my-graph'], options)).stdout, /Connected/)
    console.log('Fresh Codex and Claude Code profiles accepted both commands, including the quoted graph path.')
  }
} finally {
  await client?.close()
  await browser?.close()
  local?.close()
  await rm(temp, { recursive: true, force: true })
}
