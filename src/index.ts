import type { GraphEvents, GraphFrame, GraphOptions, LayoutOptions, LoomGraph, Mode } from './types.js'
import { parchment } from './theme.js'
import { prepare, neighbors } from './model.js'
import { appearance } from './appearance.js'
import { makeLanes, layoutForces, makeSprings, makeTargets, placeOnTargets } from './constraints.js'
import { orbitTargets } from './sim/orbit.js'
import { Camera } from './camera.js'
import { Resolution, Scheduler } from './scheduler.js'
import { Renderer } from './render/renderer.js'
import { PickGrid } from './render/grid.js'
import { LayoutDriver } from './sim/driver.js'
import { Interaction } from './interaction.js'

export * from './types.js'
export { parchment, ink, blueprint, knowledgeConsole } from './theme.js'
export { toBinary, fromBinary } from './io/binary.js'
export { fromConsole } from './io/console.js'
export class WebGL2UnavailableError extends Error {
  constructor() {
    super('Loom requires a canvas with an available WebGL2 context.')
    this.name = 'WebGL2UnavailableError'
  }
}
const modes = new Set<Mode>(['drift', 'lanes', 'orbit', 'cloud'])

export function createGraph(canvas: HTMLCanvasElement, options: GraphOptions): LoomGraph {
  const start = performance.now()
  const mode = options.mode ?? 'drift'
  let theme = options.theme ?? parchment
  if (!modes.has(mode)) throw new TypeError('Unknown graph mode: ' + mode)
  let layout: LayoutOptions = { ...options.layout }
  let forces = layoutForces(layout)
  const model = prepare(options, theme, mode, layout)
  function targetsFor(mode: Mode, centre: number, config: LayoutOptions, lanes = model.laneMap) {
    if (mode === 'orbit') return orbitTargets(model, centre, config.orbitGap)
    if (config.blend) return makeTargets(options.nodes, config, lanes)
  }
  let targets = targetsFor(mode, -1, layout)
  if (targets) placeOnTargets(model.positions, model.fixed, targets, forces.blend ** 2, options.nodes)
  let fitWhenSettled = !!targets && forces.blend < 1
  const camera = new Camera(mode),
    grid = new PickGrid(model.n)
  const resolution = new Resolution(Math.min(2, window.devicePixelRatio || 1))
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = options.reducedMotion !== 'ignore' && motion.matches
  let shown: Float32Array = reduced ? model.positions.slice() : model.positions
  let dead = false,
    selected = -1,
    hovered = -1,
    frames = 0,
    lastTime = 0
  let dirty = true,
    gridDirty = true,
    sizeDirty = false,
    lastMoving = false,
    autoFit = true
  let idleSince = performance.now(),
    spin = false,
    timer: ReturnType<typeof setTimeout> | undefined
  let adjacent = new Uint8Array(model.n)
  const original = {
    width: canvas.getAttribute('width'),
    height: canvas.getAttribute('height'),
    touch: canvas.style.touchAction,
    cssWidth: canvas.style.width,
    cssHeight: canvas.style.height,
    tab: canvas.getAttribute('tabindex'),
    label: canvas.getAttribute('aria-label'),
  }
  let ownsWidth = false,
    ownsHeight = false
  const listeners = new EventTarget()
  const observers = new Set<(frame: GraphFrame) => void>()
  const emit = <K extends keyof GraphEvents>(type: K, value: GraphEvents[K]) =>
    listeners.dispatchEvent(new CustomEvent(type, { detail: value }))
  const schedule = new Scheduler(frame)
  const sim = new LayoutDriver(model, options, mode, schedule.wake, forces, targets)
  function repaint() {
    dirty = true
    schedule.wake()
  }
  function viewChanged() {
    gridDirty = true
    repaint()
  }
  function ensureGrid() {
    if (gridDirty) {
      grid.rebuild(shown, camera)
      gridDirty = false
    }
  }
  function size() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight
    if (!w || !h) {
      sizeDirty = false
      return
    }
    camera.width = Math.max(1, w)
    camera.height = Math.max(1, h)
    const bw = Math.max(1, Math.round(w * resolution.scale)),
      bh = Math.max(1, Math.round(h * resolution.scale))
    if (canvas.width !== bw) {
      canvas.width = bw
      if (w && canvas.clientWidth !== w) {
        canvas.style.width = w + 'px'
        ownsWidth = true
      }
    }
    if (canvas.height !== bh) {
      canvas.height = bh
      if (h && canvas.clientHeight !== h) {
        canvas.style.height = h + 'px'
        ownsHeight = true
      }
    }
    if (autoFit) {
      camera.fit(shown, model.n)
      camera.step(true)
    }
    sizeDirty = false
    gridDirty = dirty = true
  }
  function restoreSize() {
    if (ownsWidth) canvas.style.width = original.cssWidth
    if (ownsHeight) canvas.style.height = original.cssHeight
    for (const [key, value] of [
      ['width', original.width],
      ['height', original.height],
    ] as const) {
      if (value === null) canvas.removeAttribute(key)
      else canvas.setAttribute(key, value)
    }
  }
  size()
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
  })
  if (!gl) {
    restoreSize()
    throw new WebGL2UnavailableError()
  }
  let render: Renderer
  try {
    render = new Renderer(gl, model, options, theme, repaint)
  } catch (error) {
    restoreSize()
    throw error
  }
  render.paint(camera, selected, hovered, null, adjacent)
  gl.flush()
  frames++
  const firstSubmitMs = performance.now() - start

  const input = new Interaction(canvas, camera, model, {
    wake: viewChanged,
    reduced: () => reduced,
    pinOnDrag: () => !!layout.pinOnDrag,
    touch: () => {
      autoFit = false
      idle()
    },
    pick(x, y, touch) {
      ensureGrid()
      const node = grid.pick(x, y, camera.mode === 'cloud', touch ? 12 : 5)
      return node >= 0 ? node : render.pickLabel(x, y)
    },
    hover(i) {
      if (i !== hovered) {
        hovered = i
        emit('hover', options.nodes[i]?.id ?? null)
        repaint()
      }
    },
    select: choose,
    open() {
      const id = options.nodes[selected]?.id
      if (id !== undefined) emit('open', id)
    },
    positions: () => shown,
    pin: movePin,
  })
  let uploadNeeded = false
  function movePin(i: number, x: number, y: number, fixed: number, z?: number, dragging?: boolean) {
    if (dead) return
    sim.pin(i, x, y, fixed, z, dragging)
    const k = i * 4
    for (let axis = 0; axis < 3; axis++) shown[k + axis] = model.positions[k + axis]
    uploadNeeded = true
    viewChanged()
  }
  function idle() {
    clearTimeout(timer)
    spin = false
    idleSince = performance.now()
    if (camera.mode === 'cloud' && schedule.active && !reduced && !input.held) {
      timer = setTimeout(() => {
        spin = true
        schedule.wake()
      }, 1500)
    }
  }
  function frame(time: number): boolean {
    const begin = performance.now(),
      elapsed = lastTime ? time - lastTime : 0
    const dt = Math.max(1, Math.min(40, elapsed || 16))
    if (sizeDirty) size()
    const changed = sim.advance()
    if (changed && (!reduced || input.draggingNode || !sim.settling)) {
      if (reduced) shown.set(model.positions)
      else shown = model.positions
      uploadNeeded = true
      gridDirty = true
    }
    if (fitWhenSettled && !sim.settling) {
      fitWhenSettled = false
      if (autoFit) {
        camera.fit(shown, model.n)
        gridDirty = true
      }
    }
    const momentum = input.step(time, dt)
    if (spin) camera.rotate(dt * 0.018 * Math.min(1, Math.max(0, (time - idleSince - 1500) / 650)), 0)
    const easing = camera.step(reduced),
      moving = momentum || easing || spin
    if (moving || lastMoving) gridDirty = true
    if (uploadNeeded) {
      render.upload(shown)
      uploadNeeded = false
      dirty = true
    }
    if (dirty || gridDirty) {
      ensureGrid()
      render.paint(camera, selected, hovered, grid.projected, adjacent)
      frames++
      dirty = false
      if (observers.size) {
        const { width, height, zoom } = camera, vertical = forces.vertical
        const view = { points: grid.projected, width, height, zoom, mode: camera.mode, vertical,
          lanes: model.laneMap.offsets, laneOrigin: vertical ? height / 2 - camera.y * zoom : width / 2 - camera.x * zoom }
        for (const observer of observers) observer(view)
      }
    }
    lastMoving = moving
    if (resolution.sample(performance.now() - begin, elapsed, time)) sizeDirty = true
    const more = moving || sizeDirty || sim.needsFrame
    lastTime = more ? time : 0
    return more
  }
  function choose(i: number) {
    if (dead || selected === i) return
    selected = i
    adjacent = neighbors(model, i)
    if (!gl!.isContextLost()) render.neighborhood(adjacent)
    if (camera.mode === 'orbit') changeGeometry()
    emit('select', options.nodes[i]?.id ?? null)
    repaint()
  }
  function lookup(id: string) {
    const i = model.byId.get(id)
    if (i === undefined) throw new RangeError('Unknown node: ' + id)
    return i
  }
  function changeGeometry() {
    targets = targetsFor(camera.mode, selected, layout)
    sim.configure(camera.mode, { targets })
    if (forces.blend === 1) {
      shown = reduced ? model.positions.slice() : model.positions
      uploadNeeded = true
    }
    fitWhenSettled = autoFit
    viewChanged()
  }
  function suspend(reason: string, value: boolean) {
    if (dead) return
    schedule.suspend(reason, value)
    sim.suspend(!schedule.active)
    if (!schedule.active) {
      lastTime = 0
      input.reset()
    }
    idle()
  }
  const events = new AbortController(),
    eventOptions = { signal: events.signal }
  canvas.style.touchAction = 'none'
  if (original.tab === null) canvas.tabIndex = 0
  if (original.label === null)
    canvas.setAttribute(
      'aria-label',
      'Interactive graph. Arrow keys move the view, plus and minus zoom, Enter opens the selection.',
    )
  const resize = () => {
    if (!dead) {
      sizeDirty = true
      schedule.wake()
    }
  }
  const resizeObserver = new ResizeObserver(() => {
    if (
      Math.max(1, canvas.clientWidth) !== camera.width ||
      Math.max(1, canvas.clientHeight) !== camera.height
    )
      resize()
  })
  resizeObserver.observe(canvas)
  const intersection = new IntersectionObserver((entries) =>
    suspend('offscreen', !entries[entries.length - 1].isIntersecting),
  )
  intersection.observe(canvas)
  document.addEventListener('visibilitychange', () => suspend('document', document.hidden), eventOptions)
  motion.addEventListener(
    'change',
    () => {
      reduced = options.reducedMotion !== 'ignore' && motion.matches
      shown = reduced ? model.positions.slice() : model.positions
      uploadNeeded = true
      idle()
      viewChanged()
    },
    eventOptions,
  )
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault()
      suspend('context', true)
      render.destroy()
    },
    eventOptions,
  )
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      render = new Renderer(gl!, model, options, theme, repaint)
      render.setLayout(layout, camera.mode)
      render.neighborhood(adjacent)
      uploadNeeded = true
      gridDirty = dirty = true
      suspend('context', false)
    },
    eventOptions,
  )
  suspend('document', document.hidden)
  schedule.wake()
  const fit = () => {
    if (!dead) {
      autoFit = true
      camera.fit(shown, model.n)
      viewChanged()
    }
  }
  return {
    onFrame(observer) {
      if (!dead) {
        observers.add(observer)
        repaint()
      }
      return () => { observers.delete(observer) }
    },
    select(id) {
      if (!dead) choose(id === null ? -1 : lookup(id))
    },
    setMode(next) {
      if (dead || next === camera.mode) return
      if (!modes.has(next)) throw new TypeError('Unknown graph mode: ' + next)
      input.reset()
      camera.mode = next
      render.setLayout(layout, next)
      fit()
      changeGeometry()
      idle()
      emit('modechange', next)
    },
    setLayout(patch) {
      if (dead) return
      const next = { ...layout, ...patch },
        nextForces = layoutForces(next)
      const lanesChanged = next.laneGap !== layout.laneGap || next.laneOrder !== layout.laneOrder || next.laneBy !== layout.laneBy
      const geometryChanged =
        lanesChanged ||
        next.rowGap !== layout.rowGap ||
        next.direction !== layout.direction ||
        next.anchor !== layout.anchor || next.orbitGap !== layout.orbitGap
      const nextLanes = lanesChanged ? makeLanes(options.nodes, next) : model.laneMap
      const nextTargets =
        !targets || geometryChanged ? targetsFor(camera.mode, selected, next, nextLanes) : targets
      const springs =
        next.springsByKind !== layout.springsByKind
          ? makeSprings(options.links, next.springsByKind)
          : undefined
      const changed =
        springs !== undefined ||
        lanesChanged ||
        nextTargets !== targets ||
        (Object.keys(forces) as (keyof typeof forces)[]).some((k) => forces[k] !== nextForces[k])
      const guideChanged = layout.guides !== next.guides
      layout = next
      model.laneMap = nextLanes
      if (!gl!.isContextLost()) render.setLayout(layout, camera.mode)
      if (!changed) {
        if (guideChanged || geometryChanged) repaint()
        return
      }
      sim.configure(camera.mode, {
        forces: nextForces,
        targets: nextTargets !== targets ? nextTargets : undefined,
        lanes: lanesChanged ? model.laneMap.lanes : undefined,
        springs,
      })
      forces = nextForces
      targets = nextTargets
      if (forces.blend === 1) {
        shown = reduced ? model.positions.slice() : model.positions
        uploadNeeded = true
      }
      fitWhenSettled = autoFit
      viewChanged()
    },
    setTheme(next) {
      if (dead) return
      const look = appearance(options, model.degree, next)
      const resized = look.radii.some((radius, i) => radius !== model.look.radii[i])
      model.look = look
      theme = next
      if (resized) {
        for (let i = 0; i < model.n; i++) {
          model.positions[i * 4 + 3] = look.radii[i]
          shown[i * 4 + 3] = look.radii[i]
        }
        sim.configure(camera.mode, { radii: look.radii })
        uploadNeeded = true
        gridDirty = true
      }
      if (!gl!.isContextLost()) render.setTheme(next)
      repaint()
    },
    getPosition(id) {
      const i = lookup(id),
        k = i * 4
      return { x: shown[k], y: shown[k + 1], z: shown[k + 2], pinned: !!model.fixed[i] }
    },
    pin(id, pos) {
      if (dead) return
      const i = lookup(id),
        k = i * 4
      if (pos && ![pos.x, pos.y, pos.z ?? 0].every(Number.isFinite))
        throw new RangeError('Invalid pin position')
      movePin(i, pos?.x ?? shown[k], pos?.y ?? shown[k + 1], 1, pos?.z ?? shown[k + 2])
    },
    unpin(id) {
      if (dead) return
      const i = lookup(id),
        k = i * 4
      movePin(i, shown[k], shown[k + 1], 0, shown[k + 2])
    },
    focus(id) {
      if (dead) return
      const k = lookup(id) * 4
      autoFit = false
      camera.tx = shown[k]
      camera.ty = shown[k + 1]
      camera.tz = shown[k + 2]
      camera.targetZoom = Math.max(1.5, camera.targetZoom)
      viewChanged()
    },
    fit,
    reset() {
      if (!dead) {
        input.reset()
        choose(-1)
        camera.yaw = camera.pitch = 0
        fit()
        idle()
      }
    },
    pause() {
      suspend('manual', true)
    },
    resume() {
      suspend('manual', false)
    },
    resize,
    on(type, listener) {
      const event = (e: Event) => listener((e as CustomEvent).detail)
      listeners.addEventListener(type, event, eventOptions)
      return () => listeners.removeEventListener(type, event)
    },
    stats() {
      return {
        firstSubmitMs,
        frames,
        simTicks: sim.ticks,
        drawCalls: render.draws,
        labels: render.labelCount,
        dpr: resolution.scale,
        pendingFrame: schedule.pending,
        transport: sim.transport,
      }
    },
    destroy() {
      if (dead) return
      dead = true
      emit('destroy', undefined)
      observers.clear()
      schedule.destroy()
      clearTimeout(timer)
      events.abort()
      input.destroy()
      sim.destroy()
      intersection.disconnect()
      resizeObserver.disconnect()
      render.destroy()
      canvas.style.touchAction = original.touch
      restoreSize()
      for (const [key, value] of [
        ['tabindex', original.tab],
        ['aria-label', original.label],
      ] as const) {
        if (value === null) canvas.removeAttribute(key)
        else canvas.setAttribute(key, value)
      }
    },
  }
}
export { createGraph as create }
