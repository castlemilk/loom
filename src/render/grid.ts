import type { Camera } from '../camera.js'

export class PickGrid {
  projected: Float32Array
  #next: Int32Array
  #heads = new Int32Array(0)
  #cols = 0
  #rows = 0
  #reach = 0
  constructor(n: number) {
    this.projected = new Float32Array(n * 4)
    this.#next = new Int32Array(n)
  }
  rebuild(p: Float32Array, camera: Camera) {
    const cols = Math.max(1, Math.ceil(camera.width / 32)),
      rows = Math.max(1, Math.ceil(camera.height / 32))
    if (cols !== this.#cols || rows !== this.#rows) {
      this.#heads = new Int32Array(cols * rows)
      this.#cols = cols
      this.#rows = rows
    } else this.#heads.fill(0)
    this.#reach = 0
    const b = camera.basis(),
      out = this.projected
    for (let i = 0; i < this.#next.length; i++) {
      const k = i * 4
      camera.project(p[k], p[k + 1], p[k + 2], out, k, b)
      const r = (out[k + 2] = Math.max(1.3, out[k + 2] * p[k + 3]))
      const x = out[k],
        y = out[k + 1]
      if (x + r < 0 || y + r < 0 || x - r > camera.width || y - r > camera.height) continue
      const col = Math.max(0, Math.min(cols - 1, x >> 5)),
        row = Math.max(0, Math.min(rows - 1, y >> 5))
      const slot = row * cols + col
      this.#next[i] = this.#heads[slot]
      this.#heads[slot] = i + 1
      this.#reach = Math.max(this.#reach, r)
    }
  }
  pick(x: number, y: number, volume = false, padding = 5) {
    const p = this.projected,
      reach = this.#reach + padding
    let best = -1,
      near = Infinity,
      front = -Infinity
    const x0 = Math.max(0, Math.floor((x - reach) / 32)),
      x1 = Math.min(this.#cols - 1, Math.floor((x + reach) / 32))
    const y0 = Math.max(0, Math.floor((y - reach) / 32)),
      y1 = Math.min(this.#rows - 1, Math.floor((y + reach) / 32))
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        for (let e = this.#heads[cy * this.#cols + cx]; e; e = this.#next[e - 1]) {
          const i = e - 1,
            k = i * 4,
            dx = x - p[k],
            dy = y - p[k + 1],
            d = dx * dx + dy * dy
          if (d > (p[k + 2] + padding) ** 2) continue
          if ((volume && p[k + 3] > front) || ((!volume || p[k + 3] === front) && d < near)) {
            near = d
            best = i
            front = p[k + 3]
          }
        }
      }
    return best
  }
}
export class LabelGrid {
  #bins = new Map<number, number[]>()
  #boxes: number[] = []
  clear() {
    this.#bins.clear()
    this.#boxes.length = 0
  }
  pick(x: number, y: number) {
    const bucket = this.#bins.get(Math.floor(y / 32) * 65536 + Math.floor(x / 64))
    for (const b of bucket ?? []) {
      const box = this.#boxes
      if (x >= box[b] && y >= box[b + 1] && x <= box[b + 2] && y <= box[b + 3]) return box[b + 4]
    }
    return -1
  }
  place(x: number, y: number, width: number, height: number, owner = -1) {
    const right = x + width,
      bottom = y + height
    const x0 = Math.floor(x / 64),
      x1 = Math.floor(right / 64)
    const y0 = Math.floor(y / 32),
      y1 = Math.floor(bottom / 32)
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.#bins.get(cy * 65536 + cx)
        if (!bucket) continue
        for (const b of bucket)
          if (
            x < this.#boxes[b + 2] &&
            right > this.#boxes[b] &&
            y < this.#boxes[b + 3] &&
            bottom > this.#boxes[b + 1]
          )
            return false
      }
    const index = this.#boxes.length
    this.#boxes.push(x, y, right, bottom, owner)
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const key = cy * 65536 + cx,
          bucket = this.#bins.get(key)
        if (bucket) bucket.push(index)
        else this.#bins.set(key, [index])
      }
    return true
  }
}
