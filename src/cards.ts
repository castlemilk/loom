import type { GraphData, GraphLink, GraphNode } from './types.js'

export interface CardOptions<N extends GraphNode, E extends GraphLink> {
  root?: string
  appearance?: 'cards' | 'dots'
  showLabels?: boolean
  showPorts?: boolean
  showArrows?: boolean
  /** Center a card on double-click, double-tap or Enter. Defaults to true. */
  focusOnOpen?: boolean
  /** Use authored coordinates if supplied. Set false to arrange a neighborhood around its root. */
  useNodePositions?: boolean
  image?: (node: N) => string | undefined
  badge?: (node: N) => string
  tint?: (node: N) => string
  relationship?: (edge: E) => string
  onSelect?: (node: N) => void
  /** Report the card's world coordinates once per completed drag or keyboard move. */
  onMove?: (node: N, position: { x: number; y: number }) => void
  /** Disable moving cards while leaving selection and camera navigation available. */
  movable?: boolean
}

/** Take up to limit distinct one-hop neighbors in input order, retaining their directed links to the root. */
export function cardNeighborhood<N extends GraphNode, E extends GraphLink>(
  data: GraphData<N, E>,
  root: string,
  limit = 8,
): GraphData<N, E> {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('Invalid card neighbor limit')
  if (!data.nodes.some((node) => node.id === root)) throw new RangeError('Unknown card root ' + root)
  const ids = new Set([root])
  const links: E[] = []
  for (const edge of data.links) {
    if (edge.source !== root && edge.target !== root) continue
    const other = edge.source === root ? edge.target : edge.source
    if (!ids.has(other) && ids.size - 1 >= limit) continue
    ids.add(other)
    links.push(edge)
  }
  return { nodes: data.nodes.filter((node) => ids.has(node.id)), links }
}
interface Box {
  x: number
  y: number
  w: number
  h: number
}
type Point = { x: number; y: number }
const NS = 'http://www.w3.org/2000/svg'
const overlap = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w + 9 && Math.abs(a.y - b.y) * 2 < a.h + b.h + 9
function curve(a: Box, b: Box): Point[] {
  if (a === b)
    return [
      { x: a.x + a.w / 2, y: a.y },
      { x: a.x + a.w / 2 + 65, y: a.y - 60 },
      { x: a.x, y: a.y - a.h / 2 - 65 },
      { x: a.x, y: a.y - a.h / 2 },
    ]
  const dx = b.x - a.x,
    dy = b.y - a.y
  if (Math.abs(dx) / (a.w + b.w) >= Math.abs(dy) / (a.h + b.h)) {
    const sign = Math.sign(dx) || 1,
      left = a.x + (sign * a.w) / 2,
      right = b.x - (sign * b.w) / 2,
      bend = sign * Math.max(30, Math.abs(right - left) * 0.45)
    return [
      { x: left, y: a.y },
      { x: left + bend, y: a.y },
      { x: right - bend, y: b.y },
      { x: right, y: b.y },
    ]
  }
  const sign = Math.sign(dy) || 1,
    top = a.y + (sign * a.h) / 2,
    bottom = b.y - (sign * b.h) / 2,
    bend = sign * Math.max(30, Math.abs(bottom - top) * 0.45)
  return [
    { x: a.x, y: top },
    { x: a.x, y: top + bend },
    { x: b.x, y: bottom - bend },
    { x: b.x, y: bottom },
  ]
}
function at(points: Point[], t: number): Point {
  const u = 1 - t,
    weights = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3]
  return {
    x: points.reduce((v, p, i) => v + weights[i] * p.x, 0),
    y: points.reduce((v, p, i) => v + weights[i] * p.y, 0),
  }
}
function titleLines(title: string, limit: number) {
  const lines: string[] = ['']
  for (const word of title.split(/\s+/)) {
    const last = lines.length - 1,
      combined = lines[last] ? lines[last] + ' ' + word : word
    if (combined.length <= limit || !lines[last]) lines[last] = combined
    else lines.push(word)
  }
  return lines
    .slice(0, 2)
    .map((s, i) => (s.length > limit || (i === 1 && lines.length > 2) ? s.slice(0, limit - 1) + '…' : s))
}

