import { Layout } from './layout.js'
import type { Model } from '../model.js'
import type { GraphOptions, GraphStats, Mode } from '../types.js'
import type { WorkerCommand, WorkerFrame } from './messages.js'

import { placeOnTargets, type Forces, type LayoutUpdate } from '../constraints.js'

export class LayoutDriver {
  transport: GraphStats['transport'] = 'main'
  ticks = 0
  #layout?: Layout
  #worker?: Worker
  #shared: Float32Array<SharedArrayBuffer>[] = []
  #spare?: ArrayBuffer
  #nextSlot = 0
  #busy = false
  #result?: WorkerFrame
  #epoch = 0
  #heldNode = -1
  #movedSinceStep = false
  #paced = false
  #active: boolean
  #suspended = false
  #model: Model
  #options: GraphOptions
  #mode: Mode
  #wake: () => void
  #forces: Forces
  #targets: Float32Array | undefined
  constructor(
    model: Model,
    options: GraphOptions,
    mode: Mode,
    wake: () => void,
    forces: Forces,
    targets?: Float32Array,
  ) {
    this.#model = model
    this.#options = options
    this.#mode = mode
    this.#wake = wake
    this.#forces = forces
    this.#targets = targets
    this.#active = model.movable > 0 && this.#forces.blend < 1
  }
  #post(message: WorkerCommand, transfer: Transferable[] = []) {
    this.#worker!.postMessage(message, transfer)
  }
  #local() {
    this.transport = 'main'
    this.#layout = new Layout(this.#model, this.#mode, this.#forces, this.#targets)
  }
  #init() {
    if (
      (this.#options.sim ?? (this.#model.n > 5000 ? 'worker' : 'main')) === 'main' ||
      typeof Worker === 'undefined'
    ) {
      this.#local()
      return
    }
    try {
      this.#worker = new Worker(
        this.#options.workerURL ?? new URL('./layout-worker.js', import.meta.url),
        { type: 'module', name: 'loom-layout' },
      )
      if (globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined') {
        this.#shared = [0, 1].map(
          () => new Float32Array(new SharedArrayBuffer(this.#model.positions.byteLength)),
        )
      }
      this.transport = this.#shared.length ? 'shared' : 'transfer'
      this.#worker.onmessage = (e: MessageEvent<WorkerFrame>) => {
        this.#result = e.data
        this.#busy = false
        this.#wake()
      }
      this.#worker.onerror = (e) => {
        e.preventDefault()
        this.#fallback()
        this.#wake()
      }
      this.#worker.onmessageerror = () => {
        this.#fallback()
        this.#wake()
      }
      const { n, positions, lanes, fixed, endpoints, springs } = this.#model
      this.#post({
        type: 'init',
        data: { n, positions, lanes, fixed, endpoints, springs },
        mode: this.#mode,
        forces: this.#forces,
        targets: this.#targets,
        shared: this.#shared.map((s) => s.buffer),
      })
    } catch {
      this.#fallback()
    }
  }
  #fallback() {
    this.#worker?.terminate()
    this.#worker = undefined
    this.#result = undefined
    this.#busy = false
    this.#shared = []
    this.#local()
  }
  advance() {
    let changed = false
    if (this.#suspended) return false
    if (this.#result) {
      const frame = this.#result
      this.#result = undefined
      if (frame.epoch === this.#epoch) {
        const previous = this.#model.positions
        this.#model.positions = frame.buffer ? new Float32Array(frame.buffer) : this.#shared[frame.slot]
        // Publish the worker's neighbours even when another pointer sample has
        // arrived. The held node follows the latest local pointer coordinates.
        if (this.#heldNode >= 0) {
          const k = this.#heldNode * 4
          this.#model.positions.set(previous.subarray(k, k + 3), k)
        }
        if (previous.buffer instanceof ArrayBuffer) this.#spare = previous.buffer
        this.#nextSlot = 1 - frame.slot
        this.ticks += frame.ticks
        this.#active = frame.active || (this.#movedSinceStep && this.#active)
        changed = true
      } else if (frame.buffer) this.#spare = frame.buffer
    }
    if (!this.#active) {
      this.#paced = false
      return changed
    }
    if (!this.#layout && !this.#worker) this.#init()
    if (this.#layout) {
      const revision = this.#layout.revision
      this.ticks += this.#layout.advance(3.5, this.#paced ? 1 : 4)
      this.#active = this.#layout.alpha > 0
      return this.#layout.revision !== revision || changed
    }
    if (!this.#busy) {
      this.#busy = true
      this.#movedSinceStep = false
      const buffer = this.#shared.length
        ? undefined
        : (this.#spare ?? new ArrayBuffer(this.#model.positions.byteLength))
      this.#spare = undefined
      this.#post(
        { type: 'step', epoch: this.#epoch, slot: this.#nextSlot, buffer, paced: this.#paced },
        buffer ? [buffer] : [],
      )
    }
    return changed
  }
  get settling() {
    return this.#active
  }
  get needsFrame() {
    return this.#active && !this.#suspended && !this.#worker
  }
  configure(mode: Mode, update: LayoutUpdate = {}) {
    if (update.lanes) this.#model.lanes = update.lanes
    if (update.springs !== undefined) this.#model.springs = update.springs
    if (update.forces) this.#forces = update.forces
    if (update.targets) this.#targets = update.targets
    if (this.#forces.blend === 1 && this.#targets)
      placeOnTargets(this.#model.positions, this.#model.fixed, this.#targets)
    this.#epoch++
    this.#paced = this.#heldNode >= 0
    this.#mode = mode
    this.#active = this.#forces.blend < 1 && this.#model.fixed.includes(0)
    this.#layout?.configure(mode, update)
    if (this.#worker) this.#post({ type: 'configure', mode, update })
  }
  pin(i: number, x: number, y: number, fixed: number, z?: number, dragging?: boolean) {
    if (!fixed && this.#forces.blend === 1 && this.#targets) {
      x = this.#targets[i * 3]
      y = this.#targets[i * 3 + 1]
      z = this.#targets[i * 3 + 2]
    }
    if (dragging !== undefined) {
      this.#heldNode = dragging ? i : -1
      this.#paced = true
    }
    if (dragging) this.#movedSinceStep = true
    else this.#epoch++
    this.#model.fixed[i] = fixed
    if (z !== undefined) this.#model.positions[i * 4 + 2] = z
    this.#model.positions[i * 4] = x
    this.#model.positions[i * 4 + 1] = y
    this.#active = this.#forces.blend < 1 && this.#model.fixed.includes(0)
    this.#layout?.pin(i, x, y, fixed, z)
    if (this.#worker) this.#post({ type: 'pin', i, x, y, fixed, z })
  }
  suspend(value: boolean) {
    if (this.#suspended === value) return
    this.#suspended = value
    if (this.#worker) this.#post({ type: 'suspend', value })
  }
  destroy() {
    if (this.#worker) {
      this.#worker.onmessage = this.#worker.onerror = this.#worker.onmessageerror = null
      this.#worker.terminate()
    }
  }
}
