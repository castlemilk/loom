import type { GraphData, GraphLink, GraphNode, LayoutOptions, LoomGraph, Mode } from './types.js'
import type { TaxonGroup } from './taxonomy.js'

export type NodeAction = 'inspect' | 'focus' | 'neighbors' | 'group'
export type GroupAction = 'isolate' | 'expand' | 'none'
export type LinkDirection = 'both' | 'incoming' | 'outgoing'
export interface DrilldownGroup {
  taxonomy: string
  id: string
  label?: string
  /** Stable node IDs, including all overlapping memberships. */
  members: readonly string[]
}
export interface Neighborhood<E extends GraphLink = GraphLink> {
  hops?: number
  direction?: LinkDirection
  includeLink?: (link: E) => boolean
}
export interface DrilldownOptions<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  selectAction?: NodeAction | ((node: N) => NodeAction)
  openAction?: NodeAction | ((node: N) => NodeAction)
  groupAction?: GroupAction | ((group: DrilldownGroup) => GroupAction)
  groupFor?: (node: N) => DrilldownGroup | undefined
  neighborhood?: Neighborhood<E>
  /** The default isolated detail uses free Drift. An empty object inherits the overview settings. */
  detail?: { mode?: Mode; layout?: LayoutOptions<N> }
  /** Ring spacing or radial expansion multiplier. Defaults to 2. */
  spread?: number
  arrangement?: 'rings' | 'radial'
  /** World-space spacing for ring targets or coincident radial members. */
  memberSpacing?: number
  /** Force-to-anchor blend during in-place expansion. Defaults to 0.7. */
  expansionBlend?: number
}
export type DrilldownLevel =
  | { kind: 'overview'; label: string }
  | { kind: 'node'; id: string; label: string; hops: number; direction: LinkDirection }
  | { kind: 'group'; taxonomy: string; id: string; label: string; memberCount: number; action: 'isolate' | 'expand' }
export interface DrilldownSnapshot<N extends GraphNode, E extends GraphLink> {
  /** Directly mountable, in source order. Only a scope change replaces this object. */
  readonly data: GraphData<N, E>
  readonly path: readonly DrilldownLevel[]
  readonly selected: string | null
  readonly options: Readonly<DrilldownOptions<N, E>>
}
type Pose = ReturnType<LoomGraph['getPosition']>
type GraphPort = Pick<LoomGraph, 'on' | 'getPosition' | 'select' | 'focus'> & Partial<Pick<LoomGraph, 'onFrame'>>
interface Expansion {
  members: readonly string[]
  origin: Map<string, Pose>
  yaw: number
  pitch: number
}
interface Scope<N extends GraphNode, E extends GraphLink> {
  source: GraphData<N, E>
  level: DrilldownLevel
  selected: string | null
  ids?: Map<string, N>
  poses?: Map<string, Pose>
  expansion?: Expansion
  filter?: Neighborhood<E>['includeLink']
}

