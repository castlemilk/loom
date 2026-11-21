import { build } from 'esbuild'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync, strToU8 } from 'fflate'
import pkg from './package.json' with { type: 'json' }

const root = fileURLToPath(new URL('../', import.meta.url))
const mcp = join(root, 'mcp')
export const marketplaceFile = 'loom-marketplace-' + pkg.version + '.zip'
export const desktopFile = 'loom-graph-' + pkg.version + '.mcpb'
const json = value => strToU8(JSON.stringify(value, null, 2) + '\n')

export async function dependencyNotices(inputs) {
  const packages = new Set()
  for (const path of Object.keys(inputs)) {
    const match = resolve(root, path).split(sep).join('/').match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//)
    if (match) packages.add(match[1])
  }
  const notices = []
  for (const dir of [...packages].sort()) {
    const { name, version } = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    for (const filename of (await readdir(dir)).filter(f => /^(licen[cs]e|notice|copying)(?:[.-]|$)/i.test(f)).sort()) {
      notices.push(name + ' ' + version + '\n' + await readFile(join(dir, filename), 'utf8'))
    }
  }
  return notices.join('\n\n')
}

async function filesIn(dir, prefix = '') {
  const files = {}
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const path = join(dir, entry.name), name = prefix + entry.name
    if (entry.isDirectory()) Object.assign(files, await filesIn(path, name + '/'))
    else if (entry.isFile()) files[name] = await readFile(path)
  }
  return files
}

export async function buildInstallers() {
  const bundle = await build({ absWorkingDir: root, entryPoints: ['mcp/cli.js'], bundle: true, platform: 'node',
    format: 'esm', target: 'node22.14', minify: true, metafile: true, write: false,
    banner: { js: "import { createRequire as loomCreateRequire } from 'node:module'; const require = loomCreateRequire(import.meta.url);" } })
  const name = 'loom-graph', displayName = 'Loom Graph', author = { name: 'Loom' }
  const descriptor = { name, version: pkg.version, description: pkg.description, author, homepage: pkg.homepage, license: pkg.license }
  const entry = 'server/index.mjs'
  const command = variable => ({ command: 'node', args: [variable + '/' + entry] })
  const payload = {
    [entry]: bundle.outputFiles[0].contents,
    ...await filesIn(join(mcp, 'data'), 'server/data/'),
    ...await filesIn(join(mcp, 'data-licenses'), 'data-licenses/'),
    'LICENSE': await readFile(join(mcp, 'LICENSE')),
    'THIRD-PARTY-NOTICES.txt': strToU8(await dependencyNotices(bundle.metafile.inputs)),
  }
  const plugin = {
    ...payload,
    'README.md': await readFile(join(mcp, 'README.md')),
    'plugin.json': json({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', ...descriptor,
      extensions: { 'com.openai': { interface: { displayName, shortDescription: 'Explore knowledge graphs',
        longDescription: 'Search four offline graphs, follow links and read the archived passage behind a connection.',
        developerName: 'Loom', category: 'Developer Tools', capabilities: ['Read', 'Interactive'], websiteURL: pkg.homepage,
        logo: './server/data/icon.png', composerIcon: './server/data/icon.png', brandColor: '#254131',
        defaultPrompt: ['How does Music connect to Sound in Wikispeedia? Show me the source.'] } } } }),
    'mcp.json': json({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
      mcpServers: { loom: { type: 'stdio', ...command('${PLUGIN_ROOT}') } } }),
    '.claude-plugin/plugin.json': json({ ...descriptor, mcpServers: { loom: command('${CLAUDE_PLUGIN_ROOT}') } }),
  }
  const marketplace = {
    'loom-marketplace/.agents/plugins/marketplace.json': json({ name: 'loom', interface: { displayName: 'Loom' },
      plugins: [{ name, source: { source: 'local', path: './plugins/' + name }, category: 'Developer Tools' }] }),
    'loom-marketplace/.claude-plugin/marketplace.json': json({ name: 'loom', owner: author,
      plugins: [{ name, source: './plugins/' + name, description: pkg.description }] }),
  }
  for (const [path, bytes] of Object.entries(plugin)) marketplace['loom-marketplace/plugins/' + name + '/' + path] = bytes
  const desktop = {
    ...payload,
    'manifest.json': json({ manifest_version: '0.3', ...descriptor, display_name: displayName, icon: 'server/data/icon.png',
      server: { type: 'node', entry_point: entry, mcp_config: command('${__dirname}') },
      compatibility: { runtimes: { node: pkg.engines.node } } }),
  }
  const options = { level: 6, mtime: new Date(2020, 0, 1) }
  return new Map([[marketplaceFile, zipSync(marketplace, options)], [desktopFile, zipSync(desktop, options)]])
}

export async function writeInstallers(destination) {
  const packages = await buildInstallers()
  await Promise.all([...packages].map(([filename, bytes]) => writeFile(join(destination, filename), bytes)))
}
