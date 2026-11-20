import { createGraph } from './index.js'
import type { Atlas, AtlasLink, AtlasNode, AtlasScene } from './atlas.js'
import type { GraphEvents, GraphFrame, LoomGraph, Theme } from './types.js'

interface Point {
  x: number
  y: number
}
export type AtlasMemberMotion = 'rigid' | 'spring'
interface ArticleSpring extends Point {
  target: Point
  vx: number
  vy: number
  frequency: number
}
/** Sparse, world-space offsets relative to the published layout. */
export interface AtlasPositions {
  topics: Record<string, Point>
  members: Record<string, Point>
  articles: Record<string, Point>
}
export interface AtlasMapOptions {
  theme: Theme<AtlasNode, AtlasLink>
  keepView?: boolean
  /** Translate article positions with their topic, including articles that load later. Defaults to true. */
  moveMembers?: boolean
  /** How carried articles approach their new positions. Defaults to rigid. Springs respect reduced motion. */
  memberMotion?: AtlasMemberMotion
  positions?: AtlasPositions
  onPositionsChange?: (positions: AtlasPositions) => void
  onPick?: (node: AtlasNode) => void
  /** A background click after node hit testing, with its current projected scene. */
  onBackgroundClick?: (point: GraphEvents['backgroundclick'], frame: GraphFrame, scene: AtlasScene) => void
  onFrame?: (frame: GraphFrame, scene: AtlasScene) => void
}
const zero = { x: 0, y: 0 }
const finite = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
function offsets(initial?: Record<string, Point>) {
  return new Map(
    Object.entries(initial ?? {})
      .filter(([, p]) => finite(p))
      .map(([id, p]) => [id, { x: p.x, y: p.y }]),
  )
}
function remember(map: Map<string, Point>, id: string, x: number, y: number) {
  const before = map.get(id) ?? zero
  if (Math.abs(before.x - x) < 0.0001 && Math.abs(before.y - y) < 0.0001) return false
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) map.delete(id)
  else map.set(id, { x, y })
  return true
}

