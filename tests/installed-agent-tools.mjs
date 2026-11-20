// Run in the clean consumer project after compiling its installed documentation examples.
import assert from 'node:assert/strict'
import { createEditor } from 'loom-core/editor'
import { graphTools, guardedTransactionSchema } from './compiled/graph-tools.js'
import { signalPath } from './compiled/signal-path.js'
import payload from './examples/recorder-edit.json' with { type: 'json' }

const editor = createEditor(signalPath, { documentId: 'synth' })
const tools = graphTools(editor)
assert.equal(tools.findNodes('Amplifier').items[0].id, 'amp')
assert.equal(tools.linksForNode('amp').items[0].source, 'filter')
assert.equal(tools.readLink('amp-recorder'), null)
assert.deepEqual(new Set(guardedTransactionSchema.required), new Set(Object.keys(payload)))
for (const key of ['documentId', 'expectedRevision']) {
  const missing = { ...payload }
  delete missing[key]
  assert.equal(tools.preview(missing).error.path, '/' + key)
  assert.equal(tools.apply(missing).error.path, '/' + key)
}
assert.equal(tools.preview({ ...payload, documentId: 'another' }).error.code, 'wrong_document')
const bad = structuredClone(payload)
bad.operations[1].value.source = 'missing'
assert.equal(tools.apply(bad).error.code, 'missing_endpoint')
assert.equal(editor.getNode('recorder'), undefined)

const preview = tools.preview(payload)
assert.equal(preview.ok, true)
assert.deepEqual(preview.changes.map(change => change.id), ['recorder', 'amp-recorder'])
assert.equal(preview.revision, 0)
assert.equal(tools.describe().revision, 0)
const receipt = tools.apply(payload)
assert.deepEqual(receipt, { ...preview, revision: 1 })
assert.deepEqual(tools.readLink('amp-recorder'), payload.operations[1].value)
assert.equal(tools.apply(payload).error.code, 'stale_revision')
assert.equal(tools.describe().revision, 1)

const shared = createEditor(signalPath, { documentId: 'synth' })
const agent = graphTools(shared)
assert.equal(agent.preview(payload).ok, true)
shared.transact([{ op: 'node.update', id: 'amp', changes: { label: 'Power amplifier' } }])
assert.equal(agent.apply(payload).error.code, 'stale_revision')
assert.equal(agent.findNodes('Power amplifier').items[0].id, 'amp')
assert.equal(agent.readLink('amp-recorder'), null)
const revised = { ...payload, expectedRevision: agent.describe().revision }
assert.equal(agent.preview(revised).ok, true)
assert.equal(agent.apply(revised).revision, 2)
const many = graphTools(createEditor({ nodes: Array.from({ length: 10 }, (_, i) => ({ id: 'item-' + i })), links: [] }))
const first = many.findNodes('item')
assert.equal(first.items.length, 8)
assert.equal(first.total, 10)
assert.deepEqual(many.findNodes('item', first.nextOffset).items.map(row => row.id), ['item-8', 'item-9'])
console.log('Verified agent discovery, guarded edits, readback and concurrent changes from the installed SDK.')
