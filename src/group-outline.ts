// Intersect twelve supporting lines of the projected node discs. Offset the resulting
// convex polygon with circular corners. Cost is linear in enabled memberships.
const normals = Array.from({ length: 12 }, (_, i) => {
  const angle = i * Math.PI / 6
  return [Math.cos(angle), Math.sin(angle)] as const
})
export function groupOutline(points: Readonly<Float32Array>, members: readonly number[], padding: number): string {
  if (!members.length) return ''
  const support = Array<number>(normals.length).fill(-Infinity)
  for (const index of members) {
    const k = index * 4, x = points[k], y = points[k + 1], radius = points[k + 2]
    for (let i = 0; i < normals.length; i++) {
      const [nx, ny] = normals[i]
      support[i] = Math.max(support[i], x * nx + y * ny + radius)
    }
  }
  const xy = (x: number, y: number) => x.toFixed(1) + ' ' + y.toFixed(1)
  let path = ''
  for (let i = 0; i < normals.length; i++) {
    const j = (i + 1) % normals.length
    const [ax, ay] = normals[i], [bx, by] = normals[j]
    const determinant = ax * by - ay * bx
    const x = (support[i] * by - support[j] * ay) / determinant
    const y = (ax * support[j] - bx * support[i]) / determinant
    path += (i ? 'L' : 'M') + xy(x + ax * padding, y + ay * padding)
    if (padding) path += 'A' + padding + ' ' + padding + ' 0 0 1 ' + xy(x + bx * padding, y + by * padding)
  }
  return path + 'Z'
}

// Oriented marching-squares edge pairs: top, right, bottom, left. Diagonally
// touching samples belong to separate islands. Each crossing has one successor.
const contours = [[], [0,3], [1,0], [1,3], [2,1], [0,3,2,1], [2,0], [2,3],
  [3,2], [0,2], [1,0,3,2], [1,2], [3,1], [0,1], [3,0], []]

/** Contour the union of padded projected discs, retaining holes and disconnected islands. */
export function cloudOutline(points: Readonly<Float32Array>, members: readonly number[], padding: number): string {
  if (!members.length) return ''
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const i of members) {
    const offset = 4 * i, x = points[offset], y = points[offset + 1], r = points[offset + 2] + padding
    left = Math.min(left, x - r); top = Math.min(top, y - r)
    right = Math.max(right, x + r); bottom = Math.max(bottom, y + r)
  }
  if (members.length === 1) {
    const radius = (right - left) / 2, y = (top + bottom) / 2
    return 'M' + left + ' ' + y + 'a' + radius + ' ' + radius + ' 0 1 1 ' + 2 * radius + ' 0a' + radius + ' ' + radius + ' 0 1 1 ' + -2 * radius + ' 0Z'
  }
  const step = Math.max(2, (right - left) / 72, (bottom - top) / 72)
  const cols = Math.ceil((right - left) / step) + 6, rows = Math.ceil((bottom - top) / step) + 6
  left -= step * 2
  top -= step * 2
  const grid = new Int32Array(cols * rows)
  // Add whole scanline intervals. A dense group never does one loop per covered pixel per node.
  for (const i of members) {
    const k = 4 * i, x = (points[k] - left) / step, y = (points[k + 1] - top) / step
    const r = (points[k + 2] + padding) / step + 0.75
    for (let row = Math.ceil(y - r); row <= y + r; row++) {
      const dx = Math.sqrt(Math.max(0, r * r - (row - y) ** 2))
      const begin = Math.ceil(x - dx), end = Math.floor(x + dx) + 1
      grid[row * cols + begin]++
      grid[row * cols + end]--
    }
  }
  for (let y = 0; y < rows; y++) {
    let count = 0
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      count += grid[i]
      grid[i] = Number(count > 0)
    }
  }
  const stride = 2 * cols, next = new Map<number, number>()
  for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
    const i = y * cols + x, mask = grid[i] | grid[i + 1] << 1 | grid[i + cols + 1] << 2 | grid[i + cols] << 3
    if (!mask || mask === 15) continue
    const v = 2 * y * stride + 2 * x, edges = [v + 1, v + stride + 2, v + 2 * stride + 1, v + stride]
    const pairs = contours[mask]
    for (let j = 0; j < pairs.length; j += 2) next.set(edges[pairs[j]], edges[pairs[j + 1]])
  }
  const xy = (x: number, y: number) => (left + x * step / 2).toFixed(1) + ' ' + (top + y * step / 2).toFixed(1)
  let path = ''
  for (const first of next.keys()) {
    let a = first, b = next.get(a)!
    const midpoint = (a: number, b: number) => xy(((a % stride) + (b % stride)) / 2, ((a / stride | 0) + (b / stride | 0)) / 2)
    path += 'M' + midpoint(a, b)
    do {
      const c = next.get(b)!
      if (b - a !== c - b) path += 'L' + midpoint(a, b) + 'Q' + xy(b % stride, b / stride | 0) + ' ' + midpoint(b, c)
      next.delete(b)
      a = b; b = c
    } while (a !== first)
    path += 'Z'
  }
  return path
}