/** Convert a compiled group's indices using the same node array used for its taxonomy index. */
export function drilldownGroup(group: TaxonGroup, nodes: readonly GraphNode[]): DrilldownGroup {
  return { taxonomy: group.taxonomy, id: group.id, label: group.label, members: group.members.map((i) => nodes[i].id) }
}
function checkNeighborhood<E extends GraphLink>({ hops = 1, direction = 'both' }: Neighborhood<E>) {
  if (!Number.isSafeInteger(hops) || hops < 0) throw new RangeError('Hops must be a nonnegative integer')
  if (!['both', 'incoming', 'outgoing'].includes(direction)) throw new RangeError('Invalid link direction')
}
function checkNodeAction(action: unknown) {
  if (action !== 'inspect' && action !== 'focus' && action !== 'neighbors' && action !== 'group') throw new RangeError('Invalid node action')
}
function checkOptions<N extends GraphNode, E extends GraphLink>(options: DrilldownOptions<N, E>) {
  checkNeighborhood(options.neighborhood ?? {})
  for (const rule of [options.selectAction, options.openAction]) if (rule !== undefined && typeof rule !== 'function') checkNodeAction(rule)
  if (options.groupAction !== undefined && typeof options.groupAction !== 'function' && !['expand', 'isolate', 'none'].includes(options.groupAction)) throw new RangeError('Invalid group action')
  if (options.arrangement !== undefined && !['rings', 'radial'].includes(options.arrangement)) throw new RangeError('Invalid expansion arrangement')
  if (options.memberSpacing !== undefined && (!Number.isFinite(options.memberSpacing) || options.memberSpacing <= 0)) throw new RangeError('Invalid member spacing')
  if (options.spread !== undefined && (!Number.isFinite(options.spread) || options.spread < 1)) throw new RangeError('Invalid group spread')
  if (options.expansionBlend !== undefined && (!Number.isFinite(options.expansionBlend) || options.expansionBlend < 0 || options.expansionBlend > 1)) throw new RangeError('Invalid expansion blend')
}
function neighborhood<N extends GraphNode, E extends GraphLink>(source: GraphData<N, E>, id: string,
  { hops = 1, direction = 'both', includeLink }: Neighborhood<E>) {
  const links = includeLink ? source.links.filter(includeLink) : source.links
  const adjacent = new Map<string, string[]>()
  function add(a: string, b: string) {
    const list = adjacent.get(a)
    if (list) list.push(b)
    else adjacent.set(a, [b])
  }
  if (hops) for (const edge of links) {
    if (direction !== 'incoming') add(edge.source, edge.target)
    if (direction !== 'outgoing') add(edge.target, edge.source)
  }
  const visible = new Set([id])
  let frontier = [id]
  for (let depth = 0; depth < hops && frontier.length; depth++) {
    const next: string[] = []
    for (const from of frontier) for (const to of adjacent.get(from) ?? []) {
      if (!visible.has(to)) { visible.add(to); next.push(to) }
    }
    frontier = next
  }
  return { nodes: source.nodes.filter((n) => visible.has(n.id)),
    links: links.filter((e) => visible.has(e.source) && visible.has(e.target)) }
}
function initialPose(node: GraphNode, index: number): Pose {
  const angle = index * 2.39996323, radius = 14 * Math.sqrt(index)
  return { x: node.x ?? radius * Math.cos(angle), y: node.y ?? radius * Math.sin(angle), z: node.z ?? 0,
    pinned: node.pinned ?? (node.x !== undefined && node.y !== undefined) }
}
function expandedAnchors({ origin, members, yaw, pitch }: Expansion, spread: number, spacing: number, rings: boolean, cloud: boolean) {
  let x = 0, y = 0, z = 0
  for (const id of members) {
    const p = origin.get(id)!
    x += p.x / members.length; y += p.y / members.length; z += p.z / members.length
  }
  const targets = new Map<string, { x: number; y: number; z: number }>()
  if (rings) {
    // Neighboring rings differ by one step. Chords on each ring are at least one step long.
    const step = spacing * spread, cy = cloud ? Math.cos(yaw) : 1, sy = cloud ? Math.sin(yaw) : 0
    const cp = cloud ? Math.cos(pitch) : 1, sp = cloud ? Math.sin(pitch) : 0
    targets.set(members[0], { x, y, z })
    for (let start = 1, ring = 1; start < members.length; ring++) {
      const count = Math.min(members.length - start, Math.floor(Math.PI / Math.asin(0.5 / ring) + 1e-9))
      for (let j = 0; j < count; j++) {
        const id = members[start + j], angle = 2 * Math.PI * j / count + ring * 2.39996323
        const u = ring * step * Math.cos(angle), v = ring * step * Math.sin(angle)
        // Inverse camera rotation at constant depth, fixed at opening so the user can orbit the result.
        targets.set(id, { x: x + cy*u + sy*sp*v, y: y + cp*v, z: z + sy*u - cy*sp*v })
      }
      start += count
    }
    return (node: GraphNode) => targets.get(node.id) ?? origin.get(node.id)
  }
  members.forEach((id, index) => {
    const p = origin.get(id)!, dx = p.x - x, dy = p.y - y, dz = p.z - z
    const distance = Math.hypot(dx, dy, dz), angle = index * 2.39996323
    const push = (spread - 1) * Math.max(distance, spacing * Math.sqrt(index + 1))
    targets.set(id, { x: p.x + push * (distance ? dx / distance : Math.cos(angle)),
      y: p.y + push * (distance ? dy / distance : Math.sin(angle)), z: p.z + push * (distance ? dz / distance : 0) })
  })
  return (node: GraphNode) => targets.get(node.id) ?? origin.get(node.id)
}

