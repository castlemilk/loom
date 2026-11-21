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

## Model nodes with metadata and images

The orbital atlas pairs a typed record with an image catalogue. Select Titan to read its metadata and open the relationship that connects it to Saturn. Edit a label, an image key or an endpoint to change the live graph. **Download project** saves your edited TypeScript, the renderer and the example images in a runnable Vite app. [Open the orbital atlas →](https://castlemilk.github.io/loom/#node-playground)

Extend the SDK’s node and link interfaces with the fields your application owns. A node’s `art` key refers to a catalogue entry with a file, alternative text and a credit. The same image can illustrate several nodes. The editor checks the data module against these types and the ES2022 standard library. Rendering and selection callbacks live in the mount example below.

`notebook-types.ts`

```ts
import type { GraphData, GraphLink, GraphNode } from 'loom-core'

export type Field = string | number | boolean | null | readonly Field[] | { readonly [key: string]: Field }

export interface RecordNode extends GraphNode {
  label: string
  kind: string
  metadata?: Readonly<Record<string, Field>>
}

export interface RecordLink extends GraphLink {
  kind: string
  note?: string
  sourceURL?: string
}

export interface ImageRef {
  src: string
  alt: string
  credit?: string
  sourceURL?: string
}

export interface Notebook extends GraphData<RecordNode, RecordLink> {
  /** A node's optional art field names an entry here. Several nodes can share one image. */
  images: Readonly<Record<string, ImageRef>>
}
```

Saturn’s moons use explicit source and target IDs. Relationship notes and source URLs travel with the link.

`saturn.ts`

```ts
import type { Notebook } from './notebook-types.js'

export const graph: Notebook = {
  nodes: [
    {
      id: 'saturn', label: 'Saturn',
      kind: 'Planet', art: 'rings',
      x: 0, y: -64,
      metadata: {
        'Order from Sun': 6,
        'Planet type': 'Gas giant',
      },
    },
    {
      id: 'titan', label: 'Titan', kind: 'Moon',
      art: 'haze', x: -143, y: 65,
      metadata: { Atmosphere: 'Dense haze', 'Huygens landing': '14 January 2005' },
    },
    {
      id: 'enceladus', label: 'Enceladus', kind: 'Moon',
      art: 'ice', x: 143, y: 65,
      metadata: { Surface: 'Water ice', 'Subsurface ocean': true },
    },
  ],
  links: [
    { source: 'titan', target: 'saturn', kind: 'orbits',
      note: 'Titan is the largest moon of Saturn.', sourceURL: 'https://science.nasa.gov/saturn/moons/titan/' },
    { source: 'enceladus', target: 'saturn', kind: 'orbits',
      note: 'Enceladus orbits inside the planet’s E ring.', sourceURL: 'https://science.nasa.gov/saturn/moons/enceladus/' },
  ],
  images: {
    rings: { src: 'saturn.webp', alt: 'The golden disc of Saturn framed by its rings.',
      credit: 'NASA/JPL-Caltech/SSI/Cornell', sourceURL: 'https://science.nasa.gov/photojournal/jewel-of-the-solar-system/' },
    haze: { src: 'titan.webp', alt: 'Titan’s hazy amber disc against black space.',
      credit: 'NASA/JPL-Caltech/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/a-last-look-at-titan/' },
    ice: { src: 'enceladus.webp', alt: 'A false-color view of fractures across the icy surface of Enceladus.',
      credit: 'NASA/JPL/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/enceladus-in-false-color/' },
  },
}
```

The Cassini example builds links from a typed array. Change a moon’s flyby count to update both its metadata and the sentence explaining the relationship.

`cassini.ts`

```ts
import type { Notebook, RecordNode } from './notebook-types.js'

const moons: RecordNode[] = [
  { id: 'titan', label: 'Titan', kind: 'Moon', art: 'haze',
    x: -143, y: 65, metadata: { 'Targeted flybys': 127 } },
  { id: 'enceladus', label: 'Enceladus', kind: 'Moon', art: 'ice',
    x: 143, y: 65, metadata: { 'Targeted flybys': 23 } },
]

export const graph: Notebook = {
  nodes: [
    { id: 'cassini', label: 'Cassini', kind: 'Spacecraft', art: 'orbiter',
      x: 0, y: -64, metadata: { Launch: 1997, 'Saturn orbits': 293, Partners: ['NASA', 'ESA', 'ASI'] } },
    ...moons,
  ],
  links: moons.map(moon => ({
    source: 'cassini', target: moon.id, kind: 'flew past',
    note: `Cassini made ${moon.metadata?.['Targeted flybys']} targeted flybys of ${moon.label}.`,
    sourceURL: 'https://science.nasa.gov/mission/cassini/quick-facts/',
  })),
  images: {
    orbiter: { src: 'cassini.webp', alt: 'Cassini in the assembly room at the Jet Propulsion Laboratory.',
      credit: 'NASA/JPL', sourceURL: 'https://science.nasa.gov/photojournal/cassini-spacecraft-in-a-jpl-assembly-room/' },
    haze: { src: 'titan.webp', alt: 'Titan’s orange haze seen by Cassini.',
      credit: 'NASA/JPL-Caltech/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/a-last-look-at-titan/' },
    ice: { src: 'enceladus.webp', alt: 'Fractured ice on Enceladus, shown in false color.',
      credit: 'NASA/JPL/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/enceladus-in-false-color/' },
  },
}
```

Pass a sized SVG element, the graph, the URL of your image directory and a selection callback to this renderer. The callback receives the complete typed node. Call `update` after a valid edit and `destroy` on unmount.

`mount-notebook.ts`

```ts
import { createCardGraph } from 'loom-core/cards'
import type { Notebook, RecordNode } from './notebook-types.js'

export function mountNotebook(svg: SVGSVGElement, initial: Notebook, imageBase: URL, onSelect: (node: RecordNode) => void) {
  let notebook = initial
  const view = createCardGraph(svg, initial, {
    root: initial.nodes[0]?.id, showArrows: true,
    badge: node => node.kind, relationship: link => link.kind,
    image: node => {
      const ref = node.art && notebook.images[node.art]
      return ref ? new URL(ref.src, imageBase).href : undefined
    },
    onSelect,
  })
  return {
    select: view.select, fit: view.fit, destroy: view.destroy,
    update(next: Notebook) {
      const previous = notebook
      notebook = next
      view.setData(next)
      const root = next.nodes[0]?.id
      if (previous.nodes[0]?.id !== root) view.setOptions({ root })
      const moved = next.nodes.some((node, i) => {
        const old = previous.nodes[i]
        return old?.id !== node.id || old.x !== node.x || old.y !== node.y
      })
      if (moved || previous.nodes.length !== next.nodes.length) view.fit()
    },
  }
}
```
