// Bucket coincident particles by mass. They occupy one leaf even for identical inputs.
export class ChargeTree {
  private cells = 0
  private stride: number
  private size: number
  private mass: Uint32Array
  private branch: Uint8Array
  private children: Int32Array
  // Cell centre and half-width, followed by the three first moments.
  private data: Float32Array
  private stack = new Int32Array(192)
  constructor(
    n: number,
    private volume: boolean,
  ) {
    this.stride = volume ? 8 : 4
    this.size = Math.max(32, 2 * n + 8)
    this.mass = new Uint32Array(this.size)
    this.branch = new Uint8Array(this.size)
    this.children = new Int32Array(this.size * this.stride)
    this.data = new Float32Array(this.size * 7)
  }
  reset(half: number) {
    this.mass.fill(0, 0, this.cells + 1)
    this.branch.fill(0, 0, this.cells + 1)
    this.children.fill(0, 0, (this.cells + 1) * this.stride)
    this.cells = 1
    this.data.fill(0, 7, 14)
    this.data[10] = Math.max(1, half)
  }
  private child(cell: number, x: number, y: number, z: number) {
    const k = cell * 7,
      d = this.data
    const octant =
      Number(x >= d[k]) | (Number(y >= d[k + 1]) << 1) | (this.volume && z >= d[k + 2] ? 4 : 0)
    const slot = cell * this.stride + octant
    if (this.children[slot]) return this.children[slot]
    const id = ++this.cells
    if (id === this.size) {
      this.size *= 2
      const m = new Uint32Array(this.size),
        b = new Uint8Array(this.size)
      const c = new Int32Array(this.size * this.stride),
        v = new Float32Array(this.size * 7)
      m.set(this.mass)
      b.set(this.branch)
      c.set(this.children)
      v.set(d)
      this.mass = m
      this.branch = b
      this.children = c
      this.data = v
    }
    const half = d[k + 3] * 0.5,
      j = id * 7,
      target = this.data
    target[j] = d[k] + (octant & 1 ? half : -half)
    target[j + 1] = d[k + 1] + (octant & 2 ? half : -half)
    target[j + 2] = this.volume ? d[k + 2] + (octant & 4 ? half : -half) : 0
    target[j + 3] = half
    target[j + 4] = target[j + 5] = target[j + 6] = 0
    this.children[slot] = id
    return id
  }
  insert(x: number, y: number, z: number) {
    let cell = 1
    for (let level = 0; ; level++) {
      const k = cell * 7,
        count = this.mass[cell]
      if (count && !this.branch[cell] && level < 24) {
        const sx = this.data[k + 4],
          sy = this.data[k + 5],
          sz = this.data[k + 6]
        const ox = sx / count,
          oy = sy / count,
          oz = sz / count
        if (Math.abs(x - ox) + Math.abs(y - oy) + Math.abs(z - oz) > 0.0001) {
          const old = this.child(cell, ox, oy, oz)
          this.mass[old] = count
          this.data[old * 7 + 4] = sx
          this.data[old * 7 + 5] = sy
          this.data[old * 7 + 6] = sz
          this.branch[cell] = 1
        }
      }
      this.mass[cell]++
      this.data[k + 4] += x
      this.data[k + 5] += y
      this.data[k + 6] += z
      if (!this.branch[cell]) return
      cell = this.child(cell, x, y, z)
    }
  }
  repel(i: number, p: Float32Array, v: Float32Array, alpha: number) {
    const k = i * 4,
      x = p[k],
      y = p[k + 1],
      z = this.volume ? p[k + 2] : 0
    const d = this.data,
      stack = this.stack
    let top = 1,
      fx = 0,
      fy = 0,
      fz = 0
    stack[0] = 1
    while (top) {
      const cell = stack[--top],
        j = cell * 7,
        m = this.mass[cell]
      const dx = x - d[j + 4] / m,
        dy = y - d[j + 5] / m,
        dz = z - d[j + 6] / m
      const distance = dx * dx + dy * dy + dz * dz
      if (this.branch[cell] && d[j + 3] * d[j + 3] * 7 > distance) {
        for (let c = 0; c < this.stride; c++) {
          const child = this.children[cell * this.stride + c]
          if (child) stack[top++] = child
        }
      } else {
        const f = m / (distance + 42)
        fx += dx * f
        fy += dy * f
        fz += dz * f
      }
    }
    const gain = alpha * 19,
      j = i * 3
    v[j] += fx * gain
    v[j + 1] += fy * gain
    v[j + 2] += fz * gain
  }
}
