import test from 'node:test'
import assert from 'node:assert/strict'
import { Camera } from '../src/camera.js'
import { prepare } from '../src/model.js'
import { Resolution, Scheduler } from '../src/scheduler.js'
import { Layout } from '../src/sim/layout.js'
import { ChargeTree } from '../src/sim/tree.js'
import { PickGrid, LabelGrid } from '../src/render/grid.js'
import { parchment, fromBinary, toBinary, fromConsole } from '../src/index.js'
import { mountConsoleGraph } from '../src/console.js'
import { fixture } from '../demo/fixture.js'
import { buildWorkload, initialWorkload, presets, mergeWorkload, importWorkload, imageURL } from '../web/app/workload.mjs'
import { cloudTargets } from '../src/sim/cloud.js'
import { observePerformance } from '../src/performance.js'

test('repeatable workloads change payload independently of topology and support capped append and import', () => {
  const config = { ...initialWorkload, nodes: 60, coverage: 100, variety: 6, text: 'articles' }
  const data = buildWorkload(config)
  assert.deepEqual(data, buildWorkload(config))
  assert.equal(data.links.length, 240)
  assert.equal(Object.keys(data.artwork).length, 6)
  assert.ok(data.nodes.every((n) => n.content.length > 350 && imageURL(data, n, '/loom').startsWith('/loom/graphs/specimens/')))
  const bare = buildWorkload({ ...config, coverage: 0, text: 'labels' })
  assert.deepEqual(bare.links, data.links)
  assert.ok(bare.nodes.every((n) => !n.art && !n.content && !n.summary))
  assert.notDeepEqual(buildWorkload({ ...config, seed: 3 }).links, data.links)
  for (const preset of Object.values(presets)) {
    const example = buildWorkload({ ...preset, seed: 17 })
    assert.equal(example.nodes.length, preset.nodes)
    assert.equal(example.links.length, preset.nodes * preset.degree)
    assert.ok(example.links.every((l) => l.source !== l.target))
  }
  const custom = importWorkload({ nodes: [{ id: 'batch1-n0', art: 'specimen-0' }], edges: [],
    artwork: { 'specimen-0': 'https://example.org/a.webp' } })
  const combined = mergeWorkload(custom, config)
  assert.equal(combined.nodes.length, 61)
  assert.equal(combined.links.length, 241)
  assert.equal(imageURL(combined, combined.nodes[0]), 'https://example.org/a.webp')
  assert.deepEqual(importWorkload(JSON.parse(JSON.stringify(combined))), combined)
  assert.throws(() => buildWorkload({ ...config, nodes: 25000, degree: 5 }), /100,000 links/)
  assert.throws(() => mergeWorkload(custom, { ...config, nodes: 25000 }), /combined/)
  assert.throws(() => importWorkload({ ...custom, links: [{ source: 'missing', target: 'x' }] }), /existing/)
  assert.throws(() => importWorkload({ nodes: [{ id: 'x', art: 'file:///tmp/x' }], links: [] }), /raster/)
})

test('Cloud has a deterministic volume at full structure and preserves authored planes and coordinates', () => {
  const nodes = Array.from({ length: 128 }, (_, i) => ({ id: 'n' + i }))
  const volume = cloudTargets(nodes, {}), flat = cloudTargets(nodes, { cloudDepth: 0 })
  const depths = nodes.map((_, i) => volume[3 * i + 2])
  assert.ok(Math.max(...depths) - Math.min(...depths) > 200)
  assert.ok(depths.filter((z) => z > 0).length > 55 && depths.filter((z) => z < 0).length > 55)
  nodes.forEach((_, i) => {
    assert.equal(flat[i * 3], volume[i * 3])
    assert.equal(Math.abs(flat[i * 3 + 2]), 0)
  })
  assert.deepEqual([...cloudTargets([{ id: 'a', x: 0, y: 12, z: 0 }], { cloudDepth: 3 })], [0, 12, 0])
  assert.deepEqual([...cloudTargets([{ id: 'a' }], { anchor: () => ({ x: 7, y: -5 }) })], [7, -5, 0])
  const cam = new Camera('cloud')
  cam.yaw = cam.pitch = 0
  cam.width = 1200; cam.height = 400
  const p = new Float32Array(8)
  cam.project(0, 0, 110, p, 0, cam.basis()); cam.project(0, 0, -110, p, 4, cam.basis())
  assert.ok(p[2] / p[6] > 1.6)
})

