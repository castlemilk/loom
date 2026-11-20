import assert from 'node:assert/strict'
import test from 'node:test'
import { captureScene, mountScene } from '../src/scene.js'
import { parchment } from '../src/theme.js'

test('scene JSON preserves application records and resolves styles for loops, parallel links and authored degrees', () => {
  const data = { title: 'Signal path', nodes: [
    { id: '__proto__', label: '<Signal> & "sound"', family: 'audio', degree: 9 },
    { id: 'constructor', label: 'Output', family: 'sink' },
  ], links: [
    { source: '__proto__', target: 'constructor', count: 3 },
    { source: '__proto__', target: 'constructor', count: 2 },
    { source: 'constructor', target: 'constructor', count: 1 },
  ] }
  const scene = captureScene(data, {
    mode: 'lanes', selected: '__proto__', drawingStyle: { fill: 'cross-hatch' }, wireEffects: { direction: 'flow' },
    layout: { laneBy: node => node.family, anchor: (_, i) => i ? null : { x: 8, y: 4 }, blend: 0.8 },
    theme: { ...parchment, nodes: { resolve: (_, degree) => ({ radius: degree }) },
      wires: { resolve: (link, i) => i < 2 ? { width: link.count } : undefined } },
    art: { urlFor: () => 'https://images.example/signal.png' },
    graph: { getPosition: id => ({ x: 4, y: 5, z: 6, pinned: id === 'constructor' }),
      getViewport: () => ({ x: 7, y: 8, z: 0, zoom: 2, yaw: 1.2, pitch: 0 }) },
  })
  const saved = JSON.parse(JSON.stringify(scene))
  assert.deepEqual(saved.data, data)
  assert.deepEqual(saved.lanes, JSON.parse('{"__proto__":"audio","constructor":"sink"}'))
  assert.equal(saved.nodeStyles.__proto__.radius, 9)
  assert.equal(saved.nodeStyles.constructor.radius, 4)
  assert.deepEqual(saved.linkStyles, { 0: { width: 3 }, 1: { width: 2 } })
  assert.deepEqual(saved.anchors.__proto__, { x: 8, y: 4 })
  assert.equal(Object.hasOwn(saved.anchors, 'constructor'), false)
  assert.deepEqual(saved.artwork.urls, ['https://images.example/signal.png'])
  assert.equal(saved.artwork.byNode.__proto__, 0)
  assert.equal(saved.artwork.byNode.constructor, 0)
  assert.equal(saved.positions.constructor.pinned, true)
  assert.equal(saved.viewport.zoom, 2)
  assert.equal(saved.layout.blend, 0.8)
  assert.equal(saved.selected, '__proto__')
  assert.equal(saved.drawingStyle.fill, 'cross-hatch')
  assert.equal(saved.wireEffects.direction, 'flow')
  assert.deepEqual(saved.theme.nodes, {})
  assert.equal(data.nodes[0].label, '<Signal> & "sound"')
})

test('a minimal scene has only version and graph after serialization, and unknown versions fail before mounting', () => {
  const data = { nodes: [], links: [] }
  assert.deepEqual(JSON.parse(JSON.stringify(captureScene(data))), { version: 1, data })
  assert.throws(() => mountScene({} as HTMLCanvasElement, JSON.parse('{"version":2}')), /scene version/)
})
