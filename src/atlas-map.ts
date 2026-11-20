import { createGraph } from './index.js'
import type { Atlas, AtlasNode, AtlasScene } from './atlas.js'
import type { GraphFrame, GraphLink, LoomGraph, Theme } from './types.js'

export interface AtlasMapOptions {
  theme: Theme<AtlasNode, GraphLink>
  keepView?: boolean
  onPick?: (node: AtlasNode) => void
  onFrame?: (frame: GraphFrame, scene: AtlasScene) => void
}
/** Bind an atlas to Loom. Keep camera and dragged nodes across changes of the visible data. */
export function mountAtlasMap(canvas: HTMLCanvasElement, atlas: Atlas, options: AtlasMapOptions) {
  let graph: LoomGraph<AtlasNode, GraphLink>,
    scene: AtlasScene,
    open: readonly number[] = []
  let selected: string | null = null,
    keepView = options.keepView ?? true
  const moves = new Map<string, { x: number; y: number; z: number; pinned: boolean }>()
  function mount() {
    const next = atlas.getSnapshot()
    if (next.scene === scene) return
    const previous = graph?.getViewport()
    if (graph) {
      for (const node of scene.nodes) {
        const pose = graph.getPosition(node.id)
        if (Math.abs(pose.x - node.x!) > 0.01 || Math.abs(pose.y - node.y!) > 0.01) moves.set(node.id, pose)
        else moves.delete(node.id)
      }
      graph.destroy()
    }
    scene = next.scene
    graph = createGraph(canvas, {
      ...scene,
      nodes: scene.nodes.map((n) => (moves.has(n.id) ? { ...n, ...moves.get(n.id) } : n)),
      theme: options.theme,
      mode: 'drift',
      layout: { pinOnDrag: true },
      sim: 'main',
      transparentBackground: true,
    })
    if (previous) graph.setViewport(previous)
    const added = next.expanded.find((id) => !open.includes(id))
    if (!keepView && added !== undefined) {
      const center = graph.getPosition('topic:' + added),
        camera = graph.getViewport()
      graph.setViewport({ ...camera, x: center.x, y: center.y, z: center.z, zoom: Math.max(1.5, camera.zoom) })
    }
    open = next.expanded
    if (selected && scene.nodes.some((n) => n.id === selected)) graph.select(selected)
    const byId = new Map(scene.nodes.map((n) => [n.id, n]))
    graph.on('nodeclick', (id) => {
      selected = id
      const node = byId.get(id)!
      options.onPick?.(node)
    })
    if (options.onFrame) graph.onFrame((frame) => options.onFrame!(frame, scene))
  }
  mount()
  const off = atlas.subscribe(mount)
  return {
    fit: () => graph.fit(),
    focus: (id: string) => graph.focus(id),
    select(id: string | null) {
      selected = id
      graph.select(id)
    },
    zoom(factor: number) {
      if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Invalid atlas zoom')
      const camera = graph.getViewport()
      graph.setViewport({ ...camera, zoom: Math.max(0.015, Math.min(15, camera.zoom * factor)) })
    },
    setKeepView(value: boolean) {
      keepView = value
    },
    getViewport: () => graph.getViewport(),
    destroy() {
      off()
      graph.destroy()
      moves.clear()
    },
  }
}