/** A headless controller. Bind one live renderer at a time and remount it only when snapshot.data changes. */
export function createDrilldown<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(
  source: GraphData<N, E>, initial: DrilldownOptions<N, E> = {},
) {
  checkOptions(initial)
  let options = { ...initial }
  const stack: Scope<N, E>[] = [{ source, level: { kind: 'overview', label: 'Overview' }, selected: null }]
  const current = () => stack[stack.length - 1]
  const ids = () => current().ids ??= new Map(current().source.nodes.map((node) => [node.id, node]))
  const listeners = new Set<() => void>()
  // A pin or explicit release follows its node across independently saved scope positions.
  const pins = new Map<string, Pose | null>()
  let snapshot: DrilldownSnapshot<N, E> = { data: source, selected: null, path: [current().level], options }
  let binding: { graph: GraphPort; data: GraphData<N, E>; detach: () => void } | undefined
  let syncing = false
  let yaw = 0, pitch = 0
  let anchorCache: { scope: Scope<N, E>; spread: number; spacing: number; rings: boolean; cloud: boolean; anchor: ReturnType<typeof expandedAnchors> } | undefined

  function publish() {
    snapshot = { ...snapshot, selected: current().selected, options }
    for (const listener of [...listeners]) listener()
  }
  function live() { return binding?.data === snapshot.data ? binding.graph : undefined }
  function capture() {
    const scope = current(), graph = live()
    const poses = new Map<string, Pose>()
    for (const [i, node] of scope.source.nodes.entries()) {
      const pose = graph ? graph.getPosition(node.id) : initialPose(snapshot.data.nodes[i], i)
      poses.set(node.id, pose)
      if (pose.pinned) pins.set(node.id, pose)
      else if (pins.has(node.id) || (node.pinned ?? (node.x !== undefined && node.y !== undefined))) pins.set(node.id, null)
    }
    scope.poses = poses
  }
  function show(seeds?: ReadonlyMap<string, Pose>) {
    const scope = current()
    const nodes = scope.source.nodes.map((n) => {
      const pin = pins.get(n.id), pose = pin ?? seeds?.get(n.id)
      if (!pose) return pin === null ? { ...n, pinned: false } : n
      return { ...n, ...pose, pinned: pin === null ? false : pose.pinned,
        z: n.z === undefined && pose.z === 0 && !pose.pinned ? undefined : pose.z }
    })
    snapshot = { data: { nodes, links: scope.source.links }, path: stack.map((entry) => entry.level), selected: scope.selected, options }
    anchorCache = undefined
    publish()
  }
  function goTo(depth: number) {
    if (!Number.isInteger(depth) || depth < 0 || depth >= stack.length) return false
    if (depth === stack.length - 1) return false
    capture()
    stack.length = depth + 1
    show(current().poses)
    return true
  }
  function mark(id: string | null) {
    if (id !== null && !ids().has(id)) throw new RangeError('Node outside the current scope: ' + id)
    if (current().selected === id) return
    current().selected = id
    syncing = true
    try { live()?.select(id) } finally { syncing = false }
    publish()
  }
  function openNeighborhood(id: string, patch: Neighborhood<E> = {}) {
    const node = ids().get(id)
    if (!node) throw new RangeError('Node outside the current scope: ' + id)
    const rule = { ...options.neighborhood, ...patch }, hops = rule.hops ?? 1, direction = rule.direction ?? 'both'
    checkNeighborhood(rule)
    const parent = current(), level = parent.level
    if (level.kind === 'node' && level.id === id && level.hops === hops && level.direction === direction && parent.filter === rule.includeLink) return false
    const next = neighborhood(parent.source, id, rule)
    mark(id)
    capture()
    stack.push({ source: next, level: { kind: 'node', id, label: node.label ?? id, hops, direction }, selected: id, filter: rule.includeLink })
    show(parent.poses)
    return true
  }
  function openGroup(group: DrilldownGroup, override?: GroupAction) {
    const action = override ?? (typeof options.groupAction === 'function' ? options.groupAction(group) : options.groupAction) ?? 'expand'
    if (action === 'none') return false
    if (action !== 'isolate' && action !== 'expand') throw new RangeError('Invalid group action')
    const parent = current(), level = parent.level
    if (level.kind === 'group' && level.taxonomy === group.taxonomy && level.id === group.id && level.action === action) {
      return action === 'expand' && goTo(stack.length - 2)
    }
    const visible = new Set(group.members.filter((id) => ids().has(id)))
    if (!visible.size) return false
    capture()
    const data = action === 'expand' ? parent.source : { nodes: parent.source.nodes.filter((n) => visible.has(n.id)),
      links: parent.source.links.filter((e) => visible.has(e.source) && visible.has(e.target)) }
    const scope: Scope<N, E> = { source: data, level: { kind: 'group', id: group.id, taxonomy: group.taxonomy, label: group.label ?? group.id, memberCount: visible.size, action },
      selected: parent.selected !== null && (action === 'expand' || visible.has(parent.selected)) ? parent.selected : null }
    if (action === 'expand') {
      const origin = parent.poses!
      scope.ids = parent.ids
      scope.expansion = { members: [...visible].sort(), origin, yaw: live() ? yaw : 0, pitch: live() ? pitch : 0 }
    }
    const inPlace = action === 'expand' && !!live()
    stack.push(scope)
    if (inPlace) {
      // The existing renderer keeps its camera, buffers, simulation and drag state.
      snapshot = { ...snapshot, path: stack.map((entry) => entry.level) }
      publish()
    } else show(parent.poses)
    return true
  }
  function act(id: string, rule: DrilldownOptions<N,E>['selectAction']) {
    const node = ids().get(id)
    if (!node) throw new RangeError('Node outside the current scope: ' + id)
    const action = typeof rule === 'function' ? rule(node) : rule
    checkNodeAction(action)
    if (action === 'neighbors') return openNeighborhood(id)
    mark(id)
    if (action === 'focus') live()?.focus(id)
    if (action === 'group') {
      const group = options.groupFor?.(node)
      if (group) return openGroup(group)
    }
    return false
  }
  function select(id: string | null) {
    if (id === null) { mark(null); return }
    act(id, options.selectAction ?? 'inspect')
  }
  const activate = (id: string) => act(id, options.openAction ?? 'neighbors')
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    setOptions(patch: DrilldownOptions<N,E>) {
      const next = { ...options, ...patch }
      checkOptions(next)
      options = next
      publish()
    },
    select, activate, openNeighborhood, openGroup, goTo,
    back: () => goTo(stack.length - 2),
    resolveLayout(mode: Mode, layout: LayoutOptions<N> = {}): { mode: Mode; layout: LayoutOptions<N> } {
      if (stack.length === 1) return { mode, layout }
      const scope = current()
      const detail = options.detail ?? { mode: 'drift', layout: { blend: 0, anchor: null, guides: false } }
      if (scope.expansion) {
        if (stack.some((entry) => entry.level.kind !== 'overview' && !entry.expansion)) {
          mode = detail.mode ?? mode
          layout = { ...layout, ...detail.layout }
        }
        const spread = options.spread ?? 2, spacing = options.memberSpacing ?? 28, rings = options.arrangement !== 'radial', cloud = mode === 'cloud'
        if (anchorCache?.scope !== scope || anchorCache.spread !== spread || anchorCache.spacing !== spacing || anchorCache.rings !== rings || anchorCache.cloud !== cloud) {
          anchorCache = { scope, spread, spacing, rings, cloud, anchor: expandedAnchors(scope.expansion, spread, spacing, rings, cloud) }
        }
        return { mode: cloud ? 'cloud' : 'drift',
          layout: { ...layout, anchor: anchorCache.anchor, blend: options.expansionBlend ?? 0.7, guides: false } }
      }
      return { mode: detail.mode ?? mode, layout: { ...layout, ...detail.layout } }
    },
    bind(graph: GraphPort, data = snapshot.data) {
      if (data.nodes !== snapshot.data.nodes || data.links !== snapshot.data.links) throw new RangeError('Cannot bind a stale drilldown view')
      binding?.detach()
      const boundData = snapshot.data
      graph.select(snapshot.selected)
      const off = [graph.on('select', (id) => { if (!syncing && snapshot.data === boundData) select(id) }),
        graph.on('open', (id) => { if (snapshot.data === boundData) activate(id) }), graph.on('destroy', () => detach())]
      yaw = pitch = 0
      if (graph.onFrame) off.push(graph.onFrame((frame) => {
        yaw = frame.mode === 'cloud' ? frame.yaw : 0
        pitch = frame.mode === 'cloud' ? frame.pitch : 0
      }))
      function detach() {
        for (const remove of off) remove()
        if (binding?.detach === detach) binding = undefined
      }
      binding = { graph, data: boundData, detach }
      return detach
    },
  }
}