test('performance monitoring resolves async GPU queries, reports disjoint and unavailable clocks, and detaches', async () => {
  for (const supported of [true, false]) {
    const target = new EventTarget(), ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2, QUERY_COUNTER_BITS_EXT: 4 }
    let active = false, deleted = 0, disjoint = false, off = 0, removeDestroy = 0, snap, probe, destroy
    const gl = { canvas: target, isContextLost: () => false, getExtension: () => supported ? ext : null,
      createQuery: () => ({}), getQuery: (_, param) => param === 4 ? 64 : null, beginQuery: () => { active = true }, endQuery: () => { active = false },
      getParameter: () => disjoint, QUERY_RESULT_AVAILABLE: 3,
      getQueryParameter: (_, which) => which === 3 ? true : 2500000, deleteQuery: () => { deleted++ } }
    const graph = { stats: () => ({ frames: 12 }), onTiming: (p) => { probe = p; return () => { off++ } },
      on: (_, f) => { destroy = f; return () => { removeDestroy++ } } }
    const stop = observePerformance(graph, (s) => { snap = s })
    const draw = () => {
      probe.beginDraw(gl); assert.equal(active, supported); probe.endDraw()
      probe.sample(performance.now(), 2, 16, true)
    }
    const until = async (check) => {
      const deadline = performance.now() + 2300
      while (!check()) { assert.ok(performance.now() < deadline); await new Promise((r) => setTimeout(r, 20)) }
    }
    draw()
    const eventStart = Math.ceil(performance.now()) + 10
    probe.sample(eventStart, 2, 0, true)
    probe.sample(eventStart + 16, 2, 0, true)
    probe.sample(eventStart + 32, 2, 0, true)
    await until(() => snap?.gpuStatus === (supported ? 'measured' : 'unavailable'))
    assert.equal(snap.gpuMs, supported ? 2.5 : null); assert.equal(snap.mainThreadMs, 2)
    assert.deepEqual(snap.frameIntervals.slice(-2), [16, 16])
    if (supported) {
      disjoint = true; draw(); await until(() => snap?.gpuStatus === 'disjoint')
      assert.equal(snap.gpuMs, null)
    }
    await until(() => snap?.idle); assert.equal(snap.fps, 0)
    destroy(); stop()
    assert.equal(off, 1); assert.equal(removeDestroy, 1); assert.equal(deleted, supported ? 2 : 0)
  }
})
import { compileTaxonomies, parseTaxonomy } from '../src/taxonomy.js'
import { groupOutline } from '../src/group-outline.js'
import { orbitTargets } from '../src/sim/orbit.js'
import { layoutForces, makeLanes } from '../src/constraints.js'

