import { blueprint, ink, knowledgeConsole, parchment } from '../../dist/index.js'

export const palettes = { console: knowledgeConsole, ink, parchment, blueprint }
export const kindOrder = ['study', 'concept', 'tag', 'blog', 'lab', 'category']

export function preset(name) {
  const base = palettes[name]
  return {
    name, nodeScale: base.nodes?.scale ?? 1, artwork: base.nodes?.artwork !== false,
    route: base.wires?.routing ?? 'arc', opacity: base.wires?.opacity ?? 0.45,
    labels: base.labels?.visibility ?? 'auto', grid: !!base.grid, nodes: {}, wires: {},
  }
}

export function makeTheme(style) {
  const base = palettes[style.name], wires = base.wires ?? {}, byKind = {}
  for (const [kind, rule] of Object.entries(wires.byKind ?? {})) {
    byKind[kind] = rule.opacity === undefined ? rule :
      { ...rule, opacity: Math.min(1, style.opacity * rule.opacity / (wires.opacity || 1)) }
  }
  for (const [kind, rule] of Object.entries(style.wires)) byKind[kind] = { ...byKind[kind], ...rule }
  return {
    ...base,
    nodes: { ...base.nodes, scale: style.nodeScale, artwork: style.artwork, byKind: { ...base.nodes?.byKind, ...style.nodes } },
    wires: { ...wires, byKind, routing: style.route, opacity: style.opacity },
    labels: { ...base.labels, visibility: style.labels },
    grid: style.grid ? (base.grid ?? { spacing: 32, opacity: 0.18 }) : undefined,
  }
}

export function marker(theme, kind) {
  const rule = theme.nodes.byKind[kind]
  return {
    color: rule?.color ?? theme.kind[kind] ?? theme.accent,
    shape: rule?.shape ?? (['concept', 'tag', 'category'].includes(kind) ? 'circle' : 'rounded-square'),
  }
}
