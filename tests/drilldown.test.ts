import test from 'node:test'
import assert from 'node:assert/strict'
import { createDrilldown, drilldownGroup } from '../src/drilldown.js'
import { createGraphIndex } from '../src/explore.js'
import { clusterLayout } from '../src/clusters.js'
import { compileTaxonomies, scopeTaxonomies } from '../src/taxonomy.js'
import type { GraphEvents, GraphFrame, GraphNode, LoomGraph } from '../src/types.js'
import { Camera } from '../src/camera.js'
import { cacheOutline, cloudOutline } from '../src/group-outline.js'

const nodes = ['a', 'b', 'c', 'd', '__proto__'].map((id, i) => ({
  id, label: id.toUpperCase(), section: i < 3 ? 'lab' : 'field', x: 1, y: 1, pinned: false, figures: i,
}))
const link = (source: string, target: string, kind = 'cites') => ({ source, target, kind, evidence: [source, target] })
const data = { nodes, links: [link('a', 'b'), link('a', 'b'), link('b', 'a'), link('b', 'b'), link('b', 'c'),
  link('a', 'd', 'cross'), link('c', '__proto__')] }
const group = { taxonomy: 'section', id: 'lab', members: ['a', 'b', 'c', 'a', 'absent'] }
const ids = (visible: readonly GraphNode[]) => visible.map((n) => n.id)

test('the exploration index ranks names, folds accents and searches metadata within the requested scope', () => {
  const nodes = [
    { id: 'school', label: 'Bauhaus', summary: 'László studied at this school' },
    { id: 'l-2', label: 'László II', section: 'Designers' },
    { id: 'l-1', label: 'László', section: 'Designers' },
    { id: '__proto__', label: 'About László' },
  ]
  const index = createGraphIndex({ nodes, links: [] })
  assert.deepEqual(ids(index.search('laszlo')), ['l-1', 'l-2', '__proto__', 'school'])
  assert.deepEqual(ids(index.search('DESIGNERS laszlo', { within: new Set(['school','l-2']) })), ['l-2'])
  assert.equal(index.search('L_1', { limit: 1 })[0], nodes[2])
  assert.deepEqual(index.search(' '), [])
  assert.deepEqual(index.search('László', { limit: 0 }), [])
  assert.throws(() => index.search('x', { limit: -1 }), RangeError)
})

test('incoming and outgoing indexes retain parallel links, self loops, and cross-group direction', () => {
  const index = createGraphIndex(data)
  const out = index.neighbors('b', 'outgoing')
  assert.deepEqual(out.map((row) => row.node.id), ['a','b','c'])
  const incoming = index.neighbors('b', 'incoming')
  assert.deepEqual(incoming.map((row) => row.links.length), [2,1])
  assert.equal(incoming[0].links[0], data.links[0])
  assert.deepEqual(index.boundary(['a', 'a', 'd']).map(({node, incoming, outgoing}) => [node.id, incoming, outgoing]), [['b',1,2]])
  assert.deepEqual(index.boundary(ids(nodes)), [])
  assert.throws(() => index.boundary(['missing']), /Unknown node/)
  assert.throws(() => index.neighbors('a', 'both' as never), RangeError)
  assert.throws(() => createGraphIndex({nodes, links:[link('a','x')]}), /Unknown node/)
  assert.throws(() => createGraphIndex({nodes:[...nodes,nodes[0]], links:[]}), /Duplicate/)
})

