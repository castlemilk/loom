import type { GraphData } from 'loom-core'
import { createGraphIndex } from 'loom-core/explore'
import { createDrilldown } from 'loom-core/drilldown'

export function inspectNode(data: GraphData, id: string) {
  const index = createGraphIndex(data)
  const outgoing = index.neighbors(id, 'outgoing')
  const drill = createDrilldown(data)
  drill.openNeighborhood(id, { direction: 'outgoing', hops: 1 })

  return {
    outgoing,
    visible: drill.getSnapshot().data,
    back: () => drill.back(),
    search: (text: string) => index.search(text, { limit: 10 }),
  }
}