/** An accessible SVG view for a bounded neighborhood. All user-supplied labels render as text. */
export function createCardGraph<N extends GraphNode, E extends GraphLink>(
  svg: SVGSVGElement,
  initial: GraphData<N, E>,
  initialOptions: CardOptions<N, E> = {},
) {
  const doc = svg.ownerDocument,
    lifetime = new AbortController()
  const originalView = svg.getAttribute('viewBox'),
    originalTouch = svg.style.touchAction
  const layer = doc.createElementNS(NS, 'g')
  let data = initial,
    options = { ...initialOptions },
    selected = options.root ?? null
  let boxes = new Map<string, Box>(),
    camera = { x: 0, y: 0, w: 900, h: 520 }
  let active:
    | { id?: string; pointer: number; point: Point; start: Point; moved: boolean; scaleX: number; scaleY: number }
    | undefined
  let skipClick = false
  let lastPick: { id: string; time: number } | undefined
  let focusFrame: number | undefined
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  function element<K extends keyof SVGElementTagNameMap>(
    parent: Element,
    tag: K,
    attrs: Record<string, string | number>,
    text?: string,
  ) {
    const el = doc.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    if (text !== undefined) el.textContent = text
    parent.append(el)
    return el
  }
  function positions(nextData: GraphData<N, E>, settings: CardOptions<N, E>) {
    const next = new Map<string, Box>(),
      others = nextData.nodes.filter((n) => n.id !== settings.root),
      split = Math.ceil(others.length / 2)
    const previousNodes = new Map(data.nodes.map((node) => [node.id, node]))
    const slots = new Map(others.map((n, i) => [n.id, i]))
    for (const node of nextData.nodes) {
      const root = node.id === settings.root,
        i = slots.get(node.id) ?? 0,
        left = i < split
      const previous = boxes.get(node.id)
      const prior = previousNodes.get(node.id),
        authored = settings.useNodePositions !== false
      const previousBox = authored === (options.useNodePositions !== false) ? previous : undefined
      const x =
        (!authored || prior?.x === node.x ? previousBox?.x : undefined) ??
        (authored ? node.x : undefined) ??
        (root ? 0 : left ? -301 : 301)
      const y =
        (!authored || prior?.y === node.y ? previousBox?.y : undefined) ??
        (authored ? node.y : undefined) ??
        (root ? 0 : ((left ? i : i - split) - ((left ? split : others.length - split) - 1) / 2) * 110)
      if (next.has(node.id)) throw new RangeError('Duplicate card node ' + node.id)
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Invalid card coordinates for ' + node.id)
      const dots = settings.appearance === 'dots'
      next.set(node.id, { x, y, w: dots ? 26 : root ? 220 : 192, h: dots ? 26 : root ? 80 : 72 })
    }
    for (const edge of nextData.links)
      if (!next.has(edge.source) || !next.has(edge.target)) throw new RangeError('Unknown card endpoint')
    return next
  }
  function view() {
    svg.setAttribute('viewBox', [camera.x - camera.w / 2, camera.y - camera.h / 2, camera.w, camera.h].join(' '))
  }
  function stopFocus() {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame)
    focusFrame = undefined
  }
  function focus(id: string) {
    const box = boxes.get(id)
    if (!box) throw new RangeError('Unknown card node ' + id)
    stopFocus()
    const from = { ...camera }
    const width = Math.max(1, svg.clientWidth), height = Math.max(1, svg.clientHeight)
    const scale = Math.min(Math.max(from.w / width, from.h / height), Math.max(2 * box.w / width, 2 * box.h / height))
    const target = { x: box.x, y: box.y, w: scale * width, h: scale * height }
    const start = performance.now()
    function step(now: number) {
      const t = motion.matches ? 1 : Math.max(0, Math.min(1, (now - start) / 340))
      const ease = t * t * (3 - 2 * t)
      for (const key of ['x', 'y', 'w', 'h'] as const) camera[key] = from[key] + (target[key] - from[key]) * ease
      view()
      focusFrame = t < 1 ? requestAnimationFrame(step) : undefined
    }
    step(start)
  }
  function fit() {
    stopFocus()
    lastPick = undefined
    const all = [...boxes.values()]
    if (all.length) {
      const minX = Math.min(...all.map((b) => b.x - b.w / 2)),
        maxX = Math.max(...all.map((b) => b.x + b.w / 2))
      const minY = Math.min(...all.map((b) => b.y - b.h / 2)),
        maxY = Math.max(...all.map((b) => b.y + b.h / 2))
      camera = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        w: Math.max(200, maxX - minX + 54),
        h: Math.max(150, maxY - minY + 60),
      }
    }
    view()
  }
  function draw() {
    const focused = (doc.activeElement as Element | null)?.closest('[data-card-id]')
    const restore = focused && layer.contains(focused) ? focused.getAttribute('data-card-id') : null
    layer.replaceChildren()
    const wires = element(layer, 'g', { 'aria-hidden': 'true' }),
      captions = element(layer, 'g', { 'aria-hidden': 'true' })
    const occupied = [...boxes.values()],
      dots = options.appearance === 'dots'
    for (const edge of data.links) {
      const p = curve(boxes.get(edge.source)!, boxes.get(edge.target)!)
      const ink = edge.source === selected || edge.target === selected ? '#375dff' : '#8495c0'
      element(wires, 'path', {
        d:
          'M ' +
          p[0].x +
          ' ' +
          p[0].y +
          ' C ' +
          p
            .slice(1)
            .map((v) => v.x + ' ' + v.y)
            .join(' '),
        fill: 'none',
        stroke: ink,
        'stroke-width': 1.8,
        'data-card-edge': edge.source + ' ' + edge.target,
      })
      if (options.showArrows) {
        const end = p[3],
          tangent = Math.atan2(end.y - p[2].y, end.x - p[2].x)
        const tip = { x: end.x - 3 * Math.cos(tangent), y: end.y - 3 * Math.sin(tangent) }
        const wings = [tangent - 0.5, tangent + 0.5].map((angle) =>
          [tip.x - 8 * Math.cos(angle), tip.y - 8 * Math.sin(angle)].join(' '),
        )
        element(wires, 'path', {
          d: 'M ' + wings[0] + ' L ' + tip.x + ' ' + tip.y + ' L ' + wings[1],
          fill: 'none',
          stroke: ink,
          'stroke-width': 1.8,
          'data-card-arrow': '',
        })
      }
      if (options.showLabels === false) continue
      const full = options.relationship?.(edge) ?? edge.kind
      if (!full) continue
      const label = full.length > 29 ? full.slice(0, 28) + '…' : full,
        w = label.length * 6.4 + 15
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const q = at(p, t),
          box = { ...q, w, h: 20 }
        if (occupied.some((other) => overlap(box, other))) continue
        occupied.push(box)
        const g = element(captions, 'g', { 'data-card-caption': '', transform: 'translate(' + q.x + ' ' + q.y + ')' })
        element(g, 'title', {}, full)
        element(g, 'rect', { x: -w / 2, y: -10, width: w, height: 20, rx: 10, fill: '#f6f7fa', stroke: '#a1aabc' })
        element(g, 'text', { 'text-anchor': 'middle', y: 3.5, fill: '#333944', 'font-size': 10.5 }, label)
        break
      }
    }
    for (const node of data.nodes) {
      const b = boxes.get(node.id)!,
        root = node.id === options.root,
        on = selected === node.id,
        title = node.label || node.id
      const tag = options.badge?.(node) ?? node.kind ?? 'Node',
        tint = options.tint?.(node) ?? '#eaeaf5'
      const g = element(layer, 'g', {
        transform: 'translate(' + b.x + ' ' + b.y + ')',
        'data-card-id': node.id,
        role: 'button',
        tabindex: 0,
        'aria-pressed': String(on),
        'aria-label': title + ' · ' + tag,
        style: 'cursor:grab',
      })
      element(g, 'title', {}, title + ' · ' + tag)
      if (dots) {
        element(g, 'circle', {
          r: 13,
          fill: root ? '#14161f' : tint,
          stroke: on ? '#375dff' : '#8792aa',
          'stroke-width': on ? 3 : 1.2,
        })
        element(g, 'text', { x: 20, y: 4, fill: '#222530', 'font-size': 13 }, title)
      } else {
        const left = -b.w / 2,
          avatar = left + 27,
          nameX = left + 54,
          ink = root ? '#ffffff' : '#191c25'
        element(g, 'rect', {
          x: left,
          y: -b.h / 2,
          width: b.w,
          height: b.h,
          rx: 11,
          fill: root ? '#15171e' : on ? '#eff2ff' : '#ffffff',
          stroke: on ? '#375dff' : '#8792a6',
          'stroke-width': on ? 2.6 : 1.1,
        })
        element(g, 'rect', { x: avatar - 18, y: -18, width: 36, height: 36, rx: 7, fill: tint, stroke: '#e0e2e8' })
        const letters = title
          .split(/[\s-]+/u)
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => Array.from(s)[0])
          .join('')
          .toUpperCase()
        const fallback = element(
          g,
          'text',
          { x: avatar, y: 4.5, 'text-anchor': 'middle', fill: '#232533', 'font-size': 12, 'font-weight': 700 },
          letters,
        )
        const image = options.image?.(node)
        if (image) {
          const logo = element(g, 'image', {
            x: avatar - 15,
            y: -15,
            width: 30,
            height: 30,
            href: image,
            preserveAspectRatio: 'xMidYMid meet',
          })
          logo.addEventListener('load', () => fallback.setAttribute('visibility', 'hidden'), { once: true })
          logo.addEventListener('error', () => logo.remove(), { once: true })
        }
        const lines = titleLines(title, root ? 19 : 16),
          top = lines.length > 1 ? -13 : -4
        lines.forEach((line, i) =>
          element(
            g,
            'text',
            { x: nameX, y: top + 18 * i, fill: ink, 'font-size': root ? 18 : 15, 'font-weight': 680 },
            line,
          ),
        )
        const badge = tag.toUpperCase().slice(0, 19),
          y = top + (lines.length - 1) * 18 + 8
        element(g, 'rect', { x: nameX, y, width: badge.length * 5.7 + 12, height: 15, rx: 4, fill: tint })
        element(g, 'text', { x: nameX + 6, y: y + 10.5, fill: '#343643', 'font-size': 9, 'font-weight': 700 }, badge)
        if (options.showPorts !== false)
          for (const x of [left, -left])
            element(g, 'circle', {
              cx: x,
              cy: 0,
              r: 3,
              fill: '#fff',
              stroke: '#818da4',
              'stroke-width': 1.2,
              'data-card-port': '',
            })
      }
      if (restore === node.id) g.focus({ preventScroll: true })
    }
  }
  function select(id: string | null, notify = false) {
    if (id !== null && !boxes.has(id)) throw new RangeError('Unknown card node ' + id)
    selected = id
    draw()
    if (id !== null && notify) options.onSelect?.(data.nodes.find((n) => n.id === id)!)
  }
  boxes = positions(data, options)
  svg.append(layer)
  svg.style.touchAction = 'none'
  const signal = lifetime.signal
  const hit = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.('[data-card-id]')?.getAttribute('data-card-id') ?? undefined
  function zoom(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Invalid card zoom')
    stopFocus()
    lastPick = undefined
    const applied = Math.max(50, Math.min(12000, camera.w / factor)) / camera.w
    camera.w *= applied
    camera.h *= applied
    view()
  }
  svg.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || active) return
      stopFocus()
      const transform = svg.getScreenCTM()
      if (!transform) return
      const id = hit(e.target)
      if (id && options.movable === false) return
      active = {
        id,
        pointer: e.pointerId,
        point: { x: e.clientX, y: e.clientY },
        start: { ...(id ? boxes.get(id)! : camera) },
        moved: false,
        scaleX: transform.a,
        scaleY: transform.d,
      }
      skipClick = false
    },
    { signal },
  )
  svg.addEventListener(
    'pointermove',
    (e) => {
      if (!active || active.pointer !== e.pointerId) return
      const dx = e.clientX - active.point.x,
        dy = e.clientY - active.point.y
      if (!active.moved && Math.hypot(dx, dy) < 4) return
      if (!active.moved) svg.setPointerCapture(e.pointerId)
      active.moved = true
      lastPick = undefined
      if (active.id) {
        const box = boxes.get(active.id)!
        box.x = active.start.x + dx / active.scaleX
        box.y = active.start.y + dy / active.scaleY
        draw()
      } else {
        camera.x = active.start.x - dx / active.scaleX
        camera.y = active.start.y - dy / active.scaleY
        view()
      }
    },
    { signal },
  )
  function moved(id: string) {
    const { x, y } = boxes.get(id)!
    options.onMove?.(data.nodes.find(node => node.id === id)!, { x, y })
  }
  const end = (event: PointerEvent) => {
    if (active?.pointer !== event.pointerId) return
    const { id, start, moved: dragged } = active
    skipClick = dragged
    active = undefined
    if (!id || !dragged) return
    if (event.type === 'pointerup') moved(id)
    else {
      Object.assign(boxes.get(id)!, { x: start.x, y: start.y })
      draw()
    }
  }
  svg.addEventListener('pointerup', end, { signal })
  svg.addEventListener('pointercancel', end, { signal })
  svg.addEventListener('lostpointercapture', event => { if (event.target === svg) end(event) }, { signal })
  svg.addEventListener(
    'pointerleave',
    (event) => {
      if (active && !active.moved) end(event)
    },
    { signal },
  )
  svg.addEventListener(
    'click',
    (e) => {
      const id = hit(e.target)
      if (id && !skipClick) {
        const time = performance.now()
        const twice = lastPick?.id === id && (e.detail === 2 || time - lastPick.time < 340)
        lastPick = twice ? undefined : { id, time }
        select(id, true)
        if (twice && options.focusOnOpen !== false) focus(id)
      } else lastPick = undefined
      skipClick = false
    },
    { signal },
  )
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12)
    },
    { signal, passive: false },
  )
  svg.addEventListener(
    'keydown',
    (e) => {
      const id = hit(e.target)
      if (!id) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        select(id, true)
        if (e.key === 'Enter' && options.focusOnOpen !== false) focus(id)
        return
      }
      const delta: Record<string, number[]> = {
        ArrowLeft: [-12, 0],
        ArrowRight: [12, 0],
        ArrowUp: [0, -12],
        ArrowDown: [0, 12],
      }
      if (delta[e.key] && options.movable !== false) {
        e.preventDefault()
        const b = boxes.get(id)!
        b.x += delta[e.key][0]
        b.y += delta[e.key][1]
        draw()
        moved(id)
      }
    },
    { signal },
  )
  fit()
  draw()
  return {
    select,
    focus,
    fit,
    zoom,
    setOptions(patch: Partial<CardOptions<N, E>>) {
      const next = { ...options, ...patch }
      boxes = positions(data, next)
      options = next
      draw()
    },
    setData(next: GraphData<N, E>) {
      stopFocus()
      lastPick = undefined
      boxes = positions(next, options)
      data = next
      active = undefined
      if (selected && !boxes.has(selected)) selected = null
      draw()
    },
    destroy() {
      stopFocus()
      lifetime.abort()
      layer.remove()
      svg.style.touchAction = originalTouch
      if (originalView === null) svg.removeAttribute('viewBox')
      else svg.setAttribute('viewBox', originalView)
    },
  }
}
