import type { GraphData, LayoutOptions, Mode, Theme } from './types.js'
import { appearance } from './appearance.js'
import { makeLanes, makeSprings } from './constraints.js'

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
export function pinFlag(value: boolean) {
  if (typeof value !== 'boolean') throw new TypeError('Expected a boolean pin flag')
  return Number(value)
}
export function prepare(data: GraphData, theme: Theme, mode: Mode, layout: LayoutOptions = {}) {
  const n = data.nodes.length
  const byId = new Map<string, number>()
  const positions: Float32Array = new Float32Array(
    Math.max(1, Math.ceil(n / 256)) * Math.min(256, Math.max(1, n)) * 4,
  )
  const fixed = new Uint8Array(n),
    degree = new Uint32Array(n)
  const endpoints = new Uint32Array(data.links.length * 2)
  for (let i = 0; i < n; i++) {
    const { id } = data.nodes[i]
    if (typeof id !== 'string' || !id.length || byId.has(id))
      throw new TypeError('Missing or duplicate node id: ' + id)
    byId.set(id, i)
  }
  for (let i = 0; i < data.links.length; i++) {
    const link = data.links[i],
      a = byId.get(link.source),
      b = byId.get(link.target)
    if (a === undefined || b === undefined)
      throw new TypeError('Unknown endpoint: ' + link.source + ' → ' + link.target)
    endpoints[2 * i] = a
    endpoints[2 * i + 1] = b
    degree[a]++
    degree[b]++
  }
  const laneMap = makeLanes(data.nodes, layout)
  let movable = 0
  for (let i = 0; i < n; i++) {
    const node = data.nodes[i],
      k = i * 4
    for (const value of [node.x, node.y, node.z]) {
      if (value !== undefined && !Number.isFinite(value))
        throw new TypeError('Non-finite position for ' + node.id)
    }
    const explicit = node.x !== undefined && node.y !== undefined
    const angle = i * goldenAngle,
      r = Math.sqrt(i) * 14
    positions[k] = node.x ?? Math.cos(angle) * r
    positions[k + 1] = node.y ?? Math.sin(angle) * r
    positions[k + 2] = node.z ?? (mode === 'cloud' && !explicit ? cloudDepth(i, n) : 0)
    if (
      node.degree !== undefined &&
      (!Number.isInteger(node.degree) || node.degree < 0 || node.degree > 0xffffffff)
    ) {
      throw new RangeError('Invalid degree for ' + node.id)
    }
    degree[i] = node.degree ?? degree[i]
    fixed[i] = pinFlag(node.pinned ?? explicit)
    if (!fixed[i]) movable++
  }
  const look = appearance(data, degree, theme)
  for (let i = 0; i < n; i++) positions[i * 4 + 3] = look.radii[i]
  const springs = makeSprings(data.links, layout.springsByKind)
  return { n, byId, positions, fixed, look, degree, endpoints, lanes: laneMap.lanes, springs, movable, laneMap }
}
export type Model = ReturnType<typeof prepare>
export function cloudDepth(i: number, count: number) {
  return Math.sin(i * 2.399963 + 0.5) * Math.sqrt(count) * 5.5
}
export function neighbors(model: Model, selected: number) {
  const flags = new Uint8Array(model.n)
  if (selected < 0) return flags
  flags[selected] = 1
  for (let i = 0; i < model.endpoints.length; i += 2) {
    const a = model.endpoints[i],
      b = model.endpoints[i + 1]
    if (a === selected) flags[b] = 1
    if (b === selected) flags[a] = 1
  }
  return flags
}