test('wider cluster layouts pack more groups in one row while preserving membership', () => {
  const by = (node: GraphNode) => node.id
  const square = clusterLayout(nodes, by), wide = clusterLayout(nodes, by, { aspectRatio: 3 })
  const rows = (g: typeof wide) => new Set(g.groups.map((item) => item.center.y)).size
  assert.ok(rows(wide) < rows(square))
  assert.deepEqual(square.groups.map(g => g.members), wide.groups.map(g => g.members))
  assert.throws(() => clusterLayout(nodes, by, { aspectRatio: 0 }), RangeError)
})
test('contour caches invalidate on cumulative position or radius changes only in affected memberships', () => {
  const p = Float32Array.from([10, 20, 3, 1, 30, 40, 4, 2, 45, 65, 5, 2])
  const first = cacheOutline(cloudOutline, [0,1], 8), second = cacheOutline(cloudOutline, [1,2], 8)
  assert.equal(first(p), cloudOutline(p,[0,1],8))
  assert.equal(second(p), cloudOutline(p,[1,2],8))
  p[3] = 12
  p[0] += 0.125
  assert.equal(first(p), undefined)
  p[0] += 0.125
  assert.equal(first(p), cloudOutline(p,[0,1],8))
  assert.equal(second(p), undefined)
  p[6] += 1
  assert.equal(first(p), cloudOutline(p,[0,1],8))
  assert.equal(second(p), cloudOutline(p,[1,2],8))
})
type Pose = ReturnType<LoomGraph['getPosition']>
function fakeGraph(visible: readonly GraphNode[]) {
  const positions = new Map(visible.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0, pinned: n.pinned ?? false }]))
  const handlers = new Map<keyof GraphEvents, Set<(value: never) => void>>()
  const focused: string[] = []
  const selected: (string | null)[] = []
  function emit<K extends keyof GraphEvents>(key: K, value: GraphEvents[K]) {
    for (const fn of handlers.get(key) ?? []) fn(value as never)
  }
  return { positions, focused, selected, emit,
    getPosition: (id: string): Pose => ({ ...positions.get(id)! }),
    focus: (id: string) => { focused.push(id) },
    select: (id: string | null) => { selected.push(id); emit('select', id) },
    on<K extends keyof GraphEvents>(key: K, fn: (value: GraphEvents[K]) => void) {
      const listeners = handlers.get(key) ?? new Set()
      handlers.set(key, listeners)
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    } }
}

test('nested node drilldowns follow directional hops, preserve parallel edges, metadata and parent selections', () => {
  const nav = createDrilldown(data, { neighborhood: { direction: 'outgoing', includeLink: (e) => e.kind === 'cites' } })
  const checked = structuredClone(data)
  const snapshot = nav.getSnapshot
  assert.equal(snapshot().data, data)
  nav.openGroup(group, 'isolate')
  assert.deepEqual(ids(snapshot().data.nodes), ['a', 'b', 'c'])
  assert.equal(snapshot().data.links.length, 5)
  nav.select('c')
  assert.equal(snapshot().selected, 'c')
  nav.activate('a')
  assert.deepEqual(ids(snapshot().data.nodes), ['a', 'b'])
  assert.equal(snapshot().data.links.length, 4)
  assert.equal(snapshot().data.links[1], data.links[1])
  assert.equal(snapshot().data.nodes[1].figures, 1)
  assert.equal(nav.openNeighborhood('a'), false)
  assert.equal(nav.getSnapshot().path.length, 3)
  assert.equal(nav.back(), true)
  assert.equal(snapshot().selected, 'a')
  nav.openNeighborhood('a', { hops: 2 })
  assert.deepEqual(ids(snapshot().data.nodes), ['a', 'b', 'c'])
  assert.equal(nav.goTo(0), true)
  assert.equal(snapshot().selected, null)
  nav.openNeighborhood('__proto__', { direction: 'incoming' })
  assert.deepEqual(ids(snapshot().data.nodes), ['c', '__proto__'])
  assert.throws(() => nav.select('a'), /outside/)
  nav.openNeighborhood('c', { hops: 0 })
  assert.deepEqual(ids(snapshot().data.nodes), ['c'])
  assert.deepEqual(snapshot().data.links, [])
  assert.deepEqual(data, checked)
})

