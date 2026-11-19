import type { GraphData, GraphLink, GraphNode, NodeShape } from './types.js'
export { attachAnnotations } from './annotations.js'
export type { AnnotationOptions, GraphAnnotations } from './annotations.js'

export type Membership = string | readonly string[] | null | undefined
export interface TaxonTerm {
  label: string
  color?: string
  shape?: NodeShape
  description?: string
}
export interface TaxonomyContext<N extends GraphNode, E extends GraphLink> {
  nodes: ReadonlyMap<string, N>
  linksFor(id: string): readonly E[]
}
export interface RelationGrouping {
  relation: string
  groupEnd: 'source' | 'target'
}
type MembershipField<N> = { [K in keyof N]-?: N[K] extends Membership ? K : never }[keyof N] & string
export interface TaxonomyDefinition<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  id: string
  label: string
  by: MembershipField<N> | RelationGrouping | ((node: N, context: TaxonomyContext<N, E>) => Membership)
  /** When provided, only the listed input values contribute memberships. */
  remap?: Readonly<Record<string, string | readonly string[]>>
  terms?: Readonly<Record<string, TaxonTerm>>
}
export interface TaxonGroup extends TaxonTerm {
  readonly taxonomy: string
  readonly id: string
  readonly key: string
  readonly color: string
  /** Indices in the original graph's nodes array. */
  readonly members: readonly number[]
}
export interface NodeDescription {
  title: string
  connections: string
  groups: readonly TaxonGroup[]
}
export interface TooltipContent { title: string; lines: readonly string[] }
export interface GraphLanguage<N extends GraphNode = GraphNode> {
  title?: (node: N) => string
  connections?: (count: number) => string
  tooltip?: (node: N, description: NodeDescription) => TooltipContent
  ungrouped?: string
}
export interface TaxonomyConfig<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  taxonomies: readonly TaxonomyDefinition<N, E>[]
  language?: GraphLanguage<N>
}
export interface TaxonomyIndex {
  readonly groups: readonly TaxonGroup[]
  readonly ungrouped: string
  legend(taxonomy: string): readonly TaxonGroup[]
  describe(id: string): NodeDescription | undefined
  /** First membership, shared by exclusive lane placement and marker styling. */
  primary(id: string, taxonomy: string): TaxonGroup | undefined
  tooltip(id: string): TooltipContent | undefined
  /** Multi-membership nodes use their first membership for exclusive lane placement. */
  laneBy(taxonomy: string): (node: GraphNode) => string
  nodeIndex(id: string): number | undefined
}

const palette = ['#6ea8df', '#c49756', '#6abb9f', '#aa90c6', '#d28d79', '#85a7ac']
function colorFor(key: string) {
  let hash = 0
  for (const c of key) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}
function values(value: unknown): readonly string[] {
  return typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
}
function own<T>(record: Readonly<Record<string, T>> | undefined, key: string) {
  return record && Object.hasOwn(record, key) ? record[key] : undefined
}

