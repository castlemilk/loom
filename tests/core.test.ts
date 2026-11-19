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
      sim.configure(mode, 3)
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