test('taxonomy membership, vocabulary, exclusive lanes and overlapping relation groups share one index', () => {
  const data = {
    nodes: [{ id: 'a', kind: 'lab', topics: ['wave', 'field', 'wave'] }, { id: 'b', kind: 'lab' },
      { id: 'x', label: 'Physics' }, { id: 'y', label: 'Optics' }, { id: 'alone' }],
    links: [{ source: 'a', target: 'x', kind: 'in' }, { source: 'a', target: 'y', kind: 'in' },
      { source: 'b', target: 'x', kind: 'in' }, { source: 'a', target: 'x', kind: 'in' }, { source: 'b', target: 'b', kind: 'cites' }],
  }
  const index = compileTaxonomies(data, {
    taxonomies: [
      { id: 'subject', label: 'Subject', by: { relation: 'in', groupEnd: 'target' } },
      { id: 'family', label: 'Family', by: 'topics', remap: { wave: ['light', 'physics'], field: 'physics' },
        terms: { physics: { label: 'Physical science', color: '#fed', description: 'Matter and energy' } } },
      { id: 'connected', label: 'Degree', by: (node, ctx) => ctx.linksFor(node.id).length ? 'linked' : null },
    ], language: { title: (node) => node.label ?? node.id.toUpperCase(), connections: (n) => n + ' references', ungrouped: 'Other' },
  })
  assert.deepEqual(index.legend('subject').map((g) => [g.label, g.members]), [['Optics', [0, 3]], ['Physics', [0, 1, 2]]])
  assert.deepEqual(index.legend('family').map((g) => [g.id, g.members]), [['physics', [0]], ['light', [0]]])
  assert.equal(index.primary('a', 'subject')?.label, 'Physics')
  assert.equal(index.primary('a', 'family')?.id, 'light')
  assert.equal(index.describe('b')?.connections, '2 references')
  assert.deepEqual(index.tooltip('a'), { title: 'A', lines: ['Subject · Physics, Optics', 'Family · light, Physical science (Matter and energy)', 'Degree · linked', '3 references'] })
  assert.equal(index.tooltip('unknown'), undefined)
  assert.deepEqual(makeLanes(data.nodes, { laneBy: index.laneBy('subject') }).keys, ['x', 'x', 'x', 'y', ''])
  assert.equal(index.ungrouped, 'Other')
  const custom = compileTaxonomies(data, { taxonomies: [], language: { tooltip: (node) => ({ title: 'Inspect', lines: [node.id] }) } })
  assert.deepEqual(custom.tooltip('a'), { title: 'Inspect', lines: ['a'] })
  const rule = parseTaxonomy('{"id":"n","label":"N","by":"kind","terms":{"lab":{"label":"Laboratory","color":"#abc"}}}')
  assert.equal(compileTaxonomies(data, { taxonomies: [rule] }).legend('n')[0].label, 'Laboratory')
  assert.throws(() => compileTaxonomies(data, { taxonomies: [rule, rule] }), /duplicate/)
  for (const bad of [{ by: { relation: 'in', groupEnd: 'left' } }, { terms: { lab: { label: 'Lab', color: ['#fff'] } } },
    { remap: { wave: [2] } }]) assert.throws(() => parseTaxonomy(JSON.stringify({ ...rule, ...bad })), TypeError)
})

test('rounded group boundaries enclose projected discs and track movement, including a singleton', () => {
  const points = new Float32Array([15, 25, 4, 0, 80, -5, 12, 0])
  assert.equal(groupOutline(points, [], 8), '')
  const single = groupOutline(points, [0], 7)
  assert.ok(single.startsWith('M26.0 ') && single.endsWith('Z'))
  const both = groupOutline(points, [0, 1], 7)
  assert.ok(both.startsWith('M99.0 ') && !both.includes('NaN'))
  points[4] = 145
  assert.ok(groupOutline(points, [0, 1], 7).startsWith('M164.0 '))
  assert.equal(groupOutline(points, [0], 7), single)
})

test('Orbit picks the hub, sorts neighbours into concentric rings, and re-centres on selection', () => {
  const nodes = [{ id: 'leaf' }, { id: 'hub', x: 35, y: -20, pinned: false }, { id: 'arm' },
    { id: 'far' }, { id: 'spare', x: 500, y: 200, degree: 999 }, { id: 'other' }]
  const links = [['hub', 'leaf'], ['arm', 'hub'], ['arm', 'far'], ['hub', 'other']].map(([source, target]) => ({ source, target }))
  const model = prepare({ nodes, links }, parchment, 'orbit'), targets = orbitTargets(model, -1, 90)
  const radius = (values: Float32Array, stride: number, i: number, centre: number) =>
    Math.hypot(values[i * stride] - values[centre * stride], values[i * stride + 1] - values[centre * stride + 1])
  assert.deepEqual([...targets.slice(3, 6)], [35, -20, 0])
  for (const [i, r] of [90, 0, 90, 180, 270, 90].entries()) assert.ok(Math.abs(radius(targets, 3, i, 1) - r) < 0.01)
  assert.deepEqual(targets, orbitTargets(prepare({ nodes, links: [...links].reverse() }, parchment, 'orbit'), -1, 90))
  const moved = orbitTargets(model, 3, 90)
  for (const [i, r] of [270, 180, 90, 0, 270, 270].entries()) assert.ok(Math.abs(radius(moved, 3, i, 3) - r) < 0.01)
  const sim = new Layout(model, 'orbit', layoutForces({ blend: 0.25 }), targets)
  while (sim.alpha) sim.advance(20)
  assert.ok(Math.abs(radius(model.positions, 4, 0, 1) - 90) < 16)
  assert.ok(radius(model.positions, 4, 3, 1) > 150)
  sim.configure('orbit', { forces: layoutForces({ blend: 1 }), targets: moved })
  assert.ok(Math.abs(radius(model.positions, 4, 0, 3) - 270) < 0.01)
  assert.deepEqual([...model.positions.slice(16, 18)], [500, 200])
  assert.equal(orbitTargets(prepare({ nodes: [], links: [] }, parchment, 'orbit'), -1).length, 0)
})

