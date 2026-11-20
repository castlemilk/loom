import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createEditor, restoreEditor, editorSchema } from '../src/editor.js'
import type { EditorOperation } from '../src/editor.js'
import { importWorkload } from '../web/app/workload.mjs'

const source = () => ({ nodes: [{ id: 'a', label: 'Alpha', topics: ['Light'] }, { id: 'b', label: 'Beta' }],
  links: [{ source: 'a', target: 'b' }, { id: '@link:0', source: 'a', target: 'b' }, { source: 'a', target: 'a' }],
  artwork: { light: 'graphs/light.webp' }, provenance: { source: 'notebook' } })
const tx = (operations: EditorOperation[], expectedRevision = 0) => ({ version: 1, expectedRevision, operations })

test('imports legacy and explicit IDs together, preserves JSON and isolates caller mutations', () => {
  const data = source()
  const doc = createEditor({ ...data, nodes: [...data.nodes, { id: '__proto__', label: undefined }] })
  const original = doc.getSnapshot()
  assert.deepEqual(original.data.links.map((l) => l.id), ['@link:1','@link:0','@link:2'])
  data.nodes[0].topics!.push('later')
  assert.deepEqual(doc.getNode('a')?.topics, ['Light'])
  assert.equal(Object.isFrozen(doc.getNode('a')?.topics), true)
  assert.deepEqual(original.data.provenance, { source: 'notebook' })
  assert.equal(Object.hasOwn(doc.getNode('__proto__')!, 'label'), false)
  assert.equal(doc.getSnapshot(), original)
  assert.throws(() => createEditor({ nodes: [], links: [{ source: 'x', target: 'x' }] }))
  assert.throws(() => createEditor({ nodes: [{ id: 'a' }, { id: 'a' }], links: [] }))
  assert.throws(() => createEditor({ nodes: [{ id: 'a', x: NaN }], links: [] }))
})

test('discovers six commands and previews and commits an ordered batch once', () => {
  const doc = createEditor(source()), before = doc.getSnapshot()
  assert.deepEqual(editorSchema.properties.operations.items.oneOf.map((c) => c.properties!.op && (c.properties!.op as {const:string}).const),
    doc.describe().operations)
  assert.ok(Object.isFrozen(editorSchema.properties.operations.items.oneOf[0]))
  const edit = tx([{ op: 'node.add', value: { id: 'c', kind: 'paper' } }, { op: 'link.add', value: { id: 'bc', source: 'b', target: 'c' } }])
  let updates = 0
  const off = doc.subscribe(() => { updates++ })
  const preview = doc.preview(edit)
  assert.ok(preview.ok)
  assert.equal(preview.revision, 0)
  assert.equal(doc.getSnapshot(), before)
  assert.equal(updates, 0)
  const write = doc.apply(edit)
  assert.ok(write.ok)
  assert.deepEqual(write.changes, preview.changes)
  assert.equal(updates, 1)
  assert.equal(doc.getLink('bc')?.target, 'c')
  off()
  doc.undo()
  assert.equal(updates, 1)
})

test('an invalid operation rolls back all earlier operations and emits a diagnostic path', () => {
  const doc = createEditor(source()), before = doc.getSnapshot()
  function rejected(input: unknown, code: string, path: string) {
    const r = doc.apply(input)
    assert.ok(!r.ok)
    assert.deepEqual([r.error.code, r.error.path], [code, path])
    assert.equal(doc.getSnapshot(), before)
  }
  rejected(tx([{ op:'node.add', value:{ id:'c' } }, { op:'link.update', id:'@link:0', changes:{ target:'missing' } }]), 'missing_endpoint', '/operations/1/changes/target')
  rejected(tx([{ op:'node.remove', id:'a' }]), 'connected_node', '/operations/0')
  rejected(tx([{ op:'node.remove', id:'absent' }]), 'not_found', '/operations/0/id')
  rejected(tx([{ op:'node.add', value:{id:'a'} }]), 'duplicate_id', '/operations/0/value/id')
  rejected(tx([{ op:'node.remove', id:'a' }], 9), 'stale_revision', '/expectedRevision')
  rejected({ ...tx([{ op:'node.remove', id:'b' }]), documentId:'different' }, 'wrong_document', '/documentId')
  rejected({version:1,operations:[{op:'node.update',id:'a',changes:{id:'other'}}]}, 'invalid_input', '/operations/0/changes/id')
  rejected({version:1,operations:[{op:'link.update',id:'@link:0',unset:['target']}]}, 'invalid_input', '/operations/0/unset/0')
  rejected({version:1,operations:[{op:'node.update',id:'a',changes:{kind:'k'},unset:['kind']}]}, 'invalid_input', '/operations/0/unset')
  rejected({version:1,operations:[{op:'node.update',id:'a',unset:['kind','kind']}]}, 'invalid_input', '/operations/0/unset')
})

