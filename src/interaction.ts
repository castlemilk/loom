import { Camera, clamp } from './camera.js'
import type { Model } from './model.js'

interface Actions {
  wake(): void
  touch(): void
  pick(x: number, y: number, touch?: boolean): number
  hover(i: number): void
  select(i: number): void
  open(): void
  positions(): Float32Array
  pin(i: number, x: number, y: number, fixed: number, z?: number, dragging?: boolean): void
  reduced(): boolean
  pinOnDrag(): boolean
}
interface Pointer {
  x: number
  y: number
  startX: number
  startY: number
  time: number
}
export class Interaction {
  private abort = new AbortController()
  private points = new Map<number, Pointer>()
  private node = -1
  private grab = new Float32Array(4)
  private fixed = 0
  private dragged = false
  private vx = 0
  private vy = 0
  private releaseTime = 0
  get draggingNode() {
    return this.dragged && this.node >= 0
  }
  get held() {
    return this.points.size > 0
  }
  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private model: Model,
    private actions: Actions,
  ) {
    const opts = { signal: this.abort.signal }
    const position = (e: PointerEvent | WheelEvent) => {
      const b = canvas.getBoundingClientRect()
      return { x: e.clientX - b.left - canvas.clientLeft, y: e.clientY - b.top - canvas.clientTop }
    }
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return
        const p = position(e)
        canvas.focus({ preventScroll: true })
        this.vx = this.vy = 0
        if (!this.points.size) {
          this.dragged = false
          this.node = actions.pick(p.x, p.y, e.pointerType === 'touch')
          if (this.node >= 0) {
            this.fixed = model.fixed[this.node]
            const k = this.node * 4,
              shown = actions.positions()
            camera.project(shown[k], shown[k + 1], shown[k + 2], this.grab, 0, camera.basis())
            this.grab[0] -= p.x
            this.grab[1] -= p.y
          }
        } else {
          this.releaseNode()
          this.dragged = true
        }
        this.points.set(e.pointerId, { ...p, startX: p.x, startY: p.y, time: e.timeStamp })
        if (canvas.hasPointerCapture(e.pointerId) || e.isTrusted) canvas.setPointerCapture(e.pointerId)
        actions.touch()
      },
      opts,
    )
    canvas.addEventListener(
      'pointermove',
      (e) => {
        const p = position(e),
          old = this.points.get(e.pointerId)
        if (!old) {
          if (!this.points.size) actions.hover(actions.pick(p.x, p.y))
          return
        }
        const dx = p.x - old.x,
          dy = p.y - old.y
        const other = [...this.points.entries()].find(([id]) => id !== e.pointerId)?.[1]
        if (other) {
          const before = Math.hypot(old.x - other.x, old.y - other.y),
            after = Math.hypot(p.x - other.x, p.y - other.y)
          camera.pan(dx / 2, dy / 2)
          camera.zoomAt(
            (other.x + p.x) / 2,
            (other.y + p.y) / 2,
            Math.max(2, after) / Math.max(2, before),
          )
          this.dragged = true
        } else if (this.dragged || Math.hypot(p.x - old.startX, p.y - old.startY) > 3) {
          const mx = this.dragged ? dx : p.x - old.startX,
            my = this.dragged ? dy : p.y - old.startY
          this.dragged = true
          if (this.node >= 0) {
            const [x, y, z] = camera.unproject(p.x + this.grab[0], p.y + this.grab[1], this.grab[3])
            actions.pin(this.node, x, y, 1, camera.mode === 'cloud' ? z : undefined, true)
          } else {
            if (camera.mode === 'cloud') camera.rotate(mx, my)
            else camera.pan(mx, my)
            const dt = Math.max(8, e.timeStamp - old.time)
            this.vx = clamp(mx / dt, -1.4, 1.4)
            this.vy = clamp(my / dt, -1.4, 1.4)
          }
        }
        old.x = p.x
        old.y = p.y
        old.time = e.timeStamp
        camera.step(true)
        actions.touch()
        actions.wake()
      },
      opts,
    )
    const release = (e: PointerEvent, cancel: boolean) => {
      const last = this.points.get(e.pointerId)
      if (!last) return
      this.points.delete(e.pointerId)
      if (!this.points.size) {
        if (!cancel && !this.dragged) actions.select(this.node)
        if (cancel || e.timeStamp - last.time > 90 || actions.reduced()) this.vx = this.vy = 0
        this.releaseTime = performance.now()
        this.releaseNode(!cancel && actions.pinOnDrag())
      }
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      actions.touch()
      actions.wake()
    }
    canvas.addEventListener('pointerup', (e) => release(e, false), opts)
    canvas.addEventListener('pointercancel', (e) => release(e, true), opts)
    canvas.addEventListener('lostpointercapture', (e) => release(e, true), opts)
    canvas.addEventListener(
      'pointerleave',
      () => {
        if (!this.points.size) actions.hover(-1)
      },
      opts,
    )
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const p = position(e),
          unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? camera.height : 1
        camera.zoomAt(p.x, p.y, Math.exp(clamp(-e.deltaY * unit * 0.0018, -1, 1)))
        actions.touch()
        actions.wake()
      },
      { ...opts, passive: false },
    )
    canvas.addEventListener(
      'keydown',
      (e) => {
        const arrows: Record<string, [number, number]> = {
          ArrowLeft: [32, 0],
          ArrowRight: [-32, 0],
          ArrowUp: [0, 32],
          ArrowDown: [0, -32],
        }
        if (e.key in arrows) {
          const [x, y] = arrows[e.key]
          if (camera.mode === 'cloud') camera.rotate(x, y)
          else camera.pan(x, y)
        } else if (['+', '=', '-'].includes(e.key))
          camera.zoomAt(camera.width / 2, camera.height / 2, e.key === '-' ? 0.8 : 1.25)
        else if (e.key === 'Enter') actions.open()
        else if (e.key === 'Escape') actions.select(-1)
        else return
        e.preventDefault()
        actions.touch()
        actions.wake()
      },
      opts,
    )
  }
  private releaseNode(retain = false) {
    if (this.draggingNode) {
      const k = this.node * 4
      this.actions.pin(
        this.node,
        this.model.positions[k],
        this.model.positions[k + 1],
        retain ? 1 : this.fixed,
        this.model.positions[k + 2],
        false,
      )
    }
    this.node = -1
  }
  reset() {
    this.releaseNode()
    for (const id of this.points.keys())
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id)
    this.points.clear()
    this.vx = this.vy = 0
  }
  step(now: number, dt: number) {
    if (this.held || this.actions.reduced() || Math.abs(this.vx) + Math.abs(this.vy) < 0.012)
      return false
    if (now - this.releaseTime > 1500) {
      this.vx = this.vy = 0
      return false
    }
    const decay = Math.exp(-dt / 160)
    this.vx *= decay
    this.vy *= decay
    if (this.camera.mode === 'cloud') this.camera.rotate(this.vx * dt, this.vy * dt)
    else this.camera.pan(this.vx * dt, this.vy * dt)
    return true
  }
  destroy() {
    this.abort.abort()
    this.reset()
  }
}
