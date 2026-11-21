import { createCardGraph } from 'loom-core/cards'
import type { Notebook, RecordNode } from './notebook-types.js'

export function mountNotebook(svg: SVGSVGElement, initial: Notebook, imageBase: URL, onSelect: (node: RecordNode) => void,
  onMove?: (node: RecordNode, position: { x: number; y: number }) => void) {
  let notebook = initial
  const view = createCardGraph(svg, initial, {
    root: initial.nodes[0]?.id, showArrows: true,
    badge: node => node.kind, relationship: link => link.kind,
    image: node => {
      const ref = node.art && notebook.images[node.art]
      return ref ? new URL(ref.src, imageBase).href : undefined
    },
    onSelect, onMove,
  })
  return {
    select: view.select, fit: view.fit, destroy: view.destroy,
    setMovable: (movable: boolean) => view.setOptions({ movable }),
    update(next: Notebook, fitChanges = true) {
      const previous = notebook
      notebook = next
      view.setData(next)
      const root = next.nodes[0]?.id
      if (previous.nodes[0]?.id !== root) view.setOptions({ root })
      const moved = next.nodes.some((node, i) => {
        const old = previous.nodes[i]
        return old?.id !== node.id || old.x !== node.x || old.y !== node.y
      })
      if (fitChanges && (moved || previous.nodes.length !== next.nodes.length)) view.fit()
    },
  }
}
