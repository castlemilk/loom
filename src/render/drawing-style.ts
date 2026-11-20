import type { Theme } from '../types.js'
import { parchment } from '../theme.js'

export interface DrawingStyle {
  fill: 'solid' | 'hachure' | 'cross-hatch'
  /** Zero uses exact geometry. Higher values perturb outlines and wire handles. */
  roughness: number
  /** Perpendicular distance between hatch lines, in CSS pixels. */
  hatchSpacing: number
}

export const defaultDrawingStyle: Readonly<DrawingStyle> = Object.freeze({ fill: 'solid', roughness: 0, hatchSpacing: 5 })
const fills = Object.freeze(['solid', 'hachure', 'cross-hatch'] as const)
export const drawingStyleSchema = {
  type: 'object', additionalProperties: false, properties: {
    fill: { type: 'string', enum: fills, default: defaultDrawingStyle.fill },
    roughness: { type: 'number', minimum: 0, maximum: 2, default: defaultDrawingStyle.roughness },
    hatchSpacing: { type: 'number', minimum: 2, maximum: 16, default: defaultDrawingStyle.hatchSpacing },
  },
} as const
for (const field of Object.values(drawingStyleSchema.properties)) Object.freeze(field)
Object.freeze(drawingStyleSchema.properties)
Object.freeze(drawingStyleSchema)

export function drawingSettings(base: DrawingStyle, patch: Partial<DrawingStyle>) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some((k) => !Object.hasOwn(defaultDrawingStyle, k)))
    throw new TypeError('Expected drawing style settings.')
  const next = { ...base, ...patch }
  if (!fills.includes(next.fill)) throw new RangeError('Unknown marker fill style.')
  for (const key of ['roughness', 'hatchSpacing'] as const) {
    const { minimum, maximum } = drawingStyleSchema.properties[key]
    if (!Number.isFinite(next[key]) || next[key] < minimum || next[key] > maximum) throw new RangeError('Invalid ' + key)
  }
  return Object.freeze(next)
}

export const sketchbook: Theme = {
  ...parchment, bg: '#fbf8ee', bezel: '#fbf8ee', ink: '#30342e', dim: '#6d706a', accent: '#873e28',
  font: 'Georgia, serif', fontSize: 14, radii: { hub: 8, content: 7 },
  nodes: { fill: 0.88, ringWidth: 1.6 }, wires: { routing: 'straight', width: 1.25, opacity: 0.38 },
  labels: { alternateSide: true }, grid: { spacing: 24, color: '#777461', opacity: 0.18 },
}
