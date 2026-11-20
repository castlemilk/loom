import { createGraph } from './index.js'
import type { Atlas, AtlasLayout, AtlasLink, AtlasNode, AtlasScene } from './atlas.js'
import { advanceSpring, resolveSpring, type ArticleSpring, type AtlasSpringSettings } from './atlas-spring.js'
import { atlasLayoutSpeed, AtlasLayoutTransition, travelProgress, travelView, validateSpeed, type AtlasPoint } from './atlas-transition.js'
import type { GraphEvents, GraphFrame, GraphViewport, LoomGraph, Theme } from './types.js'
export { atlasSpringControls, type AtlasSpringSettings } from './atlas-spring.js'
export { atlasLayoutSpeed } from './atlas-transition.js'

interface Point {
  x: number
  y: number
  z?: number
}
export type AtlasMemberMotion = 'rigid' | 'spring'
/** Sparse, world-space offsets relative to the chosen layout. Older 2D offsets remain usable. */
export interface AtlasPositions {
  topics: Record<string, Point>
  members: Record<string, Point>
  articles: Record<string, Point>
}
export interface AtlasMapOptions {
  theme: Theme<AtlasNode, AtlasLink>
  keepView?: boolean
  /** Ease visible nodes and the camera between layouts. Defaults to false. */
  animateLayouts?: boolean
  /** Playback rate for layout changes. 1 takes 700 ms. Can be adjusted mid-transition. */
  layoutSpeed?: number
  /** The node the camera follows across layouts, or null when manual navigation takes over. */
  onFollowChange?: (id: string | null) => void
  /** Translate article positions with their topic, including articles that load later. Defaults to true. */
  moveMembers?: boolean
  /** How carried articles approach their new positions. Defaults to rigid. Springs respect reduced motion. */
  memberMotion?: AtlasMemberMotion
  /** Strength and damping for carried articles. Both default to 1. */
  spring?: Partial<AtlasSpringSettings>
  positions?: AtlasPositions
  onPositionsChange?: (positions: AtlasPositions) => void
  onPick?: (node: AtlasNode) => void
  /** Override double-click, double-tap or Enter. By default a topic opens and the camera focuses the node. */
  onOpen?: (node: AtlasNode) => void
  /** A background click after node hit testing, with its current projected scene. */
  onBackgroundClick?: (point: GraphEvents['backgroundclick'], frame: GraphFrame, scene: AtlasScene) => void
  onFrame?: (frame: GraphFrame, scene: AtlasScene) => void
}
const zero = { x: 0, y: 0, z: 0 }
const finite = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z ?? 0)
function offsets(initial?: Record<string, Point>): Map<string, Point> {
  return new Map(
    Object.entries(initial ?? {})
      .filter(([, p]) => finite(p))
      .map(([id, p]) => [id, { x: p.x, y: p.y, ...(p.z ? { z: p.z } : {}) }]),
  )
}
function remember(map: Map<string, Point>, id: string, x: number, y: number, z: number) {
  const before = map.get(id) ?? zero
  if (Math.max(Math.abs(before.x - x), Math.abs(before.y - y), Math.abs((before.z ?? 0) - z)) < 0.0001) return false
  if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < 0.0001) map.delete(id)
  else map.set(id, { x, y, ...(Math.abs(z) >= 0.0001 ? { z } : {}) })
  return true
}

