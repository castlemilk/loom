import type { GraphStats, LoomGraph } from './types.js'

export type GPUStatus = 'waiting' | 'measured' | 'unavailable' | 'disjoint'
export interface PerformanceSample extends GraphStats {
  idle: boolean
  /** Graph draw submissions per second over the last second. */
  fps: number
  /** Mean main-thread time in a Loom scheduler callback over the last second. */
  mainThreadMs: number | null
  p95FrameMs: number | null
  frameIntervals: readonly number[]
  /** Most recent asynchronous GPU draw sample, in milliseconds. */
  gpuMs: number | null
  gpuStatus: GPUStatus
  /** Browser-reported JavaScript heap usage, in bytes, when available. */
  heapBytes: number | null
}
interface TimerExtension { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number; QUERY_COUNTER_BITS_EXT: number }

class GPUClock {
  status: GPUStatus = 'waiting'
  ms: number | null = null
  #gl?: WebGL2RenderingContext
  #ext?: TimerExtension | null
  #query?: WebGLQuery
  #open = false
  #last = -Infinity
  #lost = () => {
    this.#query = undefined
    this.#open = false
    this.#ext = undefined
    this.ms = null
    this.status = 'waiting'
  }
  begin(gl: WebGL2RenderingContext) {
    if (this.#query || this.#ext === null || gl.isContextLost()) return
    const now = performance.now()
    if (now - this.#last < 160) return
    this.#last = now
    if (!this.#gl) {
      this.#gl = gl
      gl.canvas.addEventListener('webglcontextlost', this.#lost)
    }
    if (!this.#ext) {
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null
      this.#ext = ext && Number(gl.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT)) > 0 ? ext : null
    }
    if (!this.#ext) { this.status = 'unavailable'; return }
    const target = this.#ext.TIME_ELAPSED_EXT
    if (gl.getQuery(target, gl.CURRENT_QUERY)) return
    const query = gl.createQuery()
    if (!query) return
    this.#query = query
    gl.beginQuery(target, query)
    this.#open = true
  }
  end() {
    if (!this.#open) return
    this.#gl!.endQuery(this.#ext!.TIME_ELAPSED_EXT)
    this.#open = false
  }
  poll(now: number) {
    const gl = this.#gl, query = this.#query, ext = this.#ext
    if (!gl || !query || !ext || this.#open || gl.isContextLost()) return false
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      this.ms = null
      this.status = 'disjoint'
    } else if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      this.ms = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6
      this.status = 'measured'
    } else if (now - this.#last < 2000) {
      return true
    } else {
      this.ms = null
      this.status = 'waiting'
    }
    gl.deleteQuery(query)
    this.#query = undefined
    return false
  }
  destroy() {
    if (this.#gl && !this.#gl.isContextLost()) {
      this.end()
      if (this.#query) this.#gl.deleteQuery(this.#query)
    }
    this.#gl?.canvas.removeEventListener('webglcontextlost', this.#lost)
  }
}

/** Samples existing renderer work. Sleeping graphs produce one final idle update. */
export function observePerformance(graph: Pick<LoomGraph, 'onTiming' | 'on' | 'stats'>, listener: (sample: PerformanceSample) => void) {
  const gpu = new GPUClock(), started = performance.now()
  let rows: { at: number; work: number; interval: number; painted: boolean }[] = []
  let timer: ReturnType<typeof setTimeout> | undefined, closed = false
  let previousPaint = 0
  const history: number[] = []
  function schedule() {
    if (timer === undefined && !closed) timer = setTimeout(publish, 250)
  }
  function publish() {
    timer = undefined
    if (closed) return
    const now = performance.now(), pending = gpu.poll(now)
    rows = rows.filter((row) => row.at > now - 1000)
    const intervals = rows.map((r) => r.interval).filter((v) => v > 0).sort((a, b) => a - b)
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
    const duration = Math.min(1000, Math.max(1, now - started))
    listener({ ...graph.stats(), idle: !rows.length, fps: rows.filter((r) => r.painted).length * 1000 / duration,
      mainThreadMs: rows.length ? rows.reduce((n, r) => n + r.work, 0) / rows.length : null,
      p95FrameMs: intervals[Math.ceil(intervals.length * 0.95) - 1] ?? null,
      frameIntervals: history.slice(), gpuMs: gpu.ms, gpuStatus: gpu.status, heapBytes: heap ?? null })
    if (rows.length || pending) schedule()
  }
  const off = graph.onTiming({
    beginDraw: (gl) => gpu.begin(gl), endDraw: () => gpu.end(),
    sample(at, work, elapsed, painted) {
      // Pointer events can request consecutive paints while the scheduler sleeps
      // between them. Drop the gap only when a new burst follows an idle period.
      if (!elapsed && at - previousPaint > 250) previousPaint = 0
      const interval = painted && previousPaint ? at - previousPaint : 0
      if (painted) previousPaint = at
      if (interval > 0) {
        if (history.length === 48) history.shift()
        history.push(interval)
      }
      rows.push({ at, work, interval, painted })
      schedule()
    },
  })
  const offDestroy = graph.on('destroy', stop)
  function stop() {
    if (closed) return
    closed = true
    clearTimeout(timer)
    off()
    offDestroy()
    gpu.destroy()
  }
  schedule()
  return stop
}