test('spiral, topology and pinned zero coordinates are deterministic without mutating input', () => {
  const data = {
    nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b' }, { id: 'c' }],
    links: [{ source: 'a', target: 'b' }],
  }
  const a = prepare(data, parchment, 'drift'),
    b = prepare(data, parchment, 'drift')
  assert.deepEqual(a.positions, b.positions)
  assert.deepEqual([...a.fixed], [1, 0, 0])
  assert.equal(a.movable, 2)
  assert.deepEqual([...a.degree], [1, 1, 0])
  assert.ok(Math.abs(Math.hypot(a.positions[4], a.positions[5]) - 14) < 1e-5)
  assert.equal(data.nodes[1].x, undefined)
  assert.throws(
    () => prepare({ ...data, nodes: [data.nodes[0], data.nodes[0]] }, parchment, 'drift'),
    /duplicate/,
  )
  assert.throws(
    () => prepare({ ...data, links: [{ source: 'b', target: 'd' }] }, parchment, 'drift'),
    /endpoint/,
  )
})
test('protobuf wire compatibility, UTF-8, explicit zeros, offset views and unknown fields', () => {
  // Independently encoded proto3: Graph.nodes { id: "a", x: 0 }, links { source: "a", target: "a" }.
  const wire = Uint8Array.of(10, 8, 10, 1, 97, 37, 0, 0, 0, 0, 18, 6, 10, 1, 97, 18, 1, 97)
  const graph = { nodes: [{ id: 'a', x: 0 }], links: [{ source: 'a', target: 'a' }] }
  assert.deepEqual(toBinary(graph), wire)
  assert.deepEqual(fromBinary(wire), graph)
  const wrapped = Uint8Array.of(9, ...wire, 0x98, 0x06, 0x96, 1, 9)
  assert.deepEqual(fromBinary(wrapped.subarray(1, -1)), graph)
  const rich = {
    nodes: [
      {
        id: '研究🪐',
        label: 'λ'.repeat(900),
        x: -1.25,
        y: 0,
        z: 4,
        art: 'picture',
        degree: 0xffffffff,
        kind: 'lab',
      },
      { id: 'missing' },
    ],
    links: [],
  }
  assert.deepEqual(fromBinary(toBinary(rich)), rich)
  for (const invalid of [
    [10, 5, 10, 1, 97],
    [10, 2, 37, 0],
    [128],
    [0],
    [14],
    [10, 1, 11],
    [255, 255, 255, 255, 255, 0],
  ]) {
    assert.throws(() => fromBinary(new Uint8Array(invalid)), RangeError)
  }
})
test('quadtree and octree reduce to direct repulsion for a pair and tolerate coincident buckets', () => {
  for (const volume of [false, true]) {
    const tree = new ChargeTree(2, volume),
      p = new Float32Array([0, 0, 0, 2, 30, 0, volume ? 5 : 0, 2]),
      v = new Float32Array(6)
    tree.reset(40)
    tree.insert(0, 0, 0)
    tree.insert(30, 0, p[6])
    tree.repel(0, p, v, 1)
    assert.ok(Math.abs(v[0] - (-30 * 19) / (900 + p[6] ** 2 + 42)) < 1e-5)
    tree.reset(1)
    for (let i = 0; i < 800; i++) tree.insert(0, 0, 0)
    tree.repel(0, p, v, 1)
    assert.ok(v.every(Number.isFinite))
  }
})
test('layout converges identically across slice sizes and holds pinned nodes in 2D and 3D', () => {
  for (const mode of ['drift', 'lanes', 'orbit', 'cloud'] as const) {
    const data = fixture(36)
    Object.assign(data.nodes[0], { x: 0, y: -12, z: 3 })
    const settle = (budget: number) => {
      const model = prepare(data, parchment, mode),
        before = model.positions.slice(),
        sim = new Layout(model, mode)
      sim.configure(mode)
      while (sim.alpha) sim.advance(budget)
      assert.deepEqual(model.positions.slice(0, 4), before.slice(0, 4))
      assert.notDeepEqual(model.positions, before)
      assert.ok(model.positions.every(Number.isFinite))
      assert.equal(sim.advance(100), 0)
      assert.ok(sim.ticks > 1)
      return model.positions
    }
    assert.deepEqual(settle(0.2), settle(12))
  }
})
test('pinned graphs skip all ticks and dragging restores movable particles', () => {
  const model = prepare(fixture(8, true), parchment, 'drift'),
    sim = new Layout(model, 'drift')
  assert.equal(sim.advance(5), 0)
  sim.pin(3, -8, 4, 1)
  assert.equal(model.positions[12], -8)
  assert.equal(sim.alpha, 0)
  sim.pin(3, -8, 4, 0)
  assert.ok(sim.alpha > 0)
})
test('sleep gate coalesces wakeups and composes manual, visibility and context holds', () => {
  let counter = 0,
    calls = 0
  const queued = new Map<number, FrameRequestCallback>()
  const scheduler = new Scheduler(
    () => {
      calls++
      return calls === 1
    },
    (cb) => {
      queued.set(++counter, cb)
      return counter
    },
    (id) => {
      queued.delete(id)
    },
  )
  const run = () => {
    const entries = [...queued]
    queued.clear()
    for (const [, cb] of entries) cb(0)
  }
  scheduler.wake()
  scheduler.wake()
  assert.equal(queued.size, 1)
  run()
  run()
  assert.equal(calls, 2)
  assert.equal(queued.size, 0)
  scheduler.wake()
  scheduler.suspend('manual', true)
  scheduler.suspend('viewport', true)
  scheduler.suspend('manual', false)
  scheduler.wake()
  assert.equal(queued.size, 0)
  scheduler.suspend('viewport', false)
  assert.equal(queued.size, 1)
  scheduler.destroy()
  scheduler.wake()
  assert.equal(queued.size, 0)
})
test('resolution responds to sustained frame pressure and recovers after cooldown', () => {
  const r = new Resolution(2)
  for (let i = 0; i < 7; i++) r.sample(18, 24, i * 20)
  assert.equal(r.scale, 2)
  assert.equal(r.sample(18, 24, 140), true)
  assert.ok(r.scale < 2)
  for (let i = 0; i < 100; i++) r.sample(3, 16, 1000 + i * 16)
  assert.equal(r.scale, 2)
})
test('eased zoom keeps its cursor anchor and grid picking agrees with the camera', () => {
  const c = new Camera('drift')
  c.width = 600
  c.height = 400
  const projected = new Float32Array(4)
  c.zoomAt(400, 150, 2)
  while (c.step()) {
    c.project(100, -50, 0, projected, 0, c.basis())
    assert.ok(Math.abs(projected[0] - 400) < 0.03)
  }
  const p = new Float32Array([100, -50, 0, 5, 0, 0, 0, 8]),
    grid = new PickGrid(2)
  grid.rebuild(p, c)
  assert.equal(grid.pick(400, 150), 0)
  assert.equal(grid.pick(4, 4), -1)
  c.mode = 'cloud'
  c.yaw = 0.8
  c.pitch = 0.3
  grid.rebuild(p, c)
  assert.equal(grid.pick(grid.projected[4], grid.projected[5], true), 1)
})
test('greedy labels reject overlaps across cells and allow disjoint boxes in one cell', () => {
  const g = new LabelGrid()
  assert.ok(g.place(48, 12, 64, 28))
  assert.equal(g.place(64, 32, 20, 10), false)
  assert.ok(g.place(48, 41, 12, 8))
  g.clear()
  assert.ok(g.place(64, 32, 20, 10))
})
test('console adapter preserves typed metadata and flag-off invokes the legacy canvas path alone', () => {
  const graph = {
    nodes: [{ id: 'a', href: '/a' }],
    edges: [{ source: 'a', target: 'a', evidence: 'registry-category' }],
  }
  const adapted = fromConsole(graph)
  assert.equal(adapted.nodes, graph.nodes)
  assert.equal(adapted.links, graph.edges)
  assert.equal(
    mountConsoleGraph({} as HTMLCanvasElement, graph, false, (_, v) => v),
    graph,
  )
})

