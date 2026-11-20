import type { AtlasNode, AtlasScene } from './atlas.js'
import type { GraphViewport, LoomGraph, Mode } from './types.js'

export interface AtlasPoint { x: number; y: number; z: number }

// Use elapsed time so a slow frame or a background tab cannot stretch the trip.
export function travelProgress(start: number, duration: number) {
  const t = Math.max(0, Math.min(1, (performance.now() - start) / duration))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export function travelView(a: GraphViewport, b: GraphViewport, t: number): GraphViewport {
  const turn = b.yaw - a.yaw
  return {
    x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t),
    zoom: 1 / mix(1 / a.zoom, 1 / b.zoom, t),
    yaw: a.yaw + Math.atan2(Math.sin(turn), Math.cos(turn)) * t,
    pitch: mix(a.pitch, b.pitch, t),
  }
}

/** Keep each article on its topic's trajectory, including blocks delivered during the move. */
export class AtlasLayoutTransition {
  readonly start = performance.now()
  readonly mode: Mode
  private tracks: { id: string; from: AtlasPoint; to: AtlasPoint }[] = []
  private fromView: GraphViewport
  private toView: GraphViewport
  constructor(
    private origins: Map<string, AtlasPoint>, from: GraphViewport, source: Mode,
    readonly destination: GraphViewport, readonly destinationMode: Mode,
  ) {
    this.mode = source === 'cloud' || destinationMode === 'cloud' ? 'cloud' : 'drift'
    // A flat graph is the head-on, zero-depth plane of the 3D view.
    const flat = (v: GraphViewport) => ({ ...v, yaw: 0, pitch: 0, z: 0 })
    this.fromView = source === 'cloud' ? from : flat(from)
    this.toView = destinationMode === 'cloud' ? destination : flat(destination)
  }

  bind(scene: AtlasScene, placed: (node: AtlasNode) => AtlasPoint) {
    const hubs = new Map<number, { from: AtlasPoint; to: AtlasPoint }>()
    this.tracks = scene.nodes.map((node) => {
      const to = placed(node)
      let from = this.origins.get(node.id)
      // In an atlas scene the overview precedes its articles. Start a newly loaded
      // article at the same relative offset from its moving hub.
      if (!from) {
        const hub = hubs.get(node.topic)
        from = hub ? { x: hub.from.x + to.x - hub.to.x, y: hub.from.y + to.y - hub.to.y,
          z: hub.from.z + to.z - hub.to.z } : to
      }
      if (node.article === undefined) hubs.set(node.topic, { from, to })
      return { id: node.id, from, to }
    })
  }

  paint(graph: Pick<LoomGraph, 'pin' | 'setViewport'>, t: number) {
    const p = { x: 0, y: 0, z: 0 }
    for (const { id, from, to } of this.tracks) {
      p.x = mix(from.x, to.x, t)
      p.y = mix(from.y, to.y, t)
      p.z = mix(from.z, this.destinationMode === 'cloud' ? to.z : 0, t)
      graph.pin(id, p)
    }
    graph.setViewport(travelView(this.fromView, this.toView, t))
  }
}
