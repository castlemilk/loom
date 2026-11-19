import type { Mode } from '../types.js'
import { cloudDepth } from '../model.js'
import { ChargeTree } from './tree.js'
import { defaultForces, placeOnTargets, type Forces, type LayoutUpdate } from '../constraints.js'

export interface LayoutData {
  n: number
  positions: Float32Array
  fixed: Uint8Array
  lanes: Float32Array
  endpoints: Uint32Array
  springs?: Float32Array | null
}
type Phase = 'bounds' | 'tree' | 'charge' | 'links' | 'collide' | 'integrate'

export class Layout {
  alpha: number
  ticks = 0
  revision = 0
  private phase: Phase = 'bounds'
  private cursor = 0
  private extent = 1
  private cellWidth = 1
  private velocity: Float32Array
  private tree: ChargeTree
  private buckets: Int32Array
  private chain: Int32Array
  private coordinates: Int32Array
  private volume: boolean
  constructor(
    public data: LayoutData,
    private mode: Mode,
    private forces: Forces = defaultForces,
    private targets?: Float32Array,
  ) {
    const n = data.n
    this.volume = mode === 'cloud'
    if (this.volume) this.seedDepth()
    this.tree = new ChargeTree(n, this.volume)
    this.velocity = new Float32Array(n * 3)
    this.chain = new Int32Array(n)
    this.coordinates = new Int32Array(n * 3)
    this.buckets = new Int32Array(2 ** Math.ceil(Math.log2(Math.max(8, n * 2))))
    this.alpha = this.forces.blend < 1 && data.fixed.includes(0) ? 1 : 0
    this.sizeCells()
  }
  private sizeCells() {
    const data = this.data
    this.cellWidth = 1
    for (let i = 0; i < data.n; i++)
      this.cellWidth = Math.max(this.cellWidth, 2 * data.positions[4 * i + 3] + 3)
  }
  private seedDepth() {
    for (let i = 0; i < this.data.n; i++) {
      if (!this.data.fixed[i] && this.data.positions[i * 4 + 2] === 0)
        this.data.positions[i * 4 + 2] = cloudDepth(i, this.data.n)
    }
  }
  configure(mode: Mode, update: LayoutUpdate = {}) {
    if (update.lanes) this.data.lanes = update.lanes
    if (update.springs !== undefined) this.data.springs = update.springs
    if (update.forces) this.forces = update.forces
    if (update.targets) this.targets = update.targets
    if (update.radii) {
      for (let i = 0; i < this.data.n; i++) this.data.positions[i * 4 + 3] = update.radii[i]
      this.sizeCells()
    }
    if (this.volume !== (mode === 'cloud')) {
      this.volume = mode === 'cloud'
      this.tree = new ChargeTree(this.data.n, this.volume)
      if (this.volume) this.seedDepth()
    }
    this.mode = mode
    if (this.forces.blend === 1 && this.targets)
      placeOnTargets(this.data.positions, this.data.fixed, this.targets)
    this.reheat()
  }
  pin(i: number, x: number, y: number, fixed: number, z?: number) {
    this.data.positions[i * 4] = x
    this.data.positions[i * 4 + 1] = y
    if (z !== undefined) this.data.positions[i * 4 + 2] = z
    this.data.fixed[i] = fixed
    this.velocity.fill(0, i * 3, i * 3 + 3)
    // A pointer can move several times inside one sliced tick. Continue that tick
    // and keep the neighbours' momentum as the spring endpoint moves.
    this.alpha = this.forces.blend < 1 && this.data.fixed.includes(0) ? Math.max(this.alpha, 0.85) : 0
  }
  private reheat() {
    this.alpha = this.forces.blend < 1 && this.data.fixed.includes(0) ? 1 : 0
    this.phase = 'bounds'
    this.cursor = 0
    this.extent = 1
    this.velocity.fill(0)
  }
  private bucket(x: number, y: number, z: number) {
    return (
      (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) &
      (this.buckets.length - 1)
    )
  }
  private collide(i: number, alpha: number) {
    const p = this.data.positions,
      k = i * 4,
      j = i * 3,
      coords = this.coordinates
    const cx = coords[j],
      cy = coords[j + 1],
      cz = coords[j + 2],
      depth = this.volume ? 1 : 0
    for (let z = cz - depth; z <= cz + depth; z++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          for (let entry = this.buckets[this.bucket(x, y, z)]; entry; entry = this.chain[entry - 1]) {
            const b = entry - 1,
              q = b * 4,
              b3 = b * 3
            if (b <= i || coords[b3] !== x || coords[b3 + 1] !== y || coords[b3 + 2] !== z) continue
            let dx = p[k] - p[q],
              dy = p[k + 1] - p[q + 1]
            const dz = this.volume ? p[k + 2] - p[q + 2] : 0
            const minimum = p[k + 3] + p[q + 3] + 3
            let squared = dx * dx + dy * dy + dz * dz
            if (squared >= minimum * minimum) continue
            if (squared < 1e-8) {
              dx = i & 1 ? -0.01 : 0.01
              dy = b & 1 ? 0.01 : -0.01
              squared = 0.0002
            }
            const force = (minimum / Math.sqrt(squared) - 1) * 0.28 * alpha
            this.velocity[j] += dx * force
            this.velocity[j + 1] += dy * force
            this.velocity[j + 2] += dz * force
            this.velocity[b3] -= dx * force
            this.velocity[b3 + 1] -= dy * force
            this.velocity[b3 + 2] -= dz * force
          }
        }
  }
  // Every O(n) phase, including building the tree and walking links, is resumable.
  advance(ms: number, tickLimit = Infinity) {
    if (!this.alpha) return 0
    const end = performance.now() + ms,
      before = this.ticks
    const { n, positions: p, fixed, endpoints: e, lanes, springs } = this.data,
      v = this.velocity
    const structure = this.mode === 'orbit' ? 0.7 + 0.3 * this.forces.blend ** 2 : this.forces.blend ** 2,
      free = 1 - structure
    do {
      const freeAlpha = this.alpha * free
      const limit = this.phase === 'links' ? e.length / 2 : n
      const stop = Math.min(
        limit,
        this.cursor + (this.phase === 'charge' || this.phase === 'collide' ? 8 : 48),
      )
      for (let i = this.cursor; i < stop; i++) {
        const k = i * 4,
          j = i * 3
        switch (this.phase) {
          case 'bounds':
            this.extent = Math.max(
              this.extent,
              Math.abs(p[k]),
              Math.abs(p[k + 1]),
              this.volume ? Math.abs(p[k + 2]) : 0,
            )
            break
          case 'tree': {
            this.tree.insert(p[k], p[k + 1], this.volume ? p[k + 2] : 0)
            const x = Math.floor(p[k] / this.cellWidth),
              y = Math.floor(p[k + 1] / this.cellWidth)
            const z = this.volume ? Math.floor(p[k + 2] / this.cellWidth) : 0,
              h = this.bucket(x, y, z)
            this.coordinates[j] = x
            this.coordinates[j + 1] = y
            this.coordinates[j + 2] = z
            this.chain[i] = this.buckets[h]
            this.buckets[h] = i + 1
            break
          }
          case 'charge':
            if (!fixed[i]) this.tree.repel(i, p, v, freeAlpha * this.forces.repulsion)
            break
          case 'links': {
            const a = e[i * 2],
              b = e[i * 2 + 1],
              ak = a * 4,
              bk = b * 4
            const dx = p[bk] - p[ak],
              dy = p[bk + 1] - p[ak + 1],
              dz = this.volume ? p[bk + 2] - p[ak + 2] : 0
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
            const rest = springs && springs[i * 2] >= 0 ? springs[i * 2] : this.forces.linkDistance
            const strength = this.forces.springStrength * (springs ? springs[i * 2 + 1] : 1)
            const f = (1 - (rest + p[ak + 3] + p[bk + 3]) / distance) * 0.045 * freeAlpha * strength
            v[a * 3] += dx * f
            v[a * 3 + 1] += dy * f
            v[a * 3 + 2] += dz * f
            v[b * 3] -= dx * f
            v[b * 3 + 1] -= dy * f
            v[b * 3 + 2] -= dz * f
            break
          }
          case 'collide':
            this.collide(i, freeAlpha)
            break
          case 'integrate': {
            if (fixed[i]) {
              v[j] = v[j + 1] = v[j + 2] = 0
              break
            }
            const lane = this.mode === 'lanes'
            const laneX = lane && !this.forces.vertical,
              laneY = lane && this.forces.vertical
            v[j] += ((laneX ? lanes[i] : 0) - p[k]) * (laneX ? 0.12 : 0.009) * freeAlpha
            v[j + 1] += ((laneY ? lanes[i] : 0) - p[k + 1]) * (laneY ? 0.12 : 0.009) * freeAlpha
            if (this.volume) v[j + 2] -= p[k + 2] * 0.009 * freeAlpha
            for (let axis = 0; axis < (this.volume ? 3 : 2); axis++) {
              let limit = 20
              if (this.targets && structure) {
                const delta = this.targets[j + axis] - p[k + axis]
                if (this.mode === 'orbit') limit = Math.max(limit, Math.abs(delta) * 0.25)
                v[j + axis] += delta * structure * 0.22 * this.alpha
              }
              v[j + axis] = Math.max(-limit, Math.min(limit, v[j + axis] * 0.68))
              p[k + axis] += v[j + axis]
            }
            break
          }
        }
      }
      if (this.phase === 'integrate' && stop > this.cursor) this.revision++
      this.cursor = stop
      if (stop === limit) {
        this.cursor = 0
        switch (this.phase) {
          case 'bounds':
            this.tree.reset(this.extent + 1)
            this.buckets.fill(0)
            this.phase = 'tree'
            break
          case 'tree':
            this.phase = 'charge'
            break
          case 'charge':
            this.phase = 'links'
            break
          case 'links':
            this.phase = 'collide'
            break
          case 'collide':
            this.phase = 'integrate'
            break
          case 'integrate':
            this.ticks++
            this.alpha *= 0.87
            if (this.alpha < 0.012) this.alpha = 0
            this.extent = 1
            this.phase = 'bounds'
            break
        }
      }
    } while (this.alpha && this.ticks - before < tickLimit && performance.now() < end)
    return this.ticks - before
  }
}