test('structured targets keep lane and ID order, support authored anchors, and leave pins fixed', async () => {
  const { makeTargets, layoutForces, placeOnTargets } = await import('../src/constraints.js')
  const nodes = [
    { id: 'b', kind: 'task' },
    { id: 'a', kind: 'task' },
    { id: 'h', kind: 'hub', x: 18, y: -7 },
  ]
  const config = { blend: 1, laneOrder: ['hub', 'task'], laneGap: 100, rowGap: 20 }
  assert.deepEqual([...makeTargets(nodes, config)], [50, 10, 0, 50, -10, 0, -50, 0, 0])
  const vertical = makeTargets(nodes, {
    ...config,
    direction: 'vertical',
    anchor: (n) => (n.id === 'b' ? { x: 3, y: 1, z: 7 } : null),
  })
  assert.deepEqual([...vertical], [3, 1, 7, -10, 50, 0, 0, -50, 0])
  const model = prepare({ nodes, links: [] }, parchment, 'drift')
  placeOnTargets(model.positions, model.fixed, vertical)
  assert.deepEqual([...model.positions.slice(8, 11)], [18, -7, 0])
  assert.throws(() => layoutForces({ blend: 1.1 }), /blend/)
  assert.throws(() => makeTargets(nodes, { anchor: () => ({ x: NaN, y: 0 }) }), /anchor/)
})

