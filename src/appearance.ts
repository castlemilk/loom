import type { GraphData, Theme, WireStyle } from './types.js'
import { rgb } from './theme.js'
import { range } from './constraints.js'

const shapes = { 'rounded-square': 0, square: 64, ring: 192, circle: 255 }
const patterns = ['solid', 'dashed', 'dotted'] as const
function line(rule: WireStyle) {
  if (rule.color !== undefined) rgb(rule.color)
  if (rule.opacity !== undefined) range(rule.opacity, 0, 1, 'wire opacity')
  if (rule.width !== undefined) range(rule.width, 0, 64, 'wire width')
  if (rule.pattern !== undefined && !patterns.includes(rule.pattern)) throw new RangeError('Invalid wire pattern')
}
// Width occupies [0,64]. The unused high bits carry the pattern in the same GPU attribute.
const packStroke = (width: number, pattern: WireStyle['pattern']) => width + 128 * patterns.indexOf(pattern ?? 'solid')
export function appearance(data: GraphData, degree: Uint32Array, theme: Theme) {
  for (const color of [
    theme.bg,
    theme.bezel,
    theme.ink,
    theme.accent,
    theme.dim,
    ...Object.values(theme.kind),
  ])
    rgb(color)
  range(theme.fontSize, 0.1, 96, 'font size')
  range(theme.radii.hub, 0, 1e6, 'hub radius')
  range(theme.radii.content, 0, 1e6, 'content radius')
  range(theme.plateAlpha, 0, 1, 'label halo')
  if (theme.grid) {
    range(theme.grid.spacing ?? 32, 1, 1e6, 'grid spacing')
    range(theme.grid.opacity ?? 0.2, 0, 1, 'grid opacity')
    if (theme.grid.color !== undefined) rgb(theme.grid.color)
  }
  const nodes = theme.nodes,
    wires = theme.wires ?? {},
    labels = theme.labels
  const scale = range(nodes?.scale ?? 1, 0.01, 100, 'node scale')
  range(nodes?.ringWidth ?? 1.3, 0, 64, 'ring width')
  range(nodes?.fill ?? 0.38, 0, 1, 'node fill')
  range(wires.hotWidth ?? 2.3, 0, 64, 'highlight width')
  range(labels?.density ?? 1, 0, 8, 'label density')
  if (labels?.visibility && !['auto', 'focus', 'none'].includes(labels.visibility))
    throw new RangeError('Invalid label visibility')
  if (wires.routing && !['arc', 'patch', 'straight'].includes(wires.routing))
    throw new RangeError('Invalid wire routing')
  line(wires)
  for (const rule of Object.values(wires.byKind ?? {})) line(rule)
  for (const rule of Object.values(nodes?.byKind ?? {})) {
    if (rule.shape !== undefined && !Object.hasOwn(shapes, rule.shape))
      throw new RangeError('Invalid node shape')
    if (rule.radius !== undefined) range(rule.radius, 0, 1e6, 'node radius')
    if (rule.color !== undefined) rgb(rule.color)
  }
  const style = new Uint8Array(data.nodes.length * 4),
    radii = new Float32Array(data.nodes.length)
  const palette = new Map<string, { color: number[]; shape: number; radius?: number; hub: boolean }>()
  for (let i = 0; i < data.nodes.length; i++) {
    const kind = data.nodes[i].kind ?? ''
    let mark = palette.get(kind)
    if (!mark) {
      const hub = ['concept', 'tag', 'category', ''].includes(kind)
      const rule = nodes?.byKind && Object.hasOwn(nodes.byKind, kind) ? nodes.byKind[kind] : undefined
      const color = rule?.color ?? (Object.hasOwn(theme.kind, kind) ? theme.kind[kind] : theme.accent)
      mark = {
        color: rgb(color),
        shape: shapes[rule?.shape ?? (hub ? 'circle' : 'rounded-square')],
        radius: rule?.radius,
        hub,
      }
      palette.set(kind, mark)
    }
    const custom = nodes?.resolve?.(data.nodes[i], degree[i])
    const shape = custom?.shape
    if (shape !== undefined && !Object.hasOwn(shapes, shape)) throw new RangeError('Invalid node shape')
    if (custom?.radius !== undefined) range(custom.radius, 0, 1e6, 'node radius')
    style.set(custom?.color !== undefined ? rgb(custom.color) : mark.color, i * 4)
    style[i * 4 + 3] = shape === undefined ? mark.shape : shapes[shape]
    radii[i] =
      scale *
      (custom?.radius ??
        mark.radius ??
        (mark.hub ? theme.radii.hub : theme.radii.content) +
          Math.min(mark.hub ? 8 : 5, Math.sqrt(degree[i])))
  }
  // Quiet edge styles are optional. The common case has no per-edge style storage.
  let wireColors: Uint8Array | undefined, wireWidths: Float32Array | undefined
  if (wires.resolve || (wires.byKind && Object.keys(wires.byKind).length)) {
    const density = wires.opacity ?? wireOpacity(data.nodes.length)
    const cache = new Map<string, { color: number[]; width: number; pattern: WireStyle['pattern'] }>()
    wireColors = new Uint8Array(data.links.length * 4)
    wireWidths = new Float32Array(data.links.length)
    for (let i = 0; i < data.links.length; i++) {
      const kind = data.links[i].kind ?? ''
      let value = cache.get(kind)
      if (!value) {
        const rule = wires.byKind && Object.hasOwn(wires.byKind, kind) ? wires.byKind[kind] : undefined
        value = {
          color: [
            ...rgb(rule?.color ?? wires.color ?? theme.dim),
            Math.round((rule?.opacity ?? density) * 255),
          ],
          width: rule?.width ?? wires.width ?? 1.3,
          pattern: rule?.pattern ?? wires.pattern,
        }
        cache.set(kind, value)
      }
      wireColors.set(value.color, i * 4)
      const custom = wires.resolve?.(data.links[i], i)
      if (custom) {
        line(custom)
        if (custom.color !== undefined) wireColors.set(rgb(custom.color), i * 4)
        if (custom.opacity !== undefined) wireColors[i * 4 + 3] = Math.round(custom.opacity * 255)
      }
      wireWidths[i] = packStroke(custom?.width ?? value.width, custom?.pattern ?? value.pattern)
    }
  }
  return { style, radii, wireColors, wireWidths, stroke: packStroke(wires.width ?? 1.3, wires.pattern) }
}
export function wireOpacity(count: number) {
  return Math.max(0.1, Math.min(0.58, 16 / Math.sqrt(Math.max(1, count))))
}
