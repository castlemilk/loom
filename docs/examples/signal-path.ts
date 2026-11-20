import { createGraph, parchment, type GraphData } from 'loom-core'

export const signalPath: GraphData = {
  nodes: [
    { id: 'osc', label: 'Oscillator', kind: 'source' },
    { id: 'noise', label: 'Noise', kind: 'source' },
    { id: 'mixer', label: 'Mixer', kind: 'mix' },
    { id: 'filter', label: 'Filter', kind: 'tone' },
    { id: 'amp', label: 'Amplifier', kind: 'output' },
  ],
  links: [
    { source: 'osc', target: 'mixer' },
    { source: 'noise', target: 'mixer' },
    { source: 'mixer', target: 'filter' },
    { source: 'filter', target: 'amp' },
  ],
}

export function mountSignalPath(canvas: HTMLCanvasElement) {
  const graph = createGraph(canvas, {
    ...signalPath,
    theme: {
      ...parchment,
      labels: { alternateSide: true },
      kind: { source: '#976343', mix: '#436653', tone: '#5d7190', output: '#a94c32' },
      wires: { routing: 'straight', width: 1.5, opacity: 0.65 },
    },
    mode: 'lanes',
    layout: { blend: 1, laneOrder: ['source', 'mix', 'tone', 'output'], laneGap: 70, rowGap: 56 },
  })
  graph.on('open', id => graph.focus(id))
  return graph
}
