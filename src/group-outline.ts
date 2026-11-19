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
