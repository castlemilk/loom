import { createGraph } from './index.js'
import type { GraphLink, GraphNode, GraphOptions, LoomGraph } from './types.js'
import { prepareWireEffects, type WireEffects } from './render/wire-effects.js'

export { defaultWireEffects, wireEffectsSchema, type WireEffects } from './render/wire-effects.js'

export interface WireGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> extends LoomGraph<N, E> {
  getWireEffects(): Readonly<WireEffects>
  setWireEffects(patch: Partial<WireEffects>): void
}

/** Create a normal Loom graph with separated connections and optional direction markers. */
export function createWireGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(
  canvas: HTMLCanvasElement,
  options: Omit<GraphOptions<N, E>, 'wireProgram'> & { wireEffects?: Partial<WireEffects> },
): WireGraph<N, E> {
  const effects = prepareWireEffects(options, options.wireEffects)
  const graph = createGraph<N, E>(canvas, { ...options, wireProgram: effects.program })
  return Object.assign(graph, {
    getWireEffects: effects.get,
    setWireEffects(patch: Partial<WireEffects>) { effects.update(patch); graph.invalidate() },
  })
}
