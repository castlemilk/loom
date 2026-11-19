import type { GraphNode, LayoutOptions } from '../types.js'

// Independent low-discrepancy sequences distribute angle, latitude and radius
// throughout a ball. The cube root gives a uniform distribution by volume.
export function cloudTargets(nodes: readonly GraphNode[], options: LayoutOptions) {
  const targets = new Float32Array(nodes.length * 3)
  const extent = 30 * Math.cbrt(nodes.length)
  nodes.forEach((node, i) => {
    const k = i + 0.5, angle = k * 2.3999632297
    const latitude = 2 * ((k * 0.7548776662) % 1) - 1
    const radius = extent * Math.cbrt((k * 0.569840291) % 1)
    const across = radius * Math.sqrt(1 - latitude * latitude)
    const anchor = options.anchor?.(node, i)
    const x = anchor?.x ?? node.x ?? across * Math.cos(angle)
    const y = anchor?.y ?? node.y ?? across * Math.sin(angle)
    const z = anchor ? anchor.z ?? 0 : node.z ?? radius * latitude * (options.cloudDepth ?? 1)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new RangeError('Invalid cloud target for ' + node.id)
    const offset = i * 3
    targets[offset] = x
    targets[offset + 1] = y
    targets[offset + 2] = z
  })
  return targets
}