test('following a reference crosses isolated scopes and restores the prior selection and camera on Back', () => {
  const nav = createDrilldown(data)
  const view = { x: 49, y: 32, z: 0, yaw: 0.1, pitch: 0, zoom: 2.3 }
  nav.openGroup(group, 'isolate')
  nav.inspect('c')
  nav.bind({ ...fakeGraph(nav.getSnapshot().data.nodes), getViewport: () => view })
  assert.throws(() => nav.openNeighborhood('d'), /outside/)
  assert.throws(() => nav.followNode('missing'), /outside/)
  nav.followNode('d', { direction: 'incoming' })
  assert.deepEqual(ids(nav.getSnapshot().data.nodes), ['a', 'd'])
  assert.equal(nav.getSnapshot().selected, 'd')
  assert.deepEqual(nav.getTrail().map(frame => frame.selected), [null, 'c', 'd'])
  assert.equal(nav.followNode('d', {direction: 'incoming'}), false)
  assert.equal(nav.getSnapshot().path.length, 3)
  nav.back()
  let restored
  nav.bind({ ...fakeGraph(nav.getSnapshot().data.nodes), setViewport: (v) => { restored = v } })
  assert.deepEqual(restored, view)
  assert.equal(nav.getSnapshot().selected, 'c')
  assert.deepEqual(ids(nav.getSnapshot().groupMembers), ['a', 'b', 'c'])
})

test('bound expansion uses the same renderer, spaces coincident members, and retains context, pins and explicit releases', () => {
  const nav = createDrilldown(data, { openAction: 'group', groupFor: () => group, memberSpacing: 30 })
  const graph = fakeGraph(nodes)
  graph.positions.set('d', { x: 70, y: -23, z: 8, pinned: true })
  nav.bind(graph)
  nav.setOptions({ selectAction: (n) => n.id === 'b' ? 'focus' : 'inspect' })
  graph.emit('select', 'b')
  assert.deepEqual(graph.focused, ['b'])
  const base = nav.getSnapshot().data
  graph.emit('open', 'b')
  assert.equal(nav.getSnapshot().data, base)
  assert.equal(nav.getSnapshot().selected, 'b')
  const layout = nav.resolveLayout('cloud', { repulsion: 2 })
  assert.equal(layout.mode, 'cloud')
  assert.equal(layout.layout.repulsion, 2)
  assert.equal(layout.layout.blend, 0.7)
  const anchor = layout.layout.anchor!
  assert.equal(nav.resolveLayout('cloud').layout.anchor, anchor)
  assert.deepEqual(anchor(nodes[3], 3), graph.positions.get('d'))
  const targets = nodes.slice(0,3).map((n,i) => anchor(n, i)!)
  for (let i = 0; i < targets.length; i++) for (let j = 0; j < i; j++)
    assert.ok(Math.hypot(targets[i].x - targets[j].x, targets[i].y - targets[j].y) >= 60 - 1e-8)
  nav.setOptions({ arrangement: 'radial', spread: 3, expansionBlend: 0.4 })
  const radial = nav.resolveLayout('lanes')
  assert.equal(radial.mode, 'drift')
  assert.equal(radial.layout.blend, 0.4)
  assert.notDeepEqual(radial.layout.anchor!(nodes[0], 0), targets[0])
  graph.positions.set('a', { x: -17, y: 52, z: 3, pinned: true })
  graph.positions.set('d', { x: 77, y: 44, z: 0, pinned: false })
  assert.equal(nav.openGroup(group), true)
  assert.equal(nav.getSnapshot().path.length, 1)
  const restored = nav.getSnapshot().data
  assert.equal(restored.nodes[0].x, -17)
  assert.equal(restored.nodes[0].pinned, true)
  assert.equal(restored.nodes[3].pinned, false)
  assert.equal(restored.nodes[3].x, 70)
  assert.equal(nav.getSnapshot().selected, 'b')
  assert.throws(() => nav.bind(graph, base), /stale/)
  graph.emit('open', 'a')
  assert.equal(nav.getSnapshot().path.length, 1)
  const rebound = fakeGraph(restored.nodes)
  nav.bind(rebound)
  assert.deepEqual(rebound.selected, ['b'])
  rebound.emit('destroy', undefined)
  rebound.emit('select', 'a')
  assert.equal(nav.getSnapshot().selected, 'b')
})

