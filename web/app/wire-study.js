import { createGraph } from '../../dist/index.js'
import { makeTheme, preset } from './appearance'

export const wireAnchor = ({ x, y, z }) => ({ x, y, z })
export const wireForces = { blend: 0.82, linkDistance: 54, autoRotate: false }

export function wireModelStyle() {
  return { ...preset('ink'), route: 'straight', opacity: 0.9, fill: 0.95, artwork: false, grid: false, labels: 'focus', alternateSide: true,
    nodes: {
      porcelain: { color: '#e9d9b9', shape: 'circle' }, terracotta: { color: '#d9824f', shape: 'circle' },
      graphite: { color: '#8b9491', shape: 'circle' },
    },
    wires: { copper: { color: '#cb8764', width: 1.6 }, nickel: { color: '#adb9b5', width: 1.1 }, brass: { color: '#ddbb6d', width: 2.5 } },
  }
}

export function mountWireStudy(canvas, data) {
  return createGraph(canvas, { ...data, mode: 'cloud', sim: 'main', theme: makeTheme(wireModelStyle()), layout: { ...wireForces, anchor: wireAnchor } })
}
