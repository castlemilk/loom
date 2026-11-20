import type { Mode } from './types.js'

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
export class Camera {
  x = 0
  y = 0
  z = 0
  zoom = 1
  tx = 0
  ty = 0
  tz = 0
  targetZoom = 1
  yaw = 0.48
  pitch = -0.26
  width = 1
  height = 1
  constructor(public mode: Mode) {}
  get focal() {
    return Math.min(this.width, this.height) * 1.1
  }
  resetAngle() { this.yaw = 0.48; this.pitch = -0.26 }
  // These four values are also supplied to the WebGL projection.
  basis() {
    const cloud = this.mode === 'cloud'
    return [
      cloud ? Math.cos(this.yaw) : 1,
      cloud ? Math.sin(this.yaw) : 0,
      cloud ? Math.cos(this.pitch) : 1,
      cloud ? Math.sin(this.pitch) : 0,
    ]
  }
  project(x: number, y: number, z: number, out: Float32Array, offset: number, b: number[]) {
    x -= this.x
    y -= this.y
    z = this.mode === 'cloud' ? z - this.z : 0
    const rx = b[0] * x + b[1] * z,
      rz = -b[1] * x + b[0] * z
    const ry = b[2] * y - b[3] * rz,
      depth = b[3] * y + b[2] * rz
    const scale = this.zoom / Math.max(0.25, 1 - (depth * this.zoom) / this.focal)
    out[offset] = this.width * 0.5 + rx * scale
    out[offset + 1] = this.height * 0.5 + ry * scale
    out[offset + 2] = scale
    out[offset + 3] = depth
  }
  // Invert project() on the camera-facing plane through the grabbed node.
  unproject(screenX: number, screenY: number, depth: number): [number, number, number] {
    const [cy, sy, cp, sp] = this.basis()
    const inverseScale = Math.max(0.25, 1 - (depth * this.zoom) / this.focal) / this.zoom
    const rx = (screenX - this.width / 2) * inverseScale,
      ry = (screenY - this.height / 2) * inverseScale
    const rz = cp * depth - sp * ry
    return [this.x + cy * rx - sy * rz, this.y + cp * ry + sp * depth, this.z + sy * rx + cy * rz]
  }
  pan(dx: number, dy: number) {
    const [cy, sy, cp, sp] = this.basis()
    this.tx -= (dx * cy + dy * sp * sy) / this.targetZoom
    this.ty -= (dy * cp) / this.targetZoom
    this.tz -= (dx * sy - dy * sp * cy) / this.targetZoom
  }
  rotate(dx: number, dy: number) {
    this.yaw += dx * 0.006
    this.pitch = clamp(this.pitch + dy * 0.006, -1.45, 1.45)
  }
  zoomAt(x: number, y: number, factor: number) {
    const old = this.targetZoom
    this.targetZoom = clamp(old * factor, 0.015, 32)
    this.pan(
      (x - this.width / 2) * (1 - this.targetZoom / old),
      (y - this.height / 2) * (1 - this.targetZoom / old),
    )
  }
  fit(p: Float32Array, n: number, immediate?: boolean) {
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity
    for (let i = 0; i < n * 4; i += 4) {
      const x = p[i],
        y = p[i + 1],
        z = p[i + 2],
        r = p[i + 3]
      x0 = Math.min(x0, x - r)
      x1 = Math.max(x1, x + r)
      y0 = Math.min(y0, y - r)
      y1 = Math.max(y1, y + r)
      z0 = Math.min(z0, z - r)
      z1 = Math.max(z1, z + r)
    }
    this.tx = n ? (x0 + x1) / 2 : 0
    this.ty = n ? (y0 + y1) / 2 : 0
    this.tz = n ? (z0 + z1) / 2 : 0
    const cloud = this.mode === 'cloud'
    let span = 0
    if (cloud) {
      for (let i = 0; i < n * 4; i += 4)
        span = Math.max(span, Math.hypot(p[i] - this.tx, p[i + 1] - this.ty, p[i + 2] - this.tz) + p[i + 3])
      // A bounding sphere stays inside the perspective frustum at every orientation.
      span *= 2 * Math.hypot(1, 0.44 * Math.min(this.width, this.height) / this.focal)
    }
    this.targetZoom = n
      ? clamp(
          0.88 *
            Math.min(
              this.width / Math.max(1, cloud ? span : x1 - x0),
              this.height / Math.max(1, cloud ? span : y1 - y0),
            ),
          0.015,
          3,
        )
      : 1
    if (immediate) this.step(true)
  }
  step(immediate = false) {
    let moving = false
    // Interpolate inverse zoom with the same coefficient as the camera origin.
    // That keeps the world point under the cursor fixed throughout an eased zoom.
    for (const [key, goal] of [
      ['x', this.tx],
      ['y', this.ty],
      ['z', this.tz],
    ] as const) {
      const d = goal - this[key]
      if (immediate || Math.abs(d) < 0.02 / this.targetZoom) this[key] = goal
      else {
        this[key] += d * 0.25
        moving = true
      }
    }
    if (immediate || Math.abs(this.zoom - this.targetZoom) < this.targetZoom * 0.0002)
      this.zoom = this.targetZoom
    else {
      this.zoom = 1 / (0.75 / this.zoom + 0.25 / this.targetZoom)
      moving = true
    }
    return moving
  }
}
