import { blueprint, ink, knowledgeConsole, parchment } from '../../dist/index.js'
import { defaultDrawingStyle, sketchbook } from '../../dist/wires.js'

export const palettes = { console: knowledgeConsole, ink, parchment, blueprint, sketchbook }
export const papers = {
  ivory: { bg: '#fbf8ee', ink: '#30342e', dim: '#727264', accent: '#873e28' },
  white: { bg: '#ffffff', ink: '#292e33', dim: '#6a7177', accent: '#735050' },
  mist: { bg: '#e9f0ed', ink: '#263a37', dim: '#61766e', accent: '#33695d' },
  slate: { bg: '#263135', ink: '#f0f2e8', dim: '#aeb8b5', accent: '#f6c58a' },
}
export const kindOrder = ['study', 'concept', 'tag', 'blog', 'lab', 'category']
export const patterns = [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]
export const shapes = [['circle', 'Disc'], ['ring', 'Ring'], ['square', 'Square'], ['rounded-square', 'Rounded square']]

export function preset(name) {
  const base = palettes[name]
  return {
    name, nodeScale: base.nodes?.scale ?? 1, artwork: base.nodes?.artwork !== false,
    paper: 'theme', ringWidth: base.nodes?.ringWidth ?? 1.3,
    drawing: name === 'sketchbook' ? { ...defaultDrawingStyle, fill: 'hachure', roughness: 1 } : defaultDrawingStyle,
    route: base.wires?.routing ?? 'arc', opacity: base.wires?.opacity ?? 0.45, pattern: 'solid',
    labels: base.labels?.visibility ?? 'auto', alternateSide: base.labels?.alternateSide ?? false, grid: !!base.grid, nodes: {}, wires: {},
  }
}

export function makeTheme(style) {
  const base = palettes[style.name], wires = base.wires ?? {}, byKind = Object.create(null)
  const paper = papers[style.paper]
  const nodeKinds = Object.assign(Object.create(null), base.nodes?.byKind)
  for (const [kind, rule] of Object.entries(style.nodes)) nodeKinds[kind] = { ...nodeKinds[kind], ...rule }
  for (const [kind, rule] of Object.entries(wires.byKind ?? {})) {
    byKind[kind] = rule.opacity === undefined ? rule :
      { ...rule, opacity: Math.min(1, style.opacity * rule.opacity / (wires.opacity || 1)) }
  }
  for (const [kind, rule] of Object.entries(style.wires)) byKind[kind] = { ...byKind[kind], ...rule }
  return {
    ...base, ...(paper && { ...paper, bezel: paper.bg }),
    nodes: { ...base.nodes, scale: style.nodeScale, artwork: style.artwork, ringWidth: style.ringWidth, fill: style.fill ?? base.nodes?.fill,
      byKind: nodeKinds },
    wires: { ...wires, ...(paper && { color: paper.dim }), byKind, routing: style.route, opacity: style.opacity, pattern: style.pattern },
    labels: { ...base.labels, visibility: style.labels, alternateSide: style.alternateSide },
    grid: style.grid ? (base.grid ?? { spacing: 32, opacity: 0.18 }) : undefined,
  }
}

export function marker(theme, kind) {
  const rule = Object.hasOwn(theme.nodes.byKind, kind) ? theme.nodes.byKind[kind] : undefined
  return {
    color: rule?.color ?? (Object.hasOwn(theme.kind, kind) ? theme.kind[kind] : theme.accent),
    shape: rule?.shape ?? (['concept', 'tag', 'category'].includes(kind) ? 'circle' : 'rounded-square'),
  }
}
