import assert from 'node:assert/strict'
import test from 'node:test'
import { fromBinary, toBinary } from '../src/io/binary.js'
import { defaultWireEffects, prepareWireEffects, wireEffectsSchema } from '../src/render/wire-effects.js'
import type { GraphData, GraphLink } from '../src/types.js'

const nodes = ['a', 'b', 'a|b', 'c', 'b|c', 'alone'].map((id) => ({ id }))
const link = (id: string, source: string, target: string): GraphLink => ({ id, source, target })
const links = [link('z', 'a', 'b'), link('x', 'b', 'a'), link('y', 'a', 'b'), link('solo', 'a|b', 'c'), link('other', 'a', 'b|c')]

test('Parallel and reciprocal lanes retain their physical side after ordering or protobuf changes', () => {
  function lanes(data: GraphData) {
    const { program } = prepareWireEffects(data)
    return Object.fromEntries(data.links.map((e, i) => [e.id, [...program.slots.slice(2*i, 2*i+2)]]))
  }
  const expected = { x: [1,3], y: [0,3], z: [1,3], solo: [0,0], other: [0,0] }
  assert.deepEqual(lanes({ nodes, links }), expected)
  assert.deepEqual(lanes({ nodes: nodes.toReversed(), links: links.toReversed() }), expected)
  assert.deepEqual(lanes(fromBinary(toBinary({ nodes, links }))), expected)
  assert.throws(() => prepareWireEffects({ nodes, links: [link('bad', 'missing', 'a')] }), /endpoint/)
})

test('Anonymous paths follow input order and self-loops retain distinct angles', () => {
  const { program } = prepareWireEffects({ nodes, links: [
    { source: 'a', target: 'b' }, { source: 'a', target: 'b' },
    link('third', 'c', 'c'), link('first', 'c', 'c'), link('second', 'c', 'c'),
  ] })
  assert.deepEqual([...program.slots], [-.5,2, .5,2, 2,3, 0,3, 1,3])
})

test('Only eligible links request frames, with a continuous phase across pauses and speed edits', () => {
  const effects = prepareWireEffects({ nodes, links }, { direction: 'flow' })
  const { parameters, step } = effects.program
  assert.equal(step(1000, -1, false), false)
  assert.equal(step(1000, 5, false), false)
  assert.equal(step(1000, 0, true), false)
  assert.equal(parameters[3], -1)
  assert.equal(step(1000, 0, false), true)
  assert.equal(parameters[3], 48)
  effects.update({ scope: 'all', speed: 12 })
  assert.equal(step(1000, -1, false), true)
  assert.equal(parameters[3], 60)
  assert.equal(step(1000, -1, true), false)
  assert.equal(parameters[3], -1)
  assert.equal(step(1000, -1, false), true)
  assert.equal(parameters[3], 0)
  effects.update({ speed: 0 })
  assert.equal(step(1000, 0, false), false)
  for (const direction of ['none', 'arrow'] as const) {
    effects.update({ direction, speed: 100 })
    assert.equal(step(1000, 0, false), false)
  }
  assert.equal(prepareWireEffects({ nodes, links: [] }, { direction: 'flow', scope:'all' }).program.step(100,0,false), false)
})

test('API defaults match the schema and invalid patches leave GPU parameters intact', () => {
  const effects = prepareWireEffects({ nodes, links })
  assert.deepEqual(effects.get(), defaultWireEffects)
  assert.deepEqual(Object.fromEntries(Object.entries(wireEffectsSchema.properties).map(([k,v]) => [k, v.default])), effects.get())
  effects.update({ separation: 96, direction: 'flow', scope: 'all', speed: 240 })
  const before = effects.get(), uniforms = effects.program.parameters.slice()
  assert.ok(Object.isFrozen(before))
  for (const bad of [{ speed: -1 }, { speed: Infinity }, { separation: 97 }, { separation: NaN },
    { separation: 10, scope: 'none' }, { direction: 'sideways' }, { unknown: 4 }, null]) {
    assert.throws(() => effects.update(bad as never))
    assert.equal(effects.get(), before)
    assert.deepEqual(effects.program.parameters, uniforms)
  }
})