/** Move topics and their members in world coordinates, independently of camera and data loading. */
export function mountAtlasMap(canvas: HTMLCanvasElement, atlas: Atlas, options: AtlasMapOptions) {
  let graph: LoomGraph<AtlasNode, AtlasLink>,
    scene: AtlasScene,
    open: readonly number[] = []
  let selected: string | null = null,
    keepView = options.keepView ?? true,
    moveMembers = options.moveMembers ?? true,
    memberMotion = options.memberMotion ?? 'rigid'
  let theme = options.theme,
    events: AbortController | undefined
  let byId = new Map<string, AtlasNode>(),
    hubs: AtlasNode[] = [],
    members = new Map<number, AtlasNode[]>()
  const hubOffsets = offsets(options.positions?.topics),
    groupOffsets = offsets(options.positions?.members),
    articleOffsets = offsets(options.positions?.articles)
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const springs = new Map<string, ArticleSpring>()
  let lastSpringFrame = 0
  function positions(): AtlasPositions {
    const copy = (map: Map<string, Point>) => Object.fromEntries(Array.from(map, ([id, p]) => [id, { ...p }]))
    return { topics: copy(hubOffsets), members: copy(groupOffsets), articles: copy(articleOffsets) }
  }
  function placed(node: AtlasNode) {
    const topic = String(node.topic),
      base = (node.article === undefined ? hubOffsets : groupOffsets).get(topic) ?? zero
    const local = node.article === undefined ? zero : (articleOffsets.get(node.id) ?? zero)
    return { x: node.x! + base.x + local.x, y: node.y! + base.y + local.y }
  }
  function finishSprings() {
    for (const [id, spring] of springs) graph.pin(id, spring.target)
    springs.clear()
  }
  function onMotionPreference() {
    if (motionPreference.matches) finishSprings()
  }
  function updateSprings() {
    if (!springs.size) return
    const now = performance.now(),
      dt = Math.max(0, (now - lastSpringFrame) / 1000)
    lastSpringFrame = now
    for (const [id, s] of springs) {
      // Exact solution of a critically damped spring. A dropped frame cannot make it oscillate.
      const dx = s.x - s.target.x,
        dy = s.y - s.target.y
      const cx = s.vx + s.frequency * dx,
        cy = s.vy + s.frequency * dy
      const decay = Math.exp(-s.frequency * dt)
      s.x = s.target.x + (dx + cx * dt) * decay
      s.y = s.target.y + (dy + cy * dt) * decay
      s.vx = (s.vx - s.frequency * cx * dt) * decay
      s.vy = (s.vy - s.frequency * cy * dt) * decay
      if (
        Math.max(Math.abs(s.x - s.target.x), Math.abs(s.y - s.target.y)) < 0.025 &&
        Math.max(Math.abs(s.vx), Math.abs(s.vy)) < 0.5
      ) {
        graph.pin(id, s.target)
        springs.delete(id)
      } else graph.pin(id, s)
    }
  }
  function follow(hub: AtlasNode, node: AtlasNode) {
    const target = placed(node)
    if (memberMotion !== 'spring' || motionPreference.matches) {
      graph.pin(node.id, target)
      return
    }
    const active = springs.get(node.id)
    if (active) {
      active.target = target
      return
    }
    if (!springs.size) lastSpringFrame = performance.now()
    const { x, y } = graph.getPosition(node.id)
    const local = articleOffsets.get(node.id) ?? zero
    const radius = Math.hypot(node.x! + local.x - hub.x!, node.y! + local.y - hub.y!)
    springs.set(node.id, { x, y, target, vx: 0, vy: 0, frequency: 25 / (1 + Math.min(radius, 110) / 110) })
  }
  function moveHub(hub: AtlasNode, position: Point, alreadyPinned: boolean) {
    const id = String(hub.topic),
      before = placed(hub),
      dx = position.x - before.x,
      dy = position.y - before.y
    if (!remember(hubOffsets, id, position.x - hub.x!, position.y - hub.y!)) return false
    if (!alreadyPinned) graph.pin(hub.id, position)
    if (moveMembers) {
      const base = groupOffsets.get(id) ?? zero
      remember(groupOffsets, id, base.x + dx, base.y + dy)
      for (const node of members.get(hub.topic) ?? []) follow(hub, node)
    }
    return true
  }
  // The core handles native pointer capture and projection. Translate siblings after
  // its pointer handler runs, before the next GPU paint, including the last drag event.
  let changed = false
  function syncHubs() {
    for (const hub of hubs) if (moveHub(hub, graph.getPosition(hub.id), true)) changed = true
  }
  // A native drag takes ownership of an article immediately, even while it is catching up.
  function releaseDraggedArticles() {
    for (const [id, s] of springs) {
      const p = graph.getPosition(id)
      if (p.x !== Math.fround(s.x) || p.y !== Math.fround(s.y)) springs.delete(id)
    }
  }
  function commitPositions() {
    syncHubs()
    releaseDraggedArticles()
    for (const group of members.values())
      for (const node of group) {
        if (springs.has(node.id)) continue
        const pos = graph.getPosition(node.id),
          base = groupOffsets.get(String(node.topic)) ?? zero
        if (remember(articleOffsets, node.id, pos.x - node.x! - base.x, pos.y - node.y! - base.y)) changed = true
      }
    if (changed) options.onPositionsChange?.(positions())
    changed = false
  }
  function mount() {
    const next = atlas.getSnapshot()
    if (next.scene === scene) return
    const previous = graph?.getViewport()
    if (graph) {
      commitPositions()
      events?.abort()
      graph.destroy()
    }
    scene = next.scene
    hubs = []
    members = new Map()
    byId = new Map()
    for (const node of scene.nodes) {
      byId.set(node.id, node)
      if (node.article === undefined) hubs.push(node)
      else {
        if (!members.has(node.topic)) members.set(node.topic, [])
        members.get(node.topic)!.push(node)
      }
    }
    for (const id of springs.keys()) if (!byId.has(id)) springs.delete(id)
    graph = createGraph(canvas, {
      ...scene,
      nodes: scene.nodes.map((n) => {
        const { x, y } = springs.get(n.id) ?? placed(n)
        return { ...n, x, y }
      }),
      theme,
      mode: 'drift',
      layout: { pinOnDrag: true, blend: 1 },
      sim: 'main',
      transparentBackground: true,
    })
    if (previous) graph.setViewport(previous)
    const added = next.expanded.find((id) => !open.includes(id))
    if (!keepView && added !== undefined) {
      const center = graph.getPosition('topic:' + added),
        camera = graph.getViewport()
      graph.setViewport({ ...camera, x: center.x, y: center.y, z: center.z, zoom: Math.max(1.5, camera.zoom) })
    }
    open = next.expanded
    if (selected && byId.has(selected)) graph.select(selected)
    graph.on('nodeclick', (id) => {
      selected = id
      options.onPick?.(byId.get(id)!)
    })
    if (options.onBackgroundClick)
      graph.on('backgroundclick', (point) => options.onBackgroundClick!(point, graph.getFrame(), scene))
    graph.onFrame((frame) => {
      options.onFrame?.(frame, scene)
      updateSprings()
    })
    events = new AbortController()
    const signal = events.signal
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (e.buttons === 1) {
          syncHubs()
          releaseDraggedArticles()
        }
      },
      { signal },
    )
    canvas.addEventListener('pointerup', commitPositions, { signal })
    canvas.addEventListener('pointercancel', commitPositions, { signal })
    canvas.addEventListener('lostpointercapture', commitPositions, { signal })
  }
  mount()
  motionPreference.addEventListener('change', onMotionPreference)
  const off = atlas.subscribe(mount)
  return {
    fit: () => graph.fit(),
    focus: (id: string) => graph.focus(id),
    getPosition: (id: string) => graph.getPosition(id),
    getFrame: () => graph.getFrame(),
    select(id: string | null) {
      selected = id
      graph.select(id)
    },
    zoom(factor: number) {
      if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Invalid atlas zoom')
      const camera = graph.getViewport()
      graph.setViewport({ ...camera, zoom: Math.max(0.015, Math.min(15, camera.zoom * factor)) })
    },
    setKeepView(value: boolean) {
      keepView = value
    },
    setMoveMembers(value: boolean) {
      if (!value) finishSprings()
      moveMembers = value
    },
    setMemberMotion(value: AtlasMemberMotion) {
      if (value !== 'spring' && value !== 'rigid') throw new RangeError('Invalid atlas article motion')
      memberMotion = value
      if (value === 'rigid') finishSprings()
    },
    moveTopic(id: number, position: Point) {
      const hub = byId.get('topic:' + id)
      if (!hub || !finite(position)) throw new RangeError('Invalid atlas topic position')
      if (moveHub(hub, position, false)) options.onPositionsChange?.(positions())
    },
    getPositions: positions,
    focusConnection(source: string, target: string) {
      const a = graph.getPosition(source),
        b = graph.getPosition(target),
        frame = graph.getFrame(),
        camera = graph.getViewport()
      const zoom = Math.max(
        0.015,
        Math.min(
          3,
          (frame.width * 0.68) / Math.max(1, Math.abs(a.x - b.x)),
          (frame.height * 0.63) / Math.max(1, Math.abs(a.y - b.y)),
        ),
      )
      graph.setViewport({ ...camera, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom })
    },
    resetPositions() {
      springs.clear()
      hubOffsets.clear()
      groupOffsets.clear()
      articleOffsets.clear()
      for (const node of scene.nodes) graph.pin(node.id, placed(node))
      changed = false
      options.onPositionsChange?.(positions())
    },
    setTheme(next: Theme<AtlasNode, AtlasLink>) {
      if (theme !== next) {
        theme = next
        graph.setTheme(next)
      }
    },
    getViewport: () => graph.getViewport(),
    destroy() {
      off()
      commitPositions()
      motionPreference.removeEventListener('change', onMotionPreference)
      springs.clear()
      events?.abort()
      graph.destroy()
    },
  }
}