/** Move topics and their members in world coordinates, independently of camera and data loading. */
export function mountAtlasMap(canvas: HTMLCanvasElement, atlas: Atlas, options: AtlasMapOptions) {
  let graph: LoomGraph<AtlasNode, AtlasLink>,
    scene: AtlasScene,
    layout: AtlasLayout,
    open: readonly number[] = []
  let selected: string | null = null,
    keepView = options.keepView ?? true,
    animateLayouts = options.animateLayouts ?? false,
    speed = validateSpeed(options.layoutSpeed ?? atlasLayoutSpeed.default),
    moveMembers = options.moveMembers ?? true,
    memberMotion = options.memberMotion ?? 'rigid',
    springSettings = resolveSpring(options.spring)
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
  let transition: AtlasLayoutTransition | undefined
  let fittedScene: AtlasScene | undefined
  let followed: string | null = null
  let focusTravel: { id: string; start: number; from: GraphViewport; to: GraphViewport } | undefined,
    pendingFocus: string | null = null
  let lastCloudAngle: { yaw: number; pitch: number } | undefined
  const modeForLayout = () => layout === 'cloud' ? 'cloud' : 'drift'
  function positions(): AtlasPositions {
    const copy = (map: Map<string, Point>) => Object.fromEntries(Array.from(map, ([id, p]) => [id, { ...p }]))
    return { topics: copy(hubOffsets), members: copy(groupOffsets), articles: copy(articleOffsets) }
  }
  function placed(node: AtlasNode) {
    const topic = String(node.topic),
      base = (node.article === undefined ? hubOffsets : groupOffsets).get(topic) ?? zero
    const local = node.article === undefined ? zero : (articleOffsets.get(node.id) ?? zero)
    return {
      x: node.x! + base.x + local.x,
      y: node.y! + base.y + local.y,
      z: (node.z ?? 0) + (base.z ?? 0) + (local.z ?? 0),
    }
  }
  function finishSprings() {
    for (const [id, spring] of springs) graph.pin(id, spring.target)
    springs.clear()
  }
  function onMotionPreference() {
    if (!motionPreference.matches) return
    finishSprings()
    finishLayout()
    if (focusTravel) {
      graph.setViewport(focusTravel.to)
      focusTravel = undefined
    }
  }
  function updateSprings() {
    if (!springs.size) return
    const now = performance.now(),
      dt = Math.max(0, (now - lastSpringFrame) / 1000)
    lastSpringFrame = now
    for (const [id, s] of springs) {
      if (advanceSpring(s, springSettings, dt)) {
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
    const { x, y, z } = graph.getPosition(node.id)
    const local = articleOffsets.get(node.id) ?? zero
    const radius = Math.hypot(
      node.x! + local.x - hub.x!,
      node.y! + local.y - hub.y!,
      (node.z ?? 0) + (local.z ?? 0) - (hub.z ?? 0),
    )
    springs.set(node.id, {
      x,
      y,
      z,
      target,
      vx: 0,
      vy: 0,
      vz: 0,
      frequency: 25 / (1 + Math.min(radius, 110) / 110),
    })
  }
  function moveHub(hub: AtlasNode, position: Point, alreadyPinned: boolean) {
    const id = String(hub.topic),
      before = placed(hub),
      dx = position.x - before.x,
      dy = position.y - before.y,
      z = position.z ?? before.z
    if (!remember(hubOffsets, id, position.x - hub.x!, position.y - hub.y!, z - (hub.z ?? 0))) return false
    if (!alreadyPinned) graph.pin(hub.id, position)
    if (moveMembers) {
      const base = groupOffsets.get(id) ?? zero
      remember(groupOffsets, id, base.x + dx, base.y + dy, (base.z ?? 0) + z - before.z)
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
      if (p.x !== Math.fround(s.x) || p.y !== Math.fround(s.y) || p.z !== Math.fround(s.z)) springs.delete(id)
    }
  }
  function commitPositions() {
    // Interpolated coordinates are display positions, never authored offsets.
    if (transition) return
    syncHubs()
    releaseDraggedArticles()
    for (const group of members.values())
      for (const node of group) {
        if (springs.has(node.id)) continue
        const pos = graph.getPosition(node.id),
          base = groupOffsets.get(String(node.topic)) ?? zero
        if (
          remember(
            articleOffsets,
            node.id,
            pos.x - node.x! - base.x,
            pos.y - node.y! - base.y,
            pos.z - (node.z ?? 0) - (base.z ?? 0),
          )
        )
          changed = true
      }
    if (changed) options.onPositionsChange?.(positions())
    changed = false
  }
  function finishLayout() {
    if (!transition) return
    const { destination, destinationMode } = transition
    transition = undefined
    graph.setMode(destinationMode)
    for (const node of scene.nodes) graph.pin(node.id, placed(node))
    graph.setViewport(destination)
    // Restore automatic fitting for the original scene. A newly opened block
    // keeps the same camera, just as it would after an instant layout switch.
    if (scene === fittedScene) graph.fit()
    fittedScene = undefined
    if (pendingFocus && byId.has(pendingFocus)) focus(pendingFocus)
  }
  function stepMotion() {
    if (transition) {
      const t = transition.progress()
      if (t === 1) finishLayout()
      else transition.paint(graph, t)
    }
    if (focusTravel) {
      const t = travelProgress(focusTravel.start, 380)
      graph.setViewport(t === 1 ? focusTravel.to : travelView(focusTravel.from, focusTravel.to, t))
      if (t === 1) focusTravel = undefined
    }
  }
  function setFollow(id: string | null) {
    if (followed === id) return
    followed = id
    options.onFollowChange?.(id)
  }
  function stopNavigation() {
    pendingFocus = null
    focusTravel = undefined
    setFollow(null)
    finishLayout()
  }
  function focus(id: string) {
    const node = byId.get(id)
    if (!node) throw new RangeError('Unknown atlas node: ' + id)
    setFollow(id)
    if (transition) {
      pendingFocus = id
      return
    }
    const center = springs.get(id)?.target ?? graph.getPosition(id)
    const from = graph.getViewport(), frame = graph.getFrame()
    const group = members.get(node.topic)
    let zoom = Math.max(5.5, from.zoom)
    if (node.article === undefined) {
      const volume = layout === 'cloud'
      let width = 16, height = 16
      for (const child of group ?? []) {
        const p = placed(child), x = p.x - center.x, y = p.y - center.y
        const radius = volume ? Math.hypot(x, y, p.z - center.z) * 1.12 : 0
        width = Math.max(width, volume ? radius : Math.abs(x))
        height = Math.max(height, volume ? radius : Math.abs(y))
      }
      // Leave space for captions around the centered topic. While its block is
      // loading, reserve the generated article ring and refine the bounds on arrival.
      if (!group?.length) width = height = 72
      zoom = Math.max(0.015, Math.min(4, frame.width * .39 / width, frame.height * .39 / height))
    }
    pendingFocus = node.article === undefined && !group?.length && atlas.getSnapshot().expanded.includes(node.topic) ? id : null
    const to = { ...from, x: center.x, y: center.y, z: center.z, zoom }
    if (motionPreference.matches) {
      focusTravel = undefined
      graph.setViewport(to)
    } else {
      focusTravel = { id, start: performance.now(), from, to }
      graph.invalidate()
    }
  }

  let tap: { id: string; delayed: boolean; timer: ReturnType<typeof setTimeout> } | undefined
  let doublePicked: string | null = null
  function clearTap(deliver = false) {
    if (!tap) return
    const { id, delayed, timer } = tap
    tap = undefined
    clearTimeout(timer)
    const node = byId.get(id)
    if (deliver && delayed && node) options.onPick?.(node)
  }
  function openNode(id: string) {
    clearTap()
    const node = byId.get(id)
    if (!node) return
    if (options.onOpen) options.onOpen(node)
    else {
      const { expanded } = atlas.getSnapshot()
      if (node.article === undefined && !expanded.includes(node.topic)) void atlas.setExpanded([...expanded, node.topic])
      focus(id)
    }
  }
  function pickNode(id: string) {
    doublePicked = null
    if (!byId.has(id)) return
    selected = id
    if (tap?.id === id) {
      doublePicked = id
      openNode(id)
      return
    }
    clearTap(true)
    const node = byId.get(id)
    if (!node) return
    // Articles can be inspected immediately. A topic's single click might remove its
    // entire block, so wait until it is distinct from a double-click or double-tap.
    const delayed = node.article === undefined
    tap = { id, delayed, timer: setTimeout(() => clearTap(true), 340) }
    if (!delayed) options.onPick?.(node)
  }
  function indexScene(next: AtlasScene) {
    scene = next
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
    if (followed && !byId.has(followed)) setFollow(null)
  }
  function layoutOrigin() {
    const animated = animateLayouts && !motionPreference.matches
    const from = graph.getViewport(), oldMode = graph.getFrame().mode
    const zoom = focusTravel?.to.zoom ?? transition?.destination.zoom ?? from.zoom
    if (layout === 'cloud' && !transition) lastCloudAngle = { yaw: from.yaw, pitch: from.pitch }
    const origins = new Map<string, AtlasPoint>()
    if (animated) for (const node of scene.nodes) {
      const p = graph.getPosition(node.id)
      if (oldMode !== 'cloud') p.z = 0
      origins.set(node.id, p)
    }
    transition = undefined
    focusTravel = undefined
    springs.clear()
    return { animated, from, oldMode, origins, zoom }
  }
  function startLayout({ animated, from, oldMode, origins, zoom }: ReturnType<typeof layoutOrigin>) {
    const mode = modeForLayout()
    graph.setMode(mode)
    for (const node of scene.nodes) graph.pin(node.id, placed(node))
    const camera = { ...from, ...lastCloudAngle }
    const anchor = followed ? byId.get(followed) : undefined
    if (anchor) graph.setViewport({ ...camera, ...placed(anchor), zoom })
    else {
      graph.setViewport(camera)
      graph.fit(true)
    }
    fittedScene = animated && !anchor ? scene : undefined
    if (animated) {
      transition = new AtlasLayoutTransition(origins, from, oldMode, graph.getViewport(), mode, speed)
      transition.bind(scene, placed)
      graph.setMode(transition.mode)
      transition.paint(graph, 0)
    }
  }
  function mount() {
    const next = atlas.getSnapshot()
    if (next.scene === scene) return
    const newLayout = graph && layout !== next.layout
    if (graph) commitPositions()
    // If the followed article disappears in flight, ease back to the surviving overview.
    const anchor = followed ? byId.get(followed) : undefined
    const lostAnchor = transition && anchor?.article !== undefined && !next.expanded.includes(anchor.topic)
    const origin = newLayout || lostAnchor ? layoutOrigin() : undefined
    if (origin && scene.links === next.scene.links) {
      layout = next.layout
      indexScene(next.scene)
      startLayout(origin)
      return
    }
    const previous = !newLayout && graph?.getViewport()
    if (graph) {
      events?.abort()
      graph.destroy()
    }
    // Subscribers can expand a topic while reacting to a layout notification.
    // A simultaneous topology replacement needs new buffers for the arriving IDs.
    layout = next.layout
    indexScene(next.scene)
    for (const id of springs.keys()) if (!byId.has(id)) springs.delete(id)
    graph = createGraph(canvas, {
      ...scene,
      nodes: scene.nodes.map((n) => {
        const { x, y, z } = springs.get(n.id) ?? placed(n)
        return { ...n, x, y, z }
      }),
      theme,
      mode: transition?.mode ?? modeForLayout(),
      layout: { pinOnDrag: true, blend: 1, autoRotate: false },
      sim: 'main',
      transparentBackground: true,
    })
    if (!lastCloudAngle) {
      const { yaw, pitch } = graph.getViewport()
      lastCloudAngle = { yaw, pitch }
    }
    if (previous) graph.setViewport(previous)
    if (origin) startLayout(origin)
    else if (transition) {
      transition.bind(scene, placed)
      stepMotion()
    }
    const added = next.expanded.find((id) => !open.includes(id))
    if (!keepView && added !== undefined && !transition && !followed) {
      const center = graph.getPosition('topic:' + added),
        camera = graph.getViewport()
      graph.setViewport({ ...camera, x: center.x, y: center.y, z: center.z, zoom: Math.max(1.5, camera.zoom) })
    }
    open = next.expanded
    if (selected && byId.has(selected)) graph.select(selected)
    if (pendingFocus && !byId.has(pendingFocus)) pendingFocus = null
    if (focusTravel && !byId.has(focusTravel.id)) focusTravel = undefined
    if (pendingFocus && !transition && members.has(byId.get(pendingFocus)!.topic)) focus(pendingFocus)
    graph.on('nodeclick', pickNode)
    graph.on('open', (id) => {
      // Native double-click also respects a longer system double-click interval.
      // Touch and typical mouse pairs have already been delivered on pointerup.
      if (doublePicked !== id) openNode(id)
      doublePicked = null
    })
    if (options.onBackgroundClick)
      graph.on('backgroundclick', (point) => {
        clearTap()
        options.onBackgroundClick!(point, graph.getFrame(), scene)
      })
    graph.onFrame((frame) => {
      options.onFrame?.(frame, scene)
      stepMotion()
      updateSprings()
    })
    events = new AbortController()
    const signal = events.signal
    canvas.addEventListener('wheel', stopNavigation, { capture: true, passive: true, signal })
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doublePicked = null
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) stopNavigation()
    }, { capture: true, signal })
    let down: { x: number; y: number } | undefined
    canvas.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) stopNavigation()
      focusTravel = undefined
      pendingFocus = null
      down = { x: e.clientX, y: e.clientY }
    }, { capture: true, signal })
    canvas.addEventListener('pointermove', (e) => {
      if (down && e.buttons === 1 && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) {
        clearTap()
        stopNavigation()
        down = undefined
      }
    }, { capture: true, signal })
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (e.buttons === 1 && !transition) {
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
    fit() { stopNavigation(); graph.fit() },
    focus,
    getFollowedNode: () => followed,
    /** Route an external topic label through the same gestures as its canvas dot. */
    pick: pickNode,
    open: openNode,
    isAnimatingLayout: () => !!transition,
    setAnimateLayouts(value: boolean) {
      animateLayouts = value
      if (!value) finishLayout()
    },
    getLayoutSpeed: () => speed,
    setLayoutSpeed(value: number) {
      speed = validateSpeed(value)
      transition?.setSpeed(speed)
    },
    getPosition: (id: string) => graph.getPosition(id),
    getFrame: () => graph.getFrame(),
    select(id: string | null) {
      selected = id
      graph.select(id)
    },
    zoom(factor: number) {
      if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Invalid atlas zoom')
      stopNavigation()
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
    getSpring: () => ({ ...springSettings }),
    setSpring(patch: Partial<AtlasSpringSettings>) {
      springSettings = resolveSpring(patch, springSettings)
    },
    moveTopic(id: number, position: Point) {
      const hub = byId.get('topic:' + id)
      if (!hub || !finite(position)) throw new RangeError('Invalid atlas topic position')
      stopNavigation()
      if (moveHub(hub, position, false)) options.onPositionsChange?.(positions())
    },
    /** Move a hub by CSS pixels on its camera-facing plane, including in a rotated 3D view. */
    moveTopicByScreen(id: number, dx: number, dy: number) {
      const index = hubs.findIndex((hub) => hub.topic === id)
      if (index < 0 || !Number.isFinite(dx) || !Number.isFinite(dy))
        throw new RangeError('Invalid atlas topic movement')
      stopNavigation()
      const points = graph.getFrame().points,
        k = 4 * index
      const p = graph.screenToWorld(points[k] + dx, points[k + 1] + dy, points[k + 3])
      if (moveHub(hubs[index], layout === 'cloud' ? p : { x: p.x, y: p.y }, false))
        options.onPositionsChange?.(positions())
    },
    getPositions: positions,
    focusConnection(source: string, target: string) {
      stopNavigation()
      const a = graph.getPosition(source),
        b = graph.getPosition(target),
        frame = graph.getFrame(),
        camera = graph.getViewport()
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      const zoom = Math.max(
        0.015,
        Math.min(
          3,
          (frame.width * 0.68) / Math.max(1, Math.abs(a.x - b.x)),
          (frame.height * 0.63) / Math.max(1, Math.abs(a.y - b.y)),
          layout === 'cloud' ? (Math.min(frame.width, frame.height) * 0.65) / Math.max(1, distance) : Infinity,
        ),
      )
      graph.setViewport({ ...camera, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, zoom })
    },
    resetPositions() {
      stopNavigation()
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
      clearTap()
      commitPositions()
      motionPreference.removeEventListener('change', onMotionPreference)
      springs.clear()
      events?.abort()
      graph.destroy()
    },
  }
}
