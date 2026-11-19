import type { GraphLink, GraphNode, LayoutOptions } from './types.js'

export const laneOrder = ['study', 'concept', 'tag', 'blog', 'lab', 'category']
export const defaultForces = {
  blend: 0,
  repulsion: 1,
  springStrength: 1,
  linkDistance: 32,
  vertical: false,
}
export type Forces = typeof defaultForces
export type LayoutUpdate = {
  forces?: Forces
  targets?: Float32Array
  radii?: Float32Array
  lanes?: Float32Array
  springs?: Float32Array | null
}

export function range(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError('Invalid ' + name)
  return value
}
export function layoutForces(options: LayoutOptions): Forces {
  const forces = {
    blend: range(options.blend ?? 0, 0, 1, 'layout blend'),
    repulsion: range(options.repulsion ?? 1, 0, 8, 'repulsion'),
    springStrength: range(options.springStrength ?? 1, 0, 8, 'spring strength'),
    linkDistance: range(options.linkDistance ?? 32, 0, 1e6, 'link distance'),
    vertical: options.direction === 'vertical',
  }
  range(options.laneGap ?? 210, 1, 1e6, 'lane gap')
  range(options.rowGap ?? 46, 1, 1e6, 'row gap')
  if (options.direction && !['horizontal', 'vertical'].includes(options.direction))
    throw new RangeError('Invalid lane direction')
  if (options.laneOrder && new Set(options.laneOrder).size !== options.laneOrder.length)
    throw new RangeError('Duplicate lane kind')
  return forces
}

function laneOffsets(kinds: Set<string>, order: readonly string[], gap: number) {
  const first = order.filter((kind) => kinds.has(kind)),
    seen = new Set(first)
  const ordered = first.concat([...kinds].filter((kind) => !seen.has(kind)).sort())
  return new Map(ordered.map((kind, i) => [kind, (i - (ordered.length - 1) / 2) * gap]))
}

export function makeSprings(
  links: readonly GraphLink[],
  rules: LayoutOptions['springsByKind'],
): Float32Array | null {
  if (!rules || !Object.keys(rules).length) return null
  for (const rule of Object.values(rules)) {
    if (rule.strength !== undefined) range(rule.strength, 0, 8, 'kind spring strength')
    if (rule.distance !== undefined) range(rule.distance, 0, 1e6, 'kind link distance')
  }
  const springs = new Float32Array(links.length * 2)
  for (let i = 0; i < links.length; i++) {
    const kind = links[i].kind ?? '',
      rule = Object.hasOwn(rules, kind) ? rules[kind] : undefined
    springs[i * 2] = rule?.distance ?? -1
    springs[i * 2 + 1] = rule?.strength ?? 1
  }
  return springs
}

export function forceLanes(
  nodes: readonly GraphNode[],
  options: LayoutOptions,
  kinds: Set<string>,
): Float32Array {
  const offsets = laneOffsets(
    kinds,
    options.laneOrder ?? laneOrder,
    options.laneGap ?? Math.max(85, 12 * Math.sqrt(nodes.length)),
  )
  return Float32Array.from(nodes, (node) => offsets.get(node.kind ?? '')!)
}

// Compile callbacks on the caller's thread. Only packed coordinates cross the worker boundary.
export function makeTargets(nodes: readonly GraphNode[], options: LayoutOptions) {
  const groups = new Map<string, number[]>()
  for (let i = 0; i < nodes.length; i++) {
    const kind = nodes[i].kind ?? '',
      group = groups.get(kind)
    if (group) group.push(i)
    else groups.set(kind, [i])
  }
  const targets = new Float32Array(nodes.length * 3)
  const offsets = laneOffsets(
    new Set(groups.keys()),
    options.laneOrder ?? laneOrder,
    options.laneGap ?? 210,
  )
  offsets.forEach((across, kind) => {
    const indices = groups.get(kind)!
    indices.sort((a, b) => (nodes[a].id < nodes[b].id ? -1 : nodes[a].id > nodes[b].id ? 1 : 0))
    indices.forEach((i, row) => {
      const along = (row - (indices.length - 1) / 2) * (options.rowGap ?? 46)
      const anchor = options.anchor?.(nodes[i], i)
      const x = anchor ? anchor.x : options.direction === 'vertical' ? along : across
      const y = anchor ? anchor.y : options.direction === 'vertical' ? across : along
      const z = anchor?.z ?? 0
      if (![x, y, z].every(Number.isFinite)) throw new RangeError('Invalid anchor for ' + nodes[i].id)
      targets.set([x, y, z], i * 3)
    })
  })
  return targets
}
export function placeOnTargets(
  positions: Float32Array,
  fixed: Uint8Array,
  targets: Float32Array,
  weight = 1,
  seeds?: readonly GraphNode[],
) {
  for (let i = 0; i < fixed.length; i++) {
    if (fixed[i] || (weight < 1 && seeds?.[i].x !== undefined && seeds[i].y !== undefined)) continue
    for (let a = 0; a < 3; a++) {
      const k = i * 4 + a,
        target = targets[i * 3 + a]
      positions[k] = weight === 1 ? target : positions[k] + (target - positions[k]) * weight
    }
  }
}
