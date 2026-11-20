# Search and drilldowns

Answer two questions about a node. What does it connect to, and which part of the graph should the reader see next?

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/navigation/)

## Inspect a connection

Build an index over a graph snapshot when you need search or adjacency. A neighbor contains the other node and every parallel link to it, in source order. Use the links’ own IDs and metadata to explain why two records connect.

`inspect.ts`

```ts
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
```

For the signal path in the first guide, inspecting `mixer` returns `filter` as its outgoing neighbor. Ask for incoming neighbors to find `osc` and `noise`. Rebuild the index after a document edit. [Open the signal path example →](https://castlemilk.github.io/loom/docs/index.md)

## Navigate a group

`createDrilldown(data)` owns the current scope, selection and breadcrumb trail. `openNeighborhood(id)` narrows the visible graph. `followNode(id)` can follow a reference across group boundaries. Read `getSnapshot().data` for the nodes and links to display.

For overlapping named groups, use `compileTaxonomies` and convert a compiled group to stable member IDs with `drilldownGroup`. Opening a group with the `expand` action and a bound renderer spreads its members in the current map. The `isolate` action gives the group its own view. Subscribe to the controller, remount a changed scope, and call `bind` with that scope’s graph. `back()` restores the parent selection and camera. [Explore the Optics group →](https://castlemilk.github.io/loom/studio/?example=drilldown\&group=Optics)

## Open relationship cards

`cardNeighborhood(data, id, limit)` selects up to the requested number of distinct one-hop neighbors. It retains parallel links, self-loops and direction. Mount the result with `createCardGraph(svg, neighborhood, options)` from `loom-core/cards`. Set `root` to the inspected ID and supply `relationship` to name each edge. Call `destroy()` when leaving the view.

[Try the relationship cards](https://castlemilk.github.io/loom/docs/navigation/#open-relationship-cards)

Drag a card to change its position. The example gives Blackbird extra space because its relationship has a longer caption. Loom places captions where they fit between cards.

`cards.ts`

```ts
import { cardNeighborhood, createCardGraph } from 'loom-core/cards'

export function showCanva(svg: SVGSVGElement) {
  const data = {
    nodes: [
      { id: 'canva', label: 'Canva', kind: 'Startup' },
      { id: 'melanie', label: 'Melanie Perkins', kind: 'Person' },
      { id: 'blackbird', label: 'Blackbird Ventures', kind: 'Investor', x: 415, y: -90 },
    ],
    links: [
      { source: 'melanie', target: 'canva', label: 'Founder' },
      { source: 'blackbird', target: 'canva', label: 'Listed in portfolio' },
    ],
  }
  return createCardGraph(svg, cardNeighborhood(data, 'canva'), {
    root: 'canva',
    badge: node => node.kind,
    relationship: link => link.label,
  })
}
```

In the Canva demo, an investor and a founder can both be one hop from the company. The relationship label explains which connection you are looking at. [Inspect the relationship cards →](https://castlemilk.github.io/loom/studio/cards/)
