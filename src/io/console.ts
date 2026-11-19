import type { GraphNode, GraphLink } from '../types.js'

// Structural typing preserves href, blurb and evidence for the console's DOM panels.
export function fromConsole<N extends GraphNode, E extends GraphLink>(graph: {
  nodes: readonly N[]
  edges: readonly E[]
}) {
  return { nodes: graph.nodes, links: graph.edges }
}
