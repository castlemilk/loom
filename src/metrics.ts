import type { GraphData, GraphLink, GraphNode, NodeStyle, WireStyle } from './types.js'

type Accessor<T> = (item: T, index: number) => number | null | undefined
export type NodeMetric<N extends GraphNode = GraphNode> = 'degree' | 'contentSize' | 'complexity' | Accessor<N>
export type WireMetric<E extends GraphLink = GraphLink> = 'connections' | 'multiplicity' | 'weight' | Accessor<E>
export interface ScaleOptions {
  domain?: readonly [number, number]
  range?: readonly [number, number]
  curve?: 'linear' | 'sqrt' | 'log'
}
const utf8 = new TextEncoder()
/** Explicit byte counts take precedence, including zero. Otherwise measure the provided content or summary. */
export function contentBytes(node: GraphNode): number | undefined {
  const text = node.content ?? node.summary
  return node.contentSize ?? (text === undefined ? undefined : utf8.encode(text).length)
}

function scale(values: Float64Array, options: ScaleOptions, defaultRange: [number, number], max: number) {
  const [small, large] = options.range ?? defaultRange
  if (![small, large].every((n) => Number.isFinite(n) && n >= 0 && n <= max)) throw new RangeError('Invalid output range')
  const curve = options.curve ?? 'linear'
  if (!['linear', 'sqrt', 'log'].includes(curve)) throw new RangeError('Invalid scale curve')
  const transform = (x: number) => curve === 'linear' ? x : Math.sign(x) * (curve === 'sqrt' ? Math.sqrt(Math.abs(x)) : Math.log1p(Math.abs(x)))
  let low = Infinity, high = -Infinity
  if (options.domain) {
    low = options.domain[0]
    high = options.domain[1]
    if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) throw new RangeError('Invalid metric domain')
  } else {
    for (const n of values) {
      if (Number.isFinite(n)) { low = Math.min(n, low); high = Math.max(n, high) }
    }
  }
  const from = transform(low), to = transform(high)
  return values.map((n) => {
    if (!Number.isFinite(n)) return NaN
    const x = transform(Math.min(high, Math.max(low, n))), span = to - from
    const t = from === to ? 0.5 : Number.isFinite(span) ? (x - from) / span : (x / 2 - from / 2) / (to / 2 - from / 2)
    return small + (large - small) * t
  })
}
function degrees(data: GraphData) {
  const counts = new Map<string, number>()
  for (const { source, target } of data.links) {
    counts.set(source, (counts.get(source) ?? 0) + 1)
    counts.set(target, (counts.get(target) ?? 0) + 1)
  }
  return counts
}
const numbers = <T>(items: readonly T[], by: Accessor<T>) =>
  Float64Array.from(items, (item, i) => { const n = by(item, i); return typeof n === 'number' ? n : NaN })

/** A precomputed theme.nodes.resolve rule. Missing values inherit the theme radius. */
export function mapNodeRadius<N extends GraphNode>(data: GraphData<N>, by: NodeMetric<N>,
  options: ScaleOptions = {}): (node: N) => NodeStyle | undefined {
  if (typeof by !== 'function' && !['degree', 'contentSize', 'complexity'].includes(by)) throw new RangeError('Unknown node metric')
  const counts = by === 'degree' ? degrees(data) : undefined
  const read: Accessor<N> = typeof by === 'function' ? by : by === 'degree' ? (n) => counts!.get(n.id) ?? 0 :
    by === 'contentSize' ? contentBytes : (n) => n.complexity
  const radii = scale(numbers(data.nodes, read), options, [4, 18], 1e6)
  const styles = new Map(data.nodes.map((node, i) => [node.id, Number.isFinite(radii[i]) ? { radius: radii[i] } : undefined]))
  return (node) => styles.get(node.id)
}

/** A precomputed theme.wires.resolve rule, indexed in the input link order. */
export function mapWireWidth<E extends GraphLink>(data: GraphData<GraphNode, E>, by: WireMetric<E>,
  options: ScaleOptions = {}): (link: E, index: number) => WireStyle | undefined {
  let read: Accessor<E>
  if (typeof by === 'function') read = by
  else if (by === 'weight') read = (e) => e.weight
  else if (by === 'connections') {
    const counts = degrees(data)
    read = (e) => Math.max(counts.get(e.source)!, counts.get(e.target)!)
  } else if (by === 'multiplicity') {
    const ids = new Map(data.nodes.map((n, i) => [n.id, i]))
    const pairs = data.links.map((link) => {
      const a = ids.get(link.source), b = ids.get(link.target)
      if (a === undefined || b === undefined) throw new RangeError('Unknown link endpoint')
      return Math.min(a, b) * ids.size + Math.max(a, b)
    })
    const counts = new Map<number, number>()
    for (const pair of pairs) counts.set(pair, (counts.get(pair) ?? 0) + 1)
    read = (_, i) => counts.get(pairs[i])
  } else throw new RangeError('Unknown wire metric')
  const widths = scale(numbers(data.links, read), options, [0.75, 5], 64)
  return (_, i) => Number.isFinite(widths[i]) ? { width: widths[i] } : undefined
}