/** Compile once per dataset or definition change. Graph data stays immutable. */
export function compileTaxonomies<N extends GraphNode, E extends GraphLink>(
  data: GraphData<N, E>, { taxonomies, language = {} }: TaxonomyConfig<N, E>,
): TaxonomyIndex {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]))
  const indices = new Map(data.nodes.map((node, i) => [node.id, i]))
  const edges = new Map<string, E[]>()
  for (const link of data.links) {
    for (const id of link.source === link.target ? [link.source] : [link.source, link.target]) {
      const list = edges.get(id)
      if (list) list.push(link)
      else edges.set(id, [link])
    }
  }
  const context: TaxonomyContext<N, E> = { nodes, linksFor: (id) => edges.get(id) ?? [] }
  const memberOf = data.nodes.map((): TaxonGroup[] => [])
  const legends = new Map<string, TaxonGroup[]>()
  const titles = new Map<string, string>()
  for (const rule of taxonomies) {
    if (!rule.id || legends.has(rule.id)) throw new TypeError('Missing or duplicate taxonomy id: ' + rule.id)
    titles.set(rule.id, rule.label)
    const groups = new Map<string, TaxonGroup & { members: number[] }>()
    data.nodes.forEach((node, index) => {
      let members: Membership
      const by = rule.by
      if (typeof by === 'function') members = by(node, context)
      else if (typeof by === 'string') members = node[by] as Membership
      else {
        const found = context.linksFor(node.id).filter((edge) => edge.kind === by.relation).map((edge) => edge[by.groupEnd])
        if (own(rule.terms, node.id)) found.push(node.id)
        members = found
      }
      const seen = new Set<string>()
      for (const raw of values(members)) {
        for (const id of values(rule.remap ? own(rule.remap, raw) : raw)) {
          if (typeof id !== 'string' || !id || seen.has(id)) continue
          seen.add(id)
          let group = groups.get(id)
          if (!group) {
            const term = own(rule.terms, id), key = JSON.stringify([rule.id, id])
            group = { ...term, taxonomy: rule.id, id, key, label: term?.label ?? (typeof by === 'object' ? nodes.get(id)?.label : undefined) ?? id,
              color: term?.color ?? colorFor(key), members: [] }
            groups.set(id, group)
          }
          group.members.push(index)
          memberOf[index].push(group)
        }
      }
    })
    const ordered = new Map(Object.keys(rule.terms ?? {}).map((id, i) => [id, i]))
    legends.set(rule.id, [...groups.values()].sort((a, b) =>
      (ordered.get(a.id) ?? Infinity) - (ordered.get(b.id) ?? Infinity) || a.label.localeCompare(b.label)))
  }
  function describe(id: string): NodeDescription | undefined {
    const node = nodes.get(id)
    if (!node) return
    const count = context.linksFor(id).length
    return { title: language.title?.(node) ?? node.label ?? id, groups: memberOf[indices.get(id)!],
      connections: language.connections?.(count) ?? (count + (count === 1 ? ' link' : ' links')) }
  }
  function primary(id: string, taxonomy: string) {
    const i = indices.get(id)
    return i === undefined ? undefined : memberOf[i].find((group) => group.taxonomy === taxonomy)
  }
  return {
    groups: [...legends.values()].flat(), ungrouped: language.ungrouped ?? 'Ungrouped',
    legend: (taxonomy) => legends.get(taxonomy) ?? [], describe, nodeIndex: (id) => indices.get(id),
    primary, laneBy: (taxonomy) => (node) => primary(node.id, taxonomy)?.id ?? '',
    tooltip(id) {
      const detail = describe(id)
      if (!detail) return
      if (language.tooltip) return language.tooltip(nodes.get(id)!, detail)
      const lines = new Map<string, string[]>()
      for (const group of detail.groups) {
        const names = lines.get(group.taxonomy) ?? []
        names.push(group.description ? group.label + ' (' + group.description + ')' : group.label)
        lines.set(group.taxonomy, names)
      }
      return { title: detail.title, lines: [...lines].map(([tax, names]) => titles.get(tax) + ' · ' + names.join(', ')).concat(detail.connections) }
    },
  }
}

/** Read the declarative subset used by the studio's configuration editor. */
export function parseTaxonomy(json: string): TaxonomyDefinition {
  const rule = JSON.parse(json)
  const record = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)
  const name = (v: unknown) => typeof v === 'string' && !!v.trim()
  if (!record(rule) || !name(rule.id) || !name(rule.label)) throw new TypeError('Provide an id and a display label.')
  if (!name(rule.by) && !(record(rule.by) && name(rule.by.relation) && ['source', 'target'].includes(rule.by.groupEnd)))
    throw new TypeError('Choose a node field or a relation with a source or target group end.')
  if (rule.remap !== undefined && (!record(rule.remap) || Object.values(rule.remap).some((v) =>
    !(name(v) || (Array.isArray(v) && v.every(name)))))) throw new TypeError('Map each value to a term or an array of terms.')
  if (rule.terms !== undefined && (!record(rule.terms) || Object.values(rule.terms).some((v) => {
    const term = v as TaxonTerm | null
    return !term || !name(term.label) || (term.color !== undefined && (typeof term.color !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(term.color))) ||
      (term.description !== undefined && typeof term.description !== 'string') ||
      (term.shape !== undefined && !['circle', 'ring', 'square', 'rounded-square'].includes(term.shape))
  }))) throw new TypeError('Each term needs a label and valid optional colour, shape and description.')
  return rule
}
