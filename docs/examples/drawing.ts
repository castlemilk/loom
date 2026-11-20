import type { GraphData } from 'loom-core'
import { createWireGraph, sketchbook } from 'loom-core/wires'

export function drawConnections(canvas: HTMLCanvasElement, data: GraphData) {
  const graph = createWireGraph(canvas, {
    ...data,
    theme: sketchbook,
    drawingStyle: { fill: 'hachure', roughness: 0.7, hatchSpacing: 5 },
    wireEffects: { direction: 'arrow', separation: 16 },
  })

  graph.on('select', id => {
    graph.setWireEffects({ direction: id ? 'flow' : 'arrow', scope: 'selected' })
  })
  return graph
}
