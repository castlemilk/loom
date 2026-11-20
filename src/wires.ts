import { createGraph } from './index.js'
import type { GraphLink, GraphNode, GraphOptions, LoomGraph } from './types.js'
import { prepareWireEffects, type WireEffects } from './render/wire-effects.js'
import type { DrawingStyle } from './render/drawing-style.js'

export { defaultWireEffects, wireEffectsSchema, type WireEffects } from './render/wire-effects.js'
export { defaultDrawingStyle, drawingStyleSchema, sketchbook, type DrawingStyle } from './render/drawing-style.js'

export interface WireGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> extends LoomGraph<N, E> {
  getWireEffects(): Readonly<WireEffects>
  setWireEffects(patch: Partial<WireEffects>): void
  getDrawingStyle(): Readonly<DrawingStyle>
  setDrawingStyle(patch: Partial<DrawingStyle>): void
}

/** Create a normal Loom graph with separated connections and optional direction markers. */
export function createWireGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(
  canvas: HTMLCanvasElement,
  options: Omit<GraphOptions<N, E>, 'wireProgram'> & { wireEffects?: Partial<WireEffects>; drawingStyle?: Partial<DrawingStyle> },
): WireGraph<N, E> {
  const effects = prepareWireEffects(options, options.wireEffects, options.drawingStyle)
  const graph = createGraph<N, E>(canvas, { ...options, wireProgram: effects.program })
  return Object.assign(graph, {
    getWireEffects: effects.get,
    setWireEffects(patch: Partial<WireEffects>) { effects.update(patch); graph.invalidate() },
    getDrawingStyle: effects.getDrawing,
    setDrawingStyle(patch: Partial<DrawingStyle>) { effects.setDrawing(patch); graph.invalidate() },
  })
}
