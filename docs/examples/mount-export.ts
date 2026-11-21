import { mountScene, type GraphScene } from 'loom-core/scene'
import { graph as data } from './data.js'

export async function mountGraph(canvas: HTMLCanvasElement, workerURL?: string) {
  const response = await fetch(new URL('./scene.json', import.meta.url))
  if (!response.ok) throw new Error('Could not load scene.json (' + response.status + ')')
  const scene: GraphScene = await response.json()
  const graph = mountScene(canvas, { ...scene, data }, { workerURL })
  graph.on('open', id => graph.focus(id))
  return graph
}