test('supports reconnect, explicit field removal, JSON null and stable no-op revisions', () => {
  const doc = createEditor(source())
  assert.ok(doc.transact([{ op:'link.update', id:'@link:0', changes:{ source:'b', weight:2, evidence:null } }]).ok)
  assert.equal(doc.getLink('@link:0')?.evidence, null)
  assert.ok(doc.transact([{ op:'link.update', id:'@link:0', unset:['weight'] }]).ok)
  assert.equal(Object.hasOwn(doc.getLink('@link:0')!, 'weight'), false)
  const before = doc.getSnapshot()
  assert.deepEqual(doc.transact([{ op:'node.update', id:'a', changes:{topics:['Light']}, unset:['absent'] }]), {ok:true,revision:2,changes:[]})
  assert.equal(doc.getSnapshot(), before)
  assert.deepEqual(doc.query({ entity:'link', incidentTo:'b', text:'@link:0' }).items[0],
    { id:'@link:0', source:'b', target:'b', kind:undefined })
})

test('cascade is one undo frame, including self and parallel links; new edits invalidate redo', () => {
  const doc = createEditor(source(), { historyLimit:1 })
  const r = doc.transact([{ op:'node.remove', id:'a', cascade:true }])
  assert.ok(r.ok)
  assert.deepEqual(r.changes.map((c) => c.id), ['@link:1','@link:0','@link:2','a'])
  assert.equal(doc.describe().links, 0)
  assert.equal(doc.undo(0).ok, false)
  assert.equal(doc.undo(1).revision, 2)
  assert.deepEqual(doc.getSnapshot().data.links.map((l) => l.id), ['@link:1','@link:0','@link:2'])
  assert.equal(doc.redo(2).revision, 3)
  doc.undo()
  assert.ok(doc.transact([{ op:'node.update', id:'b', changes:{label:'Delta'} }]).ok)
  assert.equal(doc.redo().ok, false)
  doc.undo()
  assert.equal(doc.undo().ok, false)
})

test('bounded discovery and checkpoint round-trip preserve document identity, revision and metadata', () => {
  const doc = createEditor(source(), { documentId:'catalogue' })
  doc.transact([{op:'node.update',id:'a',changes:{kind:'optics'}}])
  const first = doc.query({entity:'link',incidentTo:'a',limit:2})
  assert.deepEqual([first.total,first.nextOffset], [3,2])
  assert.equal(doc.query({entity:'link',offset:2,limit:2}).nextOffset, null)
  assert.equal(doc.query({entity:'node',text:'LPH',kind:'optics'}).items[0].id, 'a')
  assert.throws(() => doc.query({entity:'node',limit:101}))
  const checkpoint = JSON.parse(JSON.stringify(doc.checkpoint()))
  const restored = restoreEditor(checkpoint)
  assert.deepEqual(restored.checkpoint(), doc.checkpoint())
  assert.equal(restored.getSnapshot().canUndo,false)
  assert.equal(restored.apply({ documentId:'catalogue', ...tx([{op:'link.remove',id:'@link:1'}], 1) }).ok, true)
  assert.throws(() => restoreEditor({ ...checkpoint, version:2 }))
  assert.deepEqual(importWorkload(doc.checkpoint().data).provenance, source().provenance)
  assert.throws(() => importWorkload({ nodes:[{id:'a'}], links:[{id:'e',source:'a',target:'a'},{id:'e',source:'a',target:'a'}] }))
})

test('per-node style edits validate, undo, redo, and reset to the inherited style', () => {
  const doc = createEditor(source())
  for (const changes of [{ markerColor: '#aa' }, { markerColor: 'red' }, { markerShape: 'hexagon' }]) {
    assert.equal(doc.apply(tx([{ op:'node.update', id:'a', changes } as EditorOperation])).ok, false)
  }
  assert.ok(doc.apply(tx([{ op:'node.update', id:'a', changes:{markerColor:'#abc', markerShape:'square'} }])).ok)
  assert.equal(doc.undo().ok, true)
  assert.equal(doc.getNode('a')?.markerColor, undefined)
  assert.equal(doc.redo().ok, true)
  assert.equal(doc.getNode('a')?.markerShape, 'square')
  assert.ok(doc.transact([{ op:'node.update', id:'a', unset:['markerColor','markerShape'] }]).ok)
  assert.equal(Object.hasOwn(doc.getNode('a')!, 'markerShape'), false)
})

test('the bundled atlases carry per-article provenance and ranked, distinct in-collection links', () => {
  for (const [id, count] of [['bauhaus',15], ['outer-solar-system',16]] as const) {
    const file = new URL('../demo/atlases/' + id + '.json', import.meta.url)
    const doc = createEditor(importWorkload(JSON.parse(readFileSync(file, 'utf8'))))
    const { nodes, links, attribution } = doc.getSnapshot().data
    assert.equal(nodes.length, count)
    assert.match(String(attribution), /Wikipedia contributors/)
    for (const node of nodes) {
      assert.ok(Number.isSafeInteger(node.wikipediaRevision))
      assert.ok(node.section && node.summary)
      const outgoing = links.filter((e) => e.source === node.id)
      assert.ok(outgoing.length <= 4)
      assert.equal(new Set(outgoing.map(e => e.target)).size, outgoing.length)
      assert.ok(outgoing.every((e, i) => e.kind === 'wikilink' && e.target !== node.id && e.weight! >= 1 &&
        Number.isInteger(e.weight) && (!i || e.weight! <= outgoing[i-1].weight!)))
    }
  }
})
