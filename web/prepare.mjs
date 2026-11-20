import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, cp, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { writeSpecimens } from './specimen-art.mjs'
import { writeAssistantDocs } from './docs/markdown.mjs'
import { publishedIntegrity, studioDependency } from '../scripts/npm-registry.mjs'
import { siteOrigin } from './site.js'
import mcpPackage from '../mcp/package.json' with { type: 'json' }

const root = new URL('../', import.meta.url)
const target = (path) => new URL(path, import.meta.url)
execFileSync('npm', ['run', 'build'], { cwd: fileURLToPath(root), stdio: 'inherit' })
execFileSync('npm', ['run', 'size'], { cwd: fileURLToPath(root), stdio: 'inherit' })
await mkdir(target('./public/graphs/art/'), { recursive: true })
await mkdir(target('./.generated/'), { recursive: true })
await mkdir(target('./public/docs/'), { recursive: true })
await mkdir(target('./public/benchmarks/'), { recursive: true })
const publicDir = fileURLToPath(target('./public/'))
const [archive] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', publicDir],
  { cwd: fileURLToPath(root), encoding: 'utf8' }))
const mcpFile = mcpPackage.name + '-' + mcpPackage.version + '.tgz'
for (const filename of await readdir(publicDir)) {
  if ([archive.name, mcpPackage.name].some(name => filename.startsWith(name + '-')) && filename.endsWith('.tgz') &&
    filename !== archive.filename && filename !== mcpFile) {
    await unlink(target('./public/' + filename))
  }
}
const revision = process.env.GITHUB_SHA
const prefix = /^[a-f0-9]{40}$/.test(revision) ? 'packages/' + revision + '/' : ''
const site = new URL((process.env.PAGES_BASE_PATH ?? '/loom') + '/', siteOrigin)
execFileSync(process.execPath, ['scripts/build-mcp.mjs', publicDir], { cwd: root, stdio: 'inherit' })
// The catalog imports the SDK index copied by build-mcp above.
const { lightStudy } = await import('./light-study.mjs')
await writeFile(target('./.generated/light-study.json'), JSON.stringify(await lightStudy()))
await writeFile(target('./.generated/graph-mcp.json'), JSON.stringify({ filename: mcpFile, archiveURL: new URL(prefix + mcpFile, site).href }))
const archiveURL = new URL(prefix + archive.filename, site).href
let published
try { published = await publishedIntegrity() }
catch (error) { console.warn('Using the Studio archive. ' + error.message) }
const sdk = { filename: archive.filename, ...studioDependency(archive.integrity, published, archiveURL) }
const installCommands = ['npm init -y', 'npm install ' + sdk.installSpec, 'npm install --save-dev vite'].join('\n')
await writeFile(target('./.generated/sdk-package.json'), JSON.stringify({ ...sdk, installCommands }))
await copyFile(new URL('benchmarks/m2-max.json', root), target('./public/benchmarks/m2-max.json'))
await copyFile(new URL('dist/api-index.json', root), target('./public/docs/api-index.json'))
await writeAssistantDocs(target('./public/'), new URL('dist/api-index.json', root), installCommands)
await writeSpecimens(target('./public/graphs/specimens/v1/'))
const atlases = JSON.parse(await readFile(new URL('demo/atlases/catalog.json', root), 'utf8'))
for (const name of Object.keys(atlases)) {
  await copyFile(new URL('demo/atlases/' + name + '.json', root), target('./public/examples/' + name + '.json'))
}
await copyFile(new URL('dist/layout-worker.js', root), target('./public/layout-worker.js'))
await cp(new URL('dist/atlas-runtime/', root), target('./public/atlas-runtime/0.8.12/'), {recursive:true})
await copyFile(new URL('dist/editor.schema.json', root), target('./public/editor.schema.json'))
await copyFile(new URL('dist/wire-effects.schema.json', root), target('./public/wire-effects.schema.json'))
await copyFile(new URL('dist/drawing-style.schema.json', root), target('./public/drawing-style.schema.json'))

const snapshot = JSON.parse(await readFile(new URL('demo/knowledge.json', root), 'utf8'))
const artwork = {}
for (const [id, uri] of Object.entries(snapshot.thumbnails)) {
  const match = /^data:image\/webp;base64,(.+)$/.exec(uri)
  if (!match) throw new Error('Expected a WebP thumbnail for ' + id)
  const bytes = Buffer.from(match[1], 'base64')
  const name = createHash('sha256').update(bytes).digest('hex').slice(0, 16) + '.webp'
  artwork[id] = 'graphs/art/' + name
  await writeFile(target('./public/' + artwork[id]), bytes)
}
const ids = new Set(snapshot.sample)
const nodes = snapshot.nodes.filter((node) => ids.has(node.id))
const sampleArtwork = Object.fromEntries(nodes.filter((n) => artwork[n.art]).map((n) => [n.art, artwork[n.art]]))
const sample = { nodes, links: snapshot.edges.filter((e) => ids.has(e.source) && ids.has(e.target)), artwork: sampleArtwork }
await writeFile(target('./.generated/sample.json'), JSON.stringify(sample))
await writeFile(target('./public/graphs/knowledge.json'), JSON.stringify({ nodes: snapshot.nodes, links: snapshot.edges, artwork }))
