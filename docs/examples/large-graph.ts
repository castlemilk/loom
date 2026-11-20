import { createGraph, parchment, type GraphData } from 'loom-core'

export function mountOverview(canvas: HTMLCanvasElement, data: GraphData, workerURL: URL) {
  return createGraph(canvas, {
    ...data,
    sim: 'worker',
    workerURL,
    layout: { autoRotate: false },
    theme: {
      ...parchment,
      labels: { visibility: 'focus' },
      nodes: { ...parchment.nodes, artwork: false },
    },
  })
}