test('configuration is atomic and per-group policies work with and without a mounted graph', () => {
  const nav = createDrilldown(data, { groupAction: (term) => term.id === 'lab' ? 'isolate' : 'none' })
  let calls = 0
  const off = nav.subscribe(() => calls++)
  const before = nav.getSnapshot()
  assert.throws(() => nav.setOptions({ spread: 2, neighborhood: { hops: -1 } }), /Hops/)
  assert.throws(() => nav.setOptions({ memberSpacing: 0 }), /spacing/)
  assert.throws(() => nav.setOptions({ expansionBlend: 1.01 }), /blend/)
  assert.equal(nav.getSnapshot(), before)
  assert.equal(nav.openGroup({ ...group, id: 'other' }), false)
  assert.equal(calls, 0)
  assert.equal(nav.openGroup(group), true)
  assert.equal(nav.resolveLayout('lanes').mode, 'drift')
  nav.setOptions({ detail: {} })
  assert.equal(nav.resolveLayout('lanes').mode, 'lanes')
  assert.equal(nav.openGroup({ ...group, members: ['d'] }, 'expand'), false)
  assert.equal(nav.openGroup(group, 'expand'), true)
  assert.deepEqual(ids(nav.getSnapshot().data.nodes), ['a','b','c'])
  const anchor = nav.resolveLayout('cloud').layout.anchor!
  assert.ok(Number.isFinite(anchor(nodes[0], 0)!.x))
  assert.equal(nav.goTo(0), true)
  off()
  const count = calls
  nav.select('a')
  assert.equal(calls, count)
})

test('Cloud ring targets face the opening camera even at an edge-on angle and stay fixed during later orbits', () => {
  const camera = new Camera('cloud')
  camera.width = 720; camera.height = 540; camera.yaw = Math.PI / 2; camera.pitch = 0.83
  const nav = createDrilldown(data, { memberSpacing: 35, spread: 2, expansionBlend: 1 })
  let project!: (frame: GraphFrame) => void
  const frame = () => ({ mode: 'cloud', yaw: camera.yaw, pitch: camera.pitch }) as GraphFrame
  nav.bind({ ...fakeGraph(nodes), onFrame(fn) { project = fn; project(frame()); return () => {} } })
  nav.openGroup(group)
  const anchor = nav.resolveLayout('cloud').layout.anchor!
  const projected = nodes.slice(0,3).map((n,i) => {
    const p = anchor(n,i)!, out = new Float32Array(4)
    camera.project(p.x,p.y,p.z!,out,0,camera.basis())
    return out
  })
  for (let i = 1; i < projected.length; i++) {
    assert.ok(Math.abs(projected[i][3]-projected[0][3]) < 0.0001)
    assert.ok(Math.abs(Math.hypot(projected[i][0]-projected[0][0], projected[i][1]-projected[0][1]) - 70*projected[0][2]) < 0.001)
  }
  camera.yaw -= 1.5; project(frame())
  assert.equal(nav.resolveLayout('cloud').layout.anchor, anchor)
})

