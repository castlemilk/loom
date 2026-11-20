import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { writeSpecimens } from './specimen-art.mjs'

const root = new URL('../', import.meta.url)
const target = (path) => new URL(path, import.meta.url)
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fileURLToPath(root), stdio: 'inherit' })
await mkdir(target('./public/graphs/art/'), { recursive: true })
await mkdir(target('./.generated/'), { recursive: true })
await writeSpecimens(target('./public/graphs/specimens/v1/'))
const atlases = JSON.parse(await readFile(new URL('demo/atlases/catalog.json', root), 'utf8'))
for (const name of Object.keys(atlases)) {
  await copyFile(new URL('demo/atlases/' + name + '.json', root), target('./public/examples/' + name + '.json'))
}
await copyFile(new URL('dist/layout-worker.js', root), target('./public/layout-worker.js'))
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
