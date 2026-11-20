import type { GraphData, GraphLink, GraphNode } from './types.js'

export interface ClusterOptions {
  /** World units between neighbouring group envelopes. */
  gap?: number
  /** Controls density within each group, in world units. */
  spacing?: number
  /** Preferred width divided by height when packing rows. */
  aspectRatio?: number
  dimensions?: 2 | 3
  depth?: number
}
export interface ClusterPoint { x: number; y: number; z: number }
export interface ClusterGroup {
  readonly id: string
  readonly center: Readonly<ClusterPoint>
  readonly radius: number
  readonly members: readonly string[]
}
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

/** Stable packed rows of disks or volumes. The returned anchor works in both simulation transports. */
export function clusterLayout<N extends GraphNode>(nodes: readonly N[], groupBy: (node: N, index: number) => string,
  { gap = 70, spacing = 28, dimensions = 2, depth = 1, aspectRatio = 1 }: ClusterOptions = {}) {
  if (![gap, spacing, depth, aspectRatio].every(Number.isFinite) || gap < 0 || spacing <= 0 || depth < 0 || aspectRatio <= 0 || ![2, 3].includes(dimensions))
    throw new RangeError('Invalid cluster dimensions or spacing')
  const membership = new Map<string, string[]>(), seen = new Set<string>()
  nodes.forEach((node, i) => {
    if (seen.has(node.id)) throw new Error('Duplicate node: ' + node.id)
    seen.add(node.id)
    const key = groupBy(node, i)
    if (typeof key !== 'string') throw new TypeError('Cluster ids must be strings')
    const members = membership.get(key)
    if (members) members.push(node.id)
    else membership.set(key, [node.id])
  })
  const volume = dimensions === 3
  const groups = [...membership].map(([id, members]) => ({
    id, members: members.sort(order), center: { x: 0, y: 0, z: 0 },
    radius: spacing * (volume ? Math.cbrt(members.length) : Math.sqrt(members.length)) * 0.72,
  })).sort((a, b) => b.radius - a.radius || order(a.id, b.id))
  const targetWidth = Math.sqrt(aspectRatio * groups.reduce((area, g) => area + (2 * g.radius + gap) ** 2, 0))
  let top = 0, start = 0, width = 0, height = 0
  function finishRow(end: number) {
    for (let i = start; i < end; i++) {
      groups[i].center.x -= width / 2
      groups[i].center.y = top + height / 2
    }
    top += height + gap
    start = end
    width = height = 0
  }
  groups.forEach((group, i) => {
    const size = 2 * group.radius
    if (width && width + gap + size > targetWidth) finishRow(i)
    if (width) width += gap
    group.center.x = width + group.radius
    width += size
    height = Math.max(height, size)
  })
  finishRow(groups.length)
  const positions = new Map<string, ClusterPoint>()
  groups.forEach(({ members, center, radius }, groupIndex) => {
    center.y -= (top - gap) / 2
    if (volume && groups.length > 1) center.z = depth * Math.sin(groupIndex * 2.39996323) * radius * 0.8
    members.forEach((id, i) => {
      const angle = i * 2.39996323
      const fraction = members.length === 1 ? 0 : (i + 0.5) / members.length
      const distance = radius * (volume ? Math.cbrt(fraction) : Math.sqrt(fraction))
      const latitude = volume ? 2 * (((i + 0.5) * 0.7548776662) % 1) - 1 : 0
      const planar = distance * Math.sqrt(1 - latitude * latitude)
      positions.set(id, { x: center.x + planar * Math.cos(angle), y: center.y + planar * Math.sin(angle),
        z: center.z + distance * latitude * depth })
    })
  })
  return { groups: groups as readonly ClusterGroup[], anchor: (node: N) => positions.get(node.id) }
}

/** Undirected connected components of the included links. The smallest member id names each component. */
export function connectedComponents<N extends GraphNode, E extends GraphLink>(data: GraphData<N, E>, include?: (link: E) => boolean) {
  const ids = new Map(data.nodes.map((n, i) => [n.id, i]))
  if (ids.size !== data.nodes.length) throw new Error('Duplicate node id')
  const parent = Int32Array.from(data.nodes, (_, i) => i), sizes = new Uint32Array(parent.length).fill(1)
  const names = data.nodes.map((node) => node.id)
  function root(i: number) {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] }
    return i
  }
  for (const link of data.links) {
    if (include && !include(link)) continue
    const from = ids.get(link.source), to = ids.get(link.target)
    if (from === undefined || to === undefined) throw new RangeError('Unknown link endpoint')
    let a = root(from), b = root(to)
    if (a === b) continue
    if (sizes[b] > sizes[a]) [a, b] = [b, a]
    parent[b] = a
    sizes[a] += sizes[b]
    if (names[b] < names[a]) names[a] = names[b]
  }
  const byId = new Map(data.nodes.map((n, i) => [n.id, names[root(i)]]))
  return (node: N): string => {
    const name = byId.get(node.id)
    if (name === undefined) throw new RangeError('Unknown node: ' + node.id)
    return name
  }
}