test('mixed constraints pull movable nodes toward the same diagram with tunable link forces', async () => {
  const { makeTargets, layoutForces, placeOnTargets } = await import('../src/constraints.js')
  const data = fixture(25),
    config = { laneGap: 130, rowGap: 26 },
    t = makeTargets(data.nodes, config)
  function settle(blend: number) {
    const model = prepare(data, parchment, 'drift'),
      forces = layoutForces({ blend })
    placeOnTargets(model.positions, model.fixed, t, blend)
    const sim = new Layout(model, 'drift', forces, t)
    while (sim.alpha) sim.advance(15)
    return {
      ticks: sim.ticks,
      distance: data.nodes.reduce(
        (sum, _, i) =>
          sum + Math.hypot(model.positions[i * 4] - t[i * 3], model.positions[i * 4 + 1] - t[i * 3 + 1]),
        0,
      ),
    }
  }
  const free = settle(0),
    mixed = settle(0.55),
    locked = settle(1)
  assert.ok(mixed.distance > 0 && mixed.distance < free.distance)
  assert.equal(locked.distance, 0)
  assert.equal(locked.ticks, 0)
})

test('theme resolves default, kind and datum styles, zero opacity and distinct strokes', async () => {
  const { appearance } = await import('../src/appearance.js')
  const data = {
    nodes: [
      { id: 'a', kind: 'task' },
      { id: 'b', kind: 'task' },
    ],
    links: [
      { source: 'a', target: 'b', kind: 'signal' },
      { source: 'a', target: 'a', kind: 'mute' },
    ],
  }
  const theme = {
    ...parchment,
    nodes: {
      scale: 2,
      byKind: { task: { color: '#f00', radius: 4, shape: 'square' as const } },
      resolve: (n) => (n.id === 'b' ? { shape: 'ring' as const, color: '#00f', radius: 8 } : undefined),
    },
    wires: {
      width: 2,
      byKind: { signal: { color: '#0f0', width: 3 } },
      resolve: (l) => (l.kind === 'mute' ? { opacity: 0, width: 0 } : undefined),
    },
  }
  const look = appearance(data, new Uint32Array([2, 1]), theme)
  assert.deepEqual([...look.radii], [8, 16])
  assert.deepEqual([...look.style], [255, 0, 0, 64, 0, 0, 255, 192])
  assert.deepEqual([...look.wireWidths!], [3, 0])
  assert.deepEqual([...look.wireColors!.slice(0, 3)], [0, 255, 0])
  assert.equal(look.wireColors![7], 0)
  assert.throws(
    () => appearance(data, new Uint32Array(2), { ...theme, wires: { opacity: -1 } }),
    /opacity/,
  )
})

