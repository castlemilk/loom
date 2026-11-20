// Executed in a standalone application with only the packed SDK installed.
import './check-agent.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createGraph } from 'loom-core'
import { createEditor, restoreEditor } from 'loom-core/editor'
import { mountScene } from 'loom-core/scene'
import { compileTaxonomies } from 'loom-core/taxonomy'
import { observePerformance } from 'loom-core/performance'
import schema from 'loom-core/editor.schema.json' with { type: 'json' }
import index from 'loom-core/api-index.json' with { type: 'json' }
import { addFilter } from './compiled/edit.js'
import { inspectNode } from './compiled/inspect.js'
import { signalPath } from './compiled/signal-path.js'

const edited = addFilter()
assert.equal(edited.revision, 1)
assert.equal(edited.link.target, 'filter')
assert.equal(inspectNode(signalPath, 'mixer').outgoing[0].node.id, 'filter')
const editor = createEditor({ nodes: [], links: [] })
const { revision } = editor.transact([{ op: 'node.add', value: { id: 'receipt' } }])
assert.equal(revision, 1)
assert.ok(restoreEditor(editor.checkpoint()).getNode('receipt'))
assert.equal(schema.properties.operations.items.oneOf.length, 6)
assert.equal(typeof createGraph, 'function')
assert.equal(typeof mountScene, 'function')
assert.equal(typeof observePerformance, 'function')
assert.ok(compileTaxonomies({ nodes: [], links: [] }, { taxonomies: [] }).legend)
for (const mod of index.modules) await import(mod.name)
const asset = async name => readFile(new URL(import.meta.resolve('loom-core/' + name)))
for (const name of ['layout-worker.js', 'atlas-runtime/sqlite.worker.js',
  'atlas-runtime/sql.js-LICENSE', 'atlas-runtime/comlink-LICENSE', 'atlas-runtime/sql.js-httpvfs-LICENSE']) {
  assert.ok((await asset(name)).length > 0, name)
}
assert.ok(WebAssembly.validate(await asset('atlas-runtime/sql-wasm.wasm')))
if (process.env.PAGES_URL) {
  const url = new URL('docs/api-index.json', process.env.PAGES_URL)
  if (process.env.GITHUB_SHA) url.searchParams.set('sha', process.env.GITHUB_SHA)
  const response = await fetch(url)
  assert.ok(response.ok)
  assert.deepEqual(await response.json(), index)
}
