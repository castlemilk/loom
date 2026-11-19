import type { GraphData, WireProgram } from '../types.js'
import { effectsWireFragment, effectsWireVertex } from './shaders.js'

export interface WireEffects {
  /** Centre-to-centre separation of parallel paths at their midpoint, in CSS pixels. */
  separation: number
  direction: 'none' | 'arrow' | 'flow'
  scope: 'selected' | 'all'
  /** Distance the pulse travels in CSS pixels per second. */
  speed: number
}
export const defaultWireEffects: Readonly<WireEffects> = Object.freeze({
  separation: 14, direction: 'arrow', scope: 'selected', speed: 48,
})

/** JSON Schema for a partial settings patch. Defaults describe a newly mounted wire graph. */
export const wireEffectsSchema = {
  type: 'object', additionalProperties: false, properties: {
    separation: { type: 'number', minimum: 0, maximum: 96, default: defaultWireEffects.separation, description: 'Midpoint spacing of parallel paths in CSS pixels.' },
    direction: { type: 'string', enum: ['none', 'arrow', 'flow'], default: defaultWireEffects.direction, description: 'Source-to-target direction indicator.' },
    scope: { type: 'string', enum: ['selected', 'all'], default: defaultWireEffects.scope, description: 'Apply direction to incident links of the selection or to all links.' },
    speed: { type: 'number', minimum: 0, maximum: 240, default: defaultWireEffects.speed, description: 'Flow speed in CSS pixels per second; zero holds static arrows.' },
  },
} as const
for (const field of Object.values(wireEffectsSchema.properties)) {
  if ('enum' in field) Object.freeze(field.enum)
  Object.freeze(field)
}
Object.freeze(wireEffectsSchema.properties)
Object.freeze(wireEffectsSchema)

function settings(base: WireEffects, patch: Partial<WireEffects>) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some((key) => !Object.hasOwn(base, key)))
    throw new TypeError('Expected wire effect settings.')
  const next = { ...base, ...patch }
  const { direction, scope, separation, speed } = wireEffectsSchema.properties
  if (!direction.enum.includes(next.direction) || !scope.enum.includes(next.scope))
    throw new RangeError('Invalid wire direction or scope.')
  if (!Number.isFinite(next.separation) || next.separation < separation.minimum || next.separation > separation.maximum ||
      !Number.isFinite(next.speed) || next.speed < speed.minimum || next.speed > speed.maximum)
    throw new RangeError('Wire separation must be 0–96 px and speed 0–240 px/s.')
  return Object.freeze(next)
}

// Single connections only need an index in the map. Allocate a group array on the first collision.
function topology(data: GraphData) {
  const index = new Map(data.nodes.map((node, i) => [node.id, i]))
  const incident = new Uint8Array(data.nodes.length), slots = new Float32Array(data.links.length * 2)
  const pairs = new Map<number, number | number[]>()
  for (const [i, edge] of data.links.entries()) {
    const a = index.get(edge.source), b = index.get(edge.target)
    if (a === undefined || b === undefined) throw new RangeError('Unknown wire endpoint on connection ' + i)
    incident[a] = incident[b] = 1
    const key = Math.min(a, b) * data.nodes.length + Math.max(a, b)
    const pair = pairs.get(key)
    if (pair === undefined) pairs.set(key, i)
    else if (typeof pair === 'number') pairs.set(key, [pair, i])
    else pair.push(i)
  }
  for (const edges of pairs.values()) {
    if (typeof edges === 'number') continue
    edges.sort((left, right) => {
      const a = data.links[left].id, b = data.links[right].id
      if (a === b) return left - right
      if (a === undefined) return 1
      if (b === undefined) return -1
      return a < b ? -1 : 1
    })
    for (const [rank, i] of edges.entries()) {
      const { source, target } = data.links[i]
      const centered = rank - (edges.length - 1) / 2
      slots[2 * i] = source === target ? rank : (source < target || centered === 0 ? centered : -centered)
      slots[2 * i + 1] = edges.length
    }
  }
  return { incident, slots }
}

/** Build the immutable GPU topology and mutable visual parameters for one graph. */
export function prepareWireEffects(data: GraphData, initial: Partial<WireEffects> = {}) {
  const { slots, incident } = topology(data)
  let current = defaultWireEffects
  let distance = 0
  const parameters = new Float32Array([0, 0, 0, -1])
  function update(patch: Partial<WireEffects>) {
    current = settings(current, patch)
    parameters[0] = current.separation
    parameters[1] = wireEffectsSchema.properties.direction.enum.indexOf(current.direction)
    parameters[2] = Number(current.scope === 'all')
    parameters[3] = -1
  }
  update(initial)
  const program: WireProgram = {
    vertex: effectsWireVertex, fragment: effectsWireFragment, slots, parameters,
    step(deltaMs, selectedIndex, reducedMotion) {
      const active = !reducedMotion && current.direction === 'flow' && current.speed > 0 &&
        (current.scope === 'all' ? data.links.length > 0 : incident[selectedIndex] === 1)
      if (active) distance = (distance + deltaMs * current.speed / 1000) % 72
      parameters[3] = active ? distance : -1
      return active
    },
  }
  return { program, get: () => current, update }
}
