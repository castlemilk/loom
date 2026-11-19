import { createGraph, fromConsole, knowledgeConsole } from './index.js'
import type { GraphData, GraphLink, GraphNode, GraphOptions, LayoutOptions, Theme } from './types.js'
export { fromConsole }

export const consoleLayout: LayoutOptions = {
  blend: 0.25,
  laneGap: 210,
  rowGap: 46,
  guides: false,
  linkDistance: 46,
  springsByKind: { concept: { strength: 1.55 }, category: { distance: 70 } },
}

// Custom properties inherit from the console screen. Resolve its CSS paint values
// once when the host applies a theme, including named colours and rgb() values.
export function readConsoleTheme(element: Element): Theme {
  const css = getComputedStyle(element)
  let ctx: CanvasRenderingContext2D | null = null
  function token(key: string, fallback: string) {
    const value = css.getPropertyValue('--kg-' + key).trim()
    if (!value) return fallback
    if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return value
    if (!CSS.supports('color', value)) return fallback
    ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  }
  const kind = Object.fromEntries(
    Object.entries(knowledgeConsole.kind).map(([k, c]) => [k, token(k, c)]),
  )
  const ink = token('ink', knowledgeConsole.ink)
  return {
    ...knowledgeConsole,
    kind,
    ink,
    dim: token('dim', knowledgeConsole.dim),
    accent: kind.concept,
    wires: {
      ...knowledgeConsole.wires,
      color: ink,
      byKind: {
        ...knowledgeConsole.wires?.byKind,
        concept: { ...knowledgeConsole.wires?.byKind?.concept, color: kind.concept },
      },
    },
  }
}

export function mountConsoleGraph<N extends GraphNode, E extends GraphLink, Legacy>(
  canvas: HTMLCanvasElement,
  graph: { nodes: readonly N[]; edges: readonly E[] },
  enabled: boolean,
  legacy: (canvas: HTMLCanvasElement, graph: { nodes: readonly N[]; edges: readonly E[] }) => Legacy,
  options: Omit<GraphOptions, keyof GraphData> = {},
) {
  if (!enabled) return legacy(canvas, graph)
  return createGraph(canvas, {
    ...options,
    ...fromConsole(graph),
    theme: options.theme ?? readConsoleTheme(canvas),
    layout: { ...consoleLayout, ...options.layout },
  })
}
