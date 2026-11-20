import type { GraphData, GraphLink, GraphNode } from './types.js'

export interface SearchOptions {
  /** Restrict results to a drilldown or group without rebuilding the index. */
  within?: ReadonlySet<string>
  limit?: number
}
export interface Neighbor<N, E> {
  node: N
  /** Parallel links in source order. */
  links: readonly E[]
}
export interface BoundaryNode<N> {
  node: N
  /** Counts relative to the supplied group. */
  incoming: number
  outgoing: number
}
const normalize = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** A read-only index of a graph snapshot. Rebuild after editing the document. */
export function createGraphIndex<N extends GraphNode, E extends GraphLink>(data: GraphData<N, E>) {
  const entries = new Map<string, { node: N; incoming: E[]; outgoing: E[] }>()
  for (const node of data.nodes) {
    if (entries.has(node.id)) throw new RangeError('Duplicate node: ' + node.id)
    entries.set(node.id, { node, incoming: [], outgoing: [] })
  }
  function entry(id: string) {
    const item = entries.get(id)
    if (!item) throw new RangeError('Unknown node: ' + id)
    return item
  }
  for (const link of data.links) {
    entry(link.source).outgoing.push(link)
    entry(link.target).incoming.push(link)
  }
  let searchable: { node: N; label: string; id: string; text: string }[] | undefined
  function search(query: string, { within, limit = data.nodes.length }: SearchOptions = {}): N[] {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('Expected a nonnegative search limit')
    const term = normalize(query)
    if (!term || !limit) return []
    searchable ??= data.nodes.map((node) => {
      const label = normalize(node.label ?? ''), id = normalize(node.id)
      return { node, label, id, text: [label, id, normalize([node.section, node.kind, node.summary].join(' '))].join(' ') }
    })
    const words = term.split(' '), ranked: N[][] = [[], [], [], []]
    for (const { node, label, id, text } of searchable) {
      if (within && !within.has(node.id)) continue
      if (label === term || id === term) ranked[0].push(node)
      else if (label.startsWith(term) || id.startsWith(term)) ranked[1].push(node)
      else if (label.includes(term) || id.includes(term)) ranked[2].push(node)
      else if (words.every((word) => text.includes(word))) ranked[3].push(node)
    }
    return ranked.flat().slice(0, limit)
  }
  function neighbors(id: string, direction: 'incoming' | 'outgoing'): Neighbor<N, E>[] {
    if (direction !== 'incoming' && direction !== 'outgoing') throw new RangeError('Expected incoming or outgoing')
    const grouped = new Map<string, E[]>()
    for (const link of entry(id)[direction]) {
      const other = direction === 'incoming' ? link.source : link.target
      const links = grouped.get(other)
      if (links) links.push(link)
      else grouped.set(other, [link])
    }
    return Array.from(grouped, ([other, links]) => ({ node: entry(other).node, links }))
  }
  function boundary(members: Iterable<string>): BoundaryNode<N>[] {
    const ids = new Set(members), outside = new Map<string, BoundaryNode<N>>()
    function count(id: string, direction: 'incoming' | 'outgoing') {
      if (ids.has(id)) return
      let row = outside.get(id)
      if (!row) {
        row = { node: entry(id).node, incoming: 0, outgoing: 0 }
        outside.set(id, row)
      }
      row[direction]++
    }
    for (const id of ids) {
      const item = entry(id)
      for (const edge of item.incoming) count(edge.source, 'incoming')
      for (const edge of item.outgoing) count(edge.target, 'outgoing')
    }
    return [...outside.values()].sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing))
  }
  return { search, neighbors, boundary }
}