test('switching group views preserves its entire roster, one breadcrumb, live poses and the parent selection', () => {
  const nav = createDrilldown(data, { selectAction: 'neighbors' })
  const root = fakeGraph(nodes)
  const initial = nav.getSnapshot()
  nav.bind(root)
  assert.deepEqual(initial.groupMembers, [])
  assert.equal(nav.setGroupView('isolate'), false)
  nav.inspect('d')
  nav.openGroup({ ...group, members: ['c', 'b', 'a', 'b', 'absent'] })
  const roster = nav.getSnapshot().groupMembers
  assert.deepEqual(ids(roster), ['a', 'b', 'c'])
  assert.equal(roster[2], nodes[2])
  root.positions.set('d', { x: 32, y: 12, z: 2, pinned: false })
  root.positions.set('a', { x: 5, y: 8, z: 4, pinned: true })
  let updates = 0
  nav.subscribe(() => updates++)
  assert.equal(nav.setGroupView('isolate'), true)
  assert.equal(updates, 1)
  const isolated = nav.getSnapshot()
  assert.equal(isolated.selected, null)
  assert.equal(isolated.groupMembers, roster)
  assert.deepEqual(ids(isolated.data.nodes), ids(roster))
  assert.equal(isolated.data.links.length, 5)
  assert.equal(isolated.data.nodes[0].pinned, true)
  assert.equal(isolated.path.length, 2)
  assert.equal(nav.setGroupView('isolate'), false)
  assert.equal(nav.getSnapshot(), isolated)
  assert.throws(() => nav.setGroupView('other' as 'expand'), /view/)
  const detail = fakeGraph(isolated.data.nodes)
  nav.bind(detail)
  nav.inspect('c')
  assert.equal(nav.getSnapshot().path.length, 2)
  assert.deepEqual(detail.selected, [null, 'c'])
  detail.positions.set('c', { x: 27, y: 21, z: 0, pinned: true })
  detail.positions.set('a', { x: 44, y: 50, z: 2, pinned: false })
  assert.equal(nav.setGroupView('expand'), true)
  const expanded = nav.getSnapshot()
  assert.equal(expanded.groupMembers, roster)
  assert.equal(expanded.data.links, data.links)
  assert.equal(expanded.selected, 'c')
  assert.equal(expanded.path.length, 2)
  assert.deepEqual(expanded.data.nodes[3], { ...nodes[3], ...root.positions.get('d') })
  assert.equal(expanded.data.nodes[0].x, 44)
  detail.emit('select', 'b')
  assert.equal(nav.getSnapshot(), expanded)
  nav.back()
  assert.equal(nav.getSnapshot().selected, 'd')
  assert.equal(nav.getSnapshot().groupMembers, initial.groupMembers)
  assert.equal(nav.getSnapshot().data.nodes[0].pinned, false)
  assert.equal(nav.getSnapshot().data.nodes[2].x, 27)
  assert.equal(nav.getSnapshot().data.nodes[2].pinned, true)
})

test('member rosters retain the final member of a large group and respect overlapping nested scopes', () => {
  const nodes = Array.from({ length: 25_000 }, (_, i) => ({ id: String(i), ordinal: i }))
  const nav = createDrilldown({ nodes, links: [] })
  nav.openGroup({ taxonomy: 'collection', id: 'all', members: nodes.map((n) => n.id) }, 'isolate')
  const all = nav.getSnapshot().groupMembers
  assert.equal(all.length, 25_000)
  assert.equal(all.at(-1), nodes.at(-1))
  nav.openGroup({ taxonomy: 'section', id: 'last', members: ['24999', '3', 'unknown', '24999'] }, 'isolate')
  nav.openGroup({ taxonomy: 'topic', id: 'overlap', members: ['2', '3'] }, 'isolate')
  assert.deepEqual(ids(nav.getSnapshot().groupMembers), ['3'])
  nav.setGroupView('expand')
  assert.deepEqual(ids(nav.getSnapshot().data.nodes), ['3', '24999'])
  nav.openNeighborhood('3')
  assert.equal(nav.getSnapshot().groupMembers.length, 0)
  assert.equal(nav.setGroupView('expand'), false)
  nav.goTo(1)
  assert.equal(nav.getSnapshot().groupMembers, all)
})

test('scoped taxonomy members keep source classifications when grouping links or hubs are outside the view', () => {
  const index = compileTaxonomies(data, { taxonomies: [
    { id: 'related', label: 'Citations', by: { relation: 'cites', groupEnd: 'target' } },
    { id: 'section', label: 'Section', by: 'section' },
  ] })
  const subset = [nodes[2], nodes[0]]
  const view = scopeTaxonomies(index, subset)
  const lab = view.legend('section').find((term) => term.id === 'lab')!
  assert.deepEqual(drilldownGroup(lab, subset).members, ['a', 'c'])
  assert.equal(view.nodeIndex('a'), 1)
  assert.equal(view.primary('a', 'related')!.id, 'b')
  assert.deepEqual(view.primary('a', 'related')!.members, [1])
  assert.equal(view.tooltip('a')!.title, index.tooltip('a')!.title)
  assert.equal(view.describe('a')!.groups.every(Boolean), true)
  assert.equal(view.describe('b'), undefined)
  assert.throws(() => scopeTaxonomies(index, [nodes[1], nodes[1]]), /duplicate/)
})