test('lane axis, order and per-kind spring settings affect force-mode physics', async () => {
  const { makeSprings, layoutForces } = await import('../src/constraints.js')
  const data = {
    nodes: [
      { id: 'a', kind: 'source', x: 0, y: 0 },
      { id: 'b', kind: 'sink' },
    ],
    links: [{ source: 'a', target: 'b', kind: 'signal' }],
  }
  assert.deepEqual([...makeSprings(data.links, { signal: { strength: 0 } })!], [-1, 0])
  assert.equal(makeSprings(data.links, undefined), null)
  assert.throws(() => makeSprings(data.links, { signal: { strength: -1 } }), /strength/)
  function settle(mode: 'drift' | 'lanes', options: import('../src/types.js').LayoutOptions) {
    const model = prepare(data, parchment, mode, options)
    const sim = new Layout(model, mode, layoutForces(options))
    while (sim.alpha) sim.advance(10)
    return [...model.positions.slice(4, 6)]
  }
  const common = { repulsion: 0, linkDistance: 0, springStrength: 1 }
  const short = settle('drift', common),
    long = settle('drift', { ...common, springsByKind: { signal: { distance: 150, strength: 3 } } })
  assert.ok(Math.hypot(...long) > Math.hypot(...short) + 70)
  const lanes = { springStrength: 0, repulsion: 0, laneOrder: ['source', 'sink'], laneGap: 400 }
  assert.ok(settle('lanes', lanes)[0] > 75)
  assert.ok(settle('lanes', { ...lanes, direction: 'vertical' })[1] > 75)
})

test('pre-positioned movable nodes and persistent pins survive protobuf round trips', () => {
  const data = {
    nodes: [
      { id: 'free', x: 0, y: 3, pinned: false },
      { id: 'fixed', x: 2, y: 0 },
      { id: 'seeded-pin', pinned: true },
    ],
    links: [],
  }
  const decoded = fromBinary(toBinary(data))
  assert.deepEqual(decoded, data)
  const model = prepare(decoded, parchment, 'drift')
  assert.deepEqual([...model.fixed], [0, 1, 1])
  assert.equal(model.movable, 1)
  assert.deepEqual([...model.positions.subarray(0, 2)], [0, 3])
})

test('frequent pointer moves preserve in-flight physics ticks and released nodes settle', () => {
  const model = prepare(fixture(96), parchment, 'drift'),
    sim = new Layout(model, 'drift')
  for (let sample = 0; sample < 600 && sim.ticks < 3; sample++) {
    sim.pin(0, 60 + 0.2 * sample, -12, 1)
    sim.advance(0, 1)
  }
  assert.equal(sim.ticks, 3)
  const afterDrag = model.positions[0]
  sim.pin(0, afterDrag, -12, 0)
  const ticks = sim.ticks
  sim.advance(300, 1)
  assert.equal(sim.ticks, ticks + 1)
  while (sim.alpha) sim.advance(12)
  assert.notEqual(model.positions[0], afterDrag)
})

test('screen-plane dragging is the inverse of the rotated perspective camera', () => {
  const c = new Camera('cloud')
  c.width = 860
  c.height = 480
  c.x = 13
  c.y = -31
  c.z = 56
  c.zoom = 1.7
  c.yaw = 0.83
  c.pitch = -0.42
  const projected = new Float32Array(4)
  c.project(55, -11, 80, projected, 0, c.basis())
  const [px, py, , depth] = projected
  const world = c.unproject(px + 72, py - 18, depth)
  c.project(...world, projected, 0, c.basis())
  assert.ok(Math.abs(projected[0] - px - 72) < 1e-4 && Math.abs(projected[1] - py + 18) < 1e-4)
  assert.ok(Math.abs(projected[3] - depth) < 1e-4)
})
