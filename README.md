# Loom

Loom draws interactive node graphs on a WebGL2 canvas. The first draw contains nodes and Bézier wires. The default layout seeds unpositioned nodes on a deterministic golden-angle spiral. A structured layout can seed on diagram anchors or blend the two positions. Force layout, label rasterization and artwork loading begin on later frames.

On the M2 Max, the bundle including the optional worker measured 23,945 bytes minified and gzipped. The 1,000-node graph presented its first frame in 27.3–40.5 ms across seven fresh contexts, above the 10 ms release budget. A clear-only WebGL canvas presented in 19.2–20.5 ms. The layout settled in 295 ms in a separate run. With the knowledge-console styling, camera movement sustained 118.9 fps at 5,000 nodes and 118.1 fps at 25,000 nodes. Both sizes used four draw calls. The [hardware measurements](benchmarks/m2-max.json) include the raw samples.

## Run the studio

Use Node.js 22 or later.

The [hosted graph studio](https://castlemilk.github.io/loom/) is a Next.js static export. It includes the 25-node excerpt in the initial page and uses TanStack Query to fetch and cache the full graph on demand. Tailwind CSS styles the responsive controls. The framework dependencies live in `web/`.

Open the [Section atlas](https://castlemilk.github.io/loom/?example=clusters) to explore 45 nodes and 88 relationships across four synthetic notebooks. Rotate the Cloud or drag a node to see its section boundary follow. In **Taxonomies**, switch **Group by** to **Connected component** to find the two sets joined by citations. **Group bubbles** controls contour shape, padding, fill, stroke and individual group visibility. **Appearance** maps node radius and wire thickness to fields, with editable scale curves and output ranges. **Style controls → Kind stroke** assigns a pattern to a specific relationship.

In **Taxonomies**, choose **Category** and open **Group bubbles** to outline a single knowledge category. Outlines from several taxonomies can be visible together. **Define a taxonomy** accepts JSON field or relationship mappings, and **Display language** edits the connection and unassigned-lane labels. Applied definitions and language are saved in this browser. Drag the separator to change the graph width, or its height on a narrow screen. The arrow keys adjust the separator and Enter restores its starting size.

Open **Test data**, choose **Image atlas**, then **Generate graph** to draw 1,024 image-bearing nodes. Select **Cloud** and drag the background to orbit. Open **Perf** to watch frame intervals and artwork decoding while you zoom or pull a node.

The **Node size** control in the header scales every marker from 0.30× to 16×. Drag the slider for fine adjustments, use **−** and **+** for larger steps, or click the multiplier to restore the theme size. Scroll or pinch over the canvas to zoom the camera independently.

To increase the number of nodes, open **Graph → Generated node counts** and pick **1,000**, **5,000**, **10,000** or **25,000**. The hosted studio reuses the seed, artwork, content and connection settings from the last generated workload. Each option shows its link count. Dense workloads use fewer links per node at sizes that would exceed 100,000 links. **Append batch** in Test data adds nodes to the current dataset.

The generator accepts up to 25,000 nodes and 100,000 links. Choose local clusters, hubs or random connections. Set the image coverage, choose from 256 bundled WebP specimens and switch between titles, notes and full articles. Select a node to inspect its image and text. Reusing a seed keeps the same topology when you change the payload. **Append batch** adds nodes and a connecting edge to the graph on screen. **Export JSON** saves the current data, including artwork references.

**Import JSON** reads a local file with `nodes` and `links` (or `edges`). Give each node a unique string `id`. Links reference these IDs with `source` and `target`. Nodes can carry `label`, `kind`, `summary`, `content` and `art`. An optional `artwork` dictionary maps art keys to URLs. Raster data URLs, bundled `graphs/` paths and HTTP(S) image URLs are accepted. External image hosts must allow CORS for WebGL atlas uploads.

```sh
npm ci
npm --prefix web ci
npm run site:dev
```

Visit `http://localhost:3000/loom/`. To reproduce the Pages build, run `npm run site:build`. GitHub Actions tests the export under the repository path before deploying it. Set `PAGES_BASE_PATH` to an empty string for a root-domain export.

For the standalone core demo, run:

```sh
npm ci
npm run dev
```

Open the URL printed by the server. The studio opens a 25-node, 30-link excerpt of the benebsworth.com knowledge console, with offline artwork. The graph picker also offers the full 508-node, 746-link snapshot and a generated 100–25,000-node stress graph. Move **Structure** between free physics and an exactly positioned diagram. **Spacing & forces** adjusts lane geometry and spring behaviour. **Style controls** edits marker shapes, colours, wire weights and labels in place. Select a node to pin or release it. Open **Simulation & diagnostics** to switch transports or sample the counters. For a single HTML file that also works offline, run `npm run demo:build` and open `artifacts/loom-studio.html`.

## Use the core

Install the typed ESM package from the [Pages build](https://castlemilk.github.io/loom/loom-core-0.1.0.tgz), or build this checkout with `npm run build`. The package includes the core, optional annotation, performance and console entry points, and the layout worker. For a reproducible install, use the source revision in the URL. Pages retains those archives across deployments and npm records the URL and integrity in your lockfile. The browser needs a canvas with a CSS width and height.

```sh
revision=$(curl -fsSL https://castlemilk.github.io/loom/revision.txt)
npm install "https://castlemilk.github.io/loom/packages/$revision/loom-core-0.1.0.tgz"
```

```html
<canvas id="map" style="width: 100%; height: 480px"></canvas>
<script type="module">
  import { createGraph, ink } from './dist/index.js'

  const graph = createGraph(document.querySelector('#map'), {
    nodes: [
      { id: 'synthesis', kind: 'concept', label: 'Synthesis' },
      { id: 'oscillator', kind: 'lab', label: 'Oscillator' },
      { id: 'envelope', kind: 'study', label: 'Envelope' },
    ],
    links: [
      { source: 'synthesis', target: 'oscillator' },
      { source: 'synthesis', target: 'envelope' },
    ],
    theme: ink,
  })

  graph.on('open', id => graph.focus(id))
  graph.select('synthesis')
  window.addEventListener('pagehide', e => { if (!e.persisted) graph.destroy() })
</script>
```

| API | Behaviour |
| --- | --- |
| `createGraph(canvas, options)`, `create(canvas, options)` | Synchronously submit the first graph draw and return the handle. Duplicate IDs and unknown link endpoints raise errors. A missing WebGL2 context raises `WebGL2UnavailableError`. |
| `setMode(mode)` | Switch between `drift`, configurable `lanes`, neighbourhood `orbit` rings and volumetric `cloud`. |
| `setLayout(patch)` | Update the force/diagram blend, anchors, lane geometry, forces, drag pinning or lane guides. Omitted settings retain their current values. |
| `setTheme(theme)` | Apply a complete theme to the mounted graph. Colour, label and wire edits preserve simulation state. Radius changes update collision handling. |
| `getPosition(id)`, `pin(id, position?)`, `unpin(id)` | Read visible world coordinates and pin status, fix a node at its current or supplied coordinates, or return it to its layout. |
| `select(id)`, `select(null)` | Highlight the node, its incident wires and its immediate neighbours, or clear the selection. |
| `focus(id)`, `fit()`, `reset()` | Centre a node, fit the graph bounds, or clear selection and restore the fitted camera. |
| `on(event, callback)` | Subscribe to `select`, `hover`, `open`, `modechange` or `destroy`. The return value unsubscribes. Selection and hover deliver a node ID or `null`. |
| `onFrame(callback)` | Subscribe to painted frames for a custom overlay. Screen positions and radii use CSS pixels in input node order. Copy the borrowed points if you need to retain them across frames. |
| `pause()`, `resume()`, `resize()` | Control scheduling and refresh the backing size. Resize and intersection observers handle ordinary layout changes. |
| `stats()`, `destroy()` | Read frame, tick, label, transport and submission counters, or release listeners, workers, textures, buffers and programs. |

Drag a marker or its visible label to pull the node. Connected nodes respond while the pointer is held. Releasing a movable node lets its springs settle over successive frames. Set `pinOnDrag: true` to keep it at the drop position. Empty-space dragging pans flat views and tumbles the cloud. In the cloud, a node drag follows the camera-facing plane at the node’s depth. Wheel and pinch zoom around the pointer or pinch midpoint. Arrow keys move the view, plus and minus zoom, Escape clears selection, and Enter emits `open` for the selected node.

## Mix force and diagram layouts

`layout.blend` defaults to `0`, where the selected force mode controls placement. Intermediate values keep link springs and repulsion active. Anchor strength rises quadratically with the blend, so the lower half of the slider leaves room for a node and its neighbours to move together. At `1`, movable nodes reach their exact targets immediately and the simulation sleeps without ticking. Explicit pins take precedence at every blend. Releasing a node returns it to the current layout.

```js
import { createGraph, knowledgeConsole } from 'loom-core'
import { consoleLayout, fromConsole } from 'loom-core/console'

const graph = createGraph(canvas, {
  ...fromConsole(knowledgeGraph),
  theme: knowledgeConsole,
  layout: {
    ...consoleLayout,
    blend: 0.25,
    laneOrder: ['study', 'concept', 'tag', 'blog', 'lab', 'category'],
    pinOnDrag: false,
  },
})

graph.setLayout({ blend: 0.8, laneGap: 240 })
graph.setLayout({ direction: 'vertical' })
```

Built-in diagram anchors sort IDs within each kind. `laneOrder` puts the named kinds first, with other present kinds following in lexical order. `laneGap` separates kinds and `rowGap` separates peers. `direction` rotates the lanes and the patch-wire tangents together. The lanes force mode also respects lane order, spacing and direction at zero blend. To reproduce an authored drawing, pass `anchor: node => positions.get(node.id)`. Missing entries use the built-in lanes. Use `anchor: null` to return every movable node to those lanes. Set `guides: true` to show the built-in lane guides in flat views.

`repulsion` and `springStrength` are multipliers. `linkDistance` sets the gap between node boundaries in world units. `springsByKind` can adjust the distance or strength of an individual relationship kind. The console preset gives concept links 1.55× spring strength and category links a longer rest distance. Layout callbacks run on the calling thread and the worker receives numeric arrays.

Orbit opens around the highest-degree node. Ties use lexical node ID order. Selecting a node makes it the centre, and clearing the selection returns to the default. Direct neighbours occupy the first ring, two-hop neighbours the second and all remaining nodes the outer ring. `orbitGap` sets the minimum spacing in world units. At full structure the rings are exact. Lower structure keeps spring response and individual dragging. Explicit pins retain their positions.

Cloud distributes unpositioned nodes through a deterministic 3D volume. Its angled perspective camera, shaded markers and depth-tested wires reveal foreground and background as you orbit. **Depth spread** scales generated heights from 0% to 300%. Authored heights and pins are preserved at full structure, including anchors that describe a plane. A lower blend lets springs pull against the volumetric targets. Dragging a node keeps it on the camera-facing plane through the point you grabbed. The orientation axes follow the camera. Idle rotation respects reduced motion and can be disabled in the studio or in code.

```ts
graph.setMode('cloud')
graph.setLayout({ blend: 0.4, cloudDepth: 1.5, autoRotate: false })
```

## Live performance

The **Perf** button attaches a monitor to the graph on screen. It reports graph draw submissions per second, the last 48 active frame intervals and their recent p95. The chart marks a 16.7 ms frame. The **CPU · main thread** reading measures elapsed work in Loom scheduler callbacks and excludes worker execution. **GPU draw** measures a submitted draw using an asynchronous WebGL timer when supported. **JS heap** shows the browser's reported heap usage when available. The panel also shows packed geometry bytes, decoded versus requested image tiles, draw calls, labels, pixel ratio and cumulative frames.

The monitor updates at most four times per second. A settled graph shows zero graph FPS, and the monitor goes to sleep after pending GPU measurements resolve or time out. Each graph supports one timing observer. Unsubscribe to close its timers and release the GPU query. Destroying the graph also detaches it.

```ts
import { observePerformance } from 'loom-core/performance'

const stop = observePerformance(graph, (sample) => {
  console.log(sample.fps, sample.p95FrameMs, sample.mainThreadMs,
    sample.gpuStatus, sample.gpuMs, sample.heapBytes)
})

window.addEventListener('pagehide', stop, { once: true })
```

## Taxonomies and annotations

Import `loom-core/taxonomy` to use the same domain vocabulary for grouping, colours, legends, tooltips and lanes. This entry point is optional and has no framework dependencies. The declarations target TypeScript 5.4 or later. Node and link types are inferred from the dataset, including inside marker, wire, anchor and lane callbacks. Here the overlay and canvas share the host element's bounds.

```ts
import { createGraph, ink, type GraphData, type GraphNode } from 'loom-core'
import { attachAnnotations, compileTaxonomies, type TaxonomyConfig } from 'loom-core/taxonomy'

interface Entry extends GraphNode {
  topics?: readonly string[]
}

const catalogue = {
  taxonomies: [
    { id: 'subject', label: 'Subject', by: 'topics',
      remap: { optics: 'light', waves: ['light', 'motion'] },
      terms: { light: { label: 'Light & optics', color: '#6cbca9' }, motion: { label: 'Wave motion' } } },
    { id: 'category', label: 'Filed under', by: { relation: 'filed-in', groupEnd: 'target' } },
  ],
  language: {
    connections: (n) => n + (n === 1 ? ' reference' : ' references'),
    ungrouped: 'Unclassified',
  },
} satisfies TaxonomyConfig<Entry>

export function mountCatalogue(host: HTMLElement) {
  const data: GraphData<Entry> = {
    nodes: [
      { id: 'prism', label: 'Prism', topics: ['optics'] },
      { id: 'packet', label: 'Wave packet', topics: ['waves'] },
      { id: 'physics', label: 'Physics' },
    ],
    links: [{ source: 'prism', target: 'physics', kind: 'filed-in' },
      { source: 'packet', target: 'physics', kind: 'filed-in' }],
  }
  host.style.position = 'relative'
  host.style.height = '480px'
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none'
  host.append(canvas, overlay)

  const terms = compileTaxonomies(data, catalogue)
  const graph = createGraph(canvas, { ...data, mode: 'lanes',
    layout: { blend: 0.55, laneBy: terms.laneBy('subject'), guides: true },
    theme: { ...ink, nodes: { ...ink.nodes, resolve: (node) => terms.primary(node.id, 'subject') } },
  })
  const annotations = attachAnnotations(graph, overlay, terms, {
    laneTaxonomy: 'subject', bubbles: { subject: ['light'], category: ['physics'] }, padding: 10,
  })
  return {
    graph,
    legend: terms.legend('subject'),
    showAllSubjects() { annotations.setOptions({ bubbles: { subject: true, category: ['physics'] } }) },
    destroy() { graph.destroy(); canvas.remove(); overlay.remove() },
  }
}
```

`by` accepts a string-valued field, an array-valued field, a relationship endpoint, or a typed classifier such as `(node, context) => context.linksFor(node.id).length ? 'connected' : 'isolated'`. Relationship groups include their hub and its incident members. `remap` translates raw values to one or more term IDs. Multiple memberships are deduplicated. All apply to bubbles and tooltips, and the first determines exclusive lane placement. Unassigned nodes get their own lane. Term labels, descriptions and colours are independent of the raw IDs.

`legend(id)` returns ordered groups, display properties and member indices. `describe(nodeId)` returns the title, formatted count and full membership. For custom tooltip content, supply `language.tooltip(node, description)` returning `{ title, lines }`. Text renders literally. Outlines and lane captions follow the camera, node drags and canvas resizes on the engine's existing paint cycle. `setOptions({ bubbles: {} })` hides every outline. Destroying the graph also releases its annotations.

## Drilldowns and group interactions

Open **Optics** in the legend or click the space between its nodes in the [Section atlas](https://castlemilk.github.io/loom/?example=drilldown). Its eight members spread out while its links to other sections stay visible. Click the same legend entry to collapse it. A click on a child selects it. Double-click or press Enter on a selection to explore its neighbors. Use Back, an ancestor breadcrumb or Escape on the canvas to return.

In **Explore**, **Open a group** switches between in-place expansion, an isolated group with its internal links, and disabled navigation. **Drilldown settings** lets you choose the node actions, bubble gesture, open boundary, member arrangement, spacing, expansion strength and detail layout. The group buttons also work with a keyboard. Search finds nodes in the current view.

| Library option | Behavior |
| --- | --- |
| `selectAction`, `openAction` | Choose `inspect`, `focus`, `neighbors` or `group`, globally or per node. Supply `groupFor(node)` for the group action. |
| `groupAction` | Set `expand`, `isolate` or `none`, or return one per taxonomy or term from a callback. |
| `arrangement`, `memberSpacing`, `spread` | Rings handle coincident nodes with deterministic, spaced targets. Radial expansion follows previous directions. Default ring targets are 28 world units × 2 apart. The studio scales spacing with node size. |
| `expansionBlend` | Defaults to 0.7. Intermediate values let springs and repulsion respond to dragging. At 1, movable nodes use the exact targets. Pinned nodes keep their positions. |
| `neighborhood`, `detail` | Set hop count, direction and a typed link filter. Each drilldown stays inside its parent view. Isolated detail uses free Drift by default. Pass an empty detail object to inherit the overview layout. |
| Annotation options | `groupGesture` accepts `click`, `double-click` or `controls`. The opened boundary can use `outline`, `fade`, `hide` or `keep`. Child nodes and labels take priority over a boundary. |

The framework-independent controller ships in `loom-core/drilldown`. Its snapshot supplies nodes and links in source order, a selection and a navigation path. On a scope change, remount with the new data. A bound in-place expansion keeps the same data and renderer. Apply the resolved layout when navigation or configuration changes. Back restores the parent positions and selection, incorporates current pins and refits the parent view.

The example expects an underlay, canvas and overlay in that DOM order inside one positioned host. Give them the same bounds, set the host background to the graph theme and use `pointer-events: none` on the two annotation layers. The transparent WebGL canvas paints the links, nodes and labels above all bubble fills.

```ts
import { createGraph, ink, type GraphData, type GraphNode, type LoomGraph } from 'loom-core'
import { createDrilldown, drilldownGroup } from 'loom-core/drilldown'
import { attachAnnotations, compileTaxonomies, scopeTaxonomies, type GraphAnnotations } from 'loom-core/taxonomy'

export function mountExplorer(data: GraphData, canvas: HTMLCanvasElement, underlay: HTMLElement, overlay: HTMLElement) {
  const all = compileTaxonomies(data, { taxonomies: [{ id: 'type', label: 'Type', by: 'kind' }] })
  const drill = createDrilldown(data, {
    selectAction: 'inspect', openAction: 'neighbors',
    groupAction: (term) => term.id === 'archive' ? 'isolate' : 'expand',
    arrangement: 'rings', memberSpacing: 36, spread: 1.8, expansionBlend: 0.65,
    neighborhood: { hops: 1, direction: 'outgoing' },
  })
  let graph: LoomGraph<GraphNode>, marks: GraphAnnotations
  let previous: ReturnType<typeof drill.getSnapshot> | undefined

  function render() {
    const state = drill.getSnapshot()
    const level = state.path.at(-1)!
    const activeGroup = level.kind === 'group' ? { taxonomy: level.taxonomy, id: level.id } : undefined
    const layout = drill.resolveLayout('cloud', { autoRotate: false })
    if (state.data !== previous?.data) {
      graph?.destroy()
      const index = scopeTaxonomies(all, state.data.nodes)
      graph = createGraph(canvas, { ...state.data, ...layout, theme: ink, transparentBackground: true })
      marks = attachAnnotations(graph, overlay, index, { underlay, activeGroup, bubbles: { type: true },
        groupGesture: 'click', onOpenGroup: (term) => drill.openGroup(drilldownGroup(term, state.data.nodes)) })
      drill.bind(graph, state.data)
    } else if (state.path !== previous.path || state.options !== previous.options) {
      graph.setLayout(layout.layout)
      graph.setMode(layout.mode)
      marks.setOptions({ activeGroup })
    }
    previous = state
  }

  render()
  const unsubscribe = drill.subscribe(render)
  return { drill, destroy() { unsubscribe(); graph.destroy() } }
}
```

## Cluster placement and data-driven styling

The optional `loom-core/clusters` and `loom-core/metrics` entry points prepare layout and style rules when your data changes. This example arranges papers into 3D sections, outlines each section and makes links to highly connected endpoints thicker.

```ts
import { createGraph, ink, type GraphData } from 'loom-core'
import { clusterLayout } from 'loom-core/clusters'
import { mapNodeRadius, mapWireWidth } from 'loom-core/metrics'
import { attachAnnotations, compileTaxonomies } from 'loom-core/taxonomy'

export function mountSections(canvas: HTMLCanvasElement, overlay: HTMLElement, data: GraphData) {
  const terms = compileTaxonomies(data, {
    taxonomies: [{ id: 'section', label: 'Section', by: 'section' }],
  })
  const clusters = clusterLayout(data.nodes, terms.laneBy('section'), {
    dimensions: 3, spacing: 28, gap: 80, depth: 1,
  })
  const graph = createGraph(canvas, {
    ...data, mode: 'cloud',
    layout: { anchor: clusters.anchor, blend: 0.75, autoRotate: false },
    theme: {
      ...ink,
      nodes: { resolve: mapNodeRadius(data, 'contentSize', { curve: 'sqrt', range: [4, 18] }) },
      wires: {
        pattern: 'solid',
        byKind: { cites: { pattern: 'dashed' }, replicates: { pattern: 'dotted' } },
        resolve: mapWireWidth(data, 'connections', { curve: 'log', range: [0.75, 6] }),
      },
    },
  })
  const outlines = attachAnnotations(graph, overlay, terms, {
    bubbles: { section: true },
    boundary: { shape: 'cloud', padding: 14, fillOpacity: 0.1, strokeOpacity: 0.65 },
    boundaryFor: (term) => term.id === 'Optics' ? { color: '#74b6b1', width: 2 } : undefined,
  })
  return { graph, outlines }
}
```

`clusterLayout` sorts stable group and node IDs, sizes envelopes by membership and packs them into rows. Use `dimensions: 2` with Drift for disks or `dimensions: 3` with Cloud for volumes. `spacing` and `gap` use world units. `depth` scales the Z coordinate. `groups` exposes the members, center and radius of each envelope before depth scaling. Intermediate structure values retain spring response and node dragging. A blend of 1 uses exact anchors for movable nodes. Set `graph.setLayout({ anchor: null })` to restore native placement. Orbit uses hop rings and Lanes uses its lane classifier in the studio.

For topology-based placement, `connectedComponents(data)` returns a classifier suitable for a taxonomy or `clusterLayout`. Pass a link predicate such as `edge => edge.kind === 'contains'` to choose which relationships connect groups. Components ignore direction, include isolated nodes and use the lexically smallest member ID as their identifier. A section taxonomy can express overlapping membership. Placement uses its first term, and each enabled boundary includes all its members.

| Encoding | Inputs | Meaning |
| --- | --- | --- |
| Node radius | `degree`, `contentSize`, `complexity`, numeric accessor | Degree counts incident endpoints. Content size uses the supplied byte count, then UTF-8 bytes of content or summary. Complexity is supplied by the dataset. |
| Wire width | `connections`, `multiplicity`, `weight`, numeric accessor | Connections uses the higher of the two endpoint degrees. Multiplicity counts links between the same pair in either direction. A self-loop contributes two endpoints to degree. |
| Wire pattern | `solid`, `dashed`, `dotted` | Set globally, by kind or in `wires.resolve(link, index)`. The GPU draws each pattern on the same instanced wire pass. |
| Group boundary | `hull`, `cloud` | Hull encloses the projected markers. Cloud traces the union of padded marker discs on a bounded screen-space grid and retains holes and separate islands. Use `boundaryFor` for per-group overrides. |

Both metric helpers accept an explicit `domain`, a `range` and a `linear`, `sqrt` or `log` curve. The default domain spans finite observed values. Values outside an explicit domain clamp to the ends. A constant domain maps to the midpoint. Missing values inherit the underlying theme, and numeric zero participates in the scale. A typed accessor such as `paper => paper.metrics?.figures` can read a named metric or an application field. Node radii use world units before the global node multiplier. Wire widths use CSS pixels before Cloud depth shading.

Graph JSON and protobuf support node `section`, `summary`, `content`, `contentSize` (unsigned 32-bit bytes), `complexity`, link `weight`, and a `metrics` map of named finite numbers on either. Older graphs retain absent values. Custom application fields outside the protobuf schema can stay on the plain objects passed to the renderer.

The v0.1 protobuf encodes the fields declared in `proto/graph.proto`. Keep taxonomy definitions and application-specific node fields in your host data, or express membership through typed graph links when it needs to survive a binary round trip.

## Style a mounted graph

```js
graph.setTheme({
  ...knowledgeConsole,
  nodes: {
    ...knowledgeConsole.nodes,
    byKind: {
      ...knowledgeConsole.nodes.byKind,
      study: { shape: 'rounded-square', color: '#ff9d6b', radius: 9 },
    },
  },
  wires: {
    ...knowledgeConsole.wires,
    routing: 'patch',
    byKind: {
      ...knowledgeConsole.wires.byKind,
      concept: { color: '#e6c34a', opacity: 0.7, width: 1.8 },
    },
  },
  labels: { visibility: 'auto', density: 0.8, alternateSide: true },
})
```

Markers support circles, rings, squares and rounded squares. `nodes.scale` scales their world-space radii. `nodes.fill`, `nodes.ringWidth` and `nodes.artwork` control their paint. Wires support `arc`, `patch` and `straight` routes, with width in CSS pixels. Optional `nodes.resolve(node, degree)` and `wires.resolve(link, index)` override individual fields after the per-kind rules. These rules run when applying a theme, outside the draw loop. Wire colours, widths and opacities describe resting wires. Incident wires use the theme accent and `wires.hotWidth` on hover or selection. Labels support `auto`, `focus` (selection and neighbours, or the hovered node) and `none`. The optional world-space dot grid takes `spacing`, `color` and `opacity`.

## Data and rendering

- IDs are unique nonempty strings. Link endpoints reference those IDs. A node with both `x` and `y` stays pinned by default, including explicit zero values. Supply `pinned: false` to use those coordinates as a movable starting position. The presence of this flag survives a protobuf round trip. An unpositioned node can settle around pinned neighbours. A fully pinned graph schedules zero physics ticks.
- One instanced strip draw handles all wires. The vertex shader derives cubic control points and evaluates the curve. A floating-point position texture lets both endpoints refer to live node positions by index. Nodes use instanced SDF quads. Labels add one instanced draw for all accepted glyphs.
- Label placement gives priority to selection, hover and degree. A screen-space grid rejects overlapping boxes. Runtime raster glyphs are cached in a separate texture. Picking uses a CPU grid with the same projection as the vertex shaders.
- Each artwork URL occupies one 64-pixel cell. The first decoded image allocates a 2048 × 2048 atlas. A second sheet handles slots 1,025–2,048. Further unique images use the node's kind styling. Repeated URLs share a cell. Supply a node's `art` URL or an `art.urlFor(node)` callback.
- The built-in themes are `parchment`, `ink`, `blueprint` and `knowledgeConsole`. Custom themes use RGB hex colours, a canvas font family, a font size up to 96 CSS pixels, node radii and label halo opacity.
- The [protobuf schema](proto/graph.proto) preserves coordinate presence. `toBinary(graph)` returns a `Uint8Array`. `fromBinary(bytes)` accepts a `Uint8Array` or `ArrayBuffer` and returns ordinary nodes and links. Unknown fields are skipped. Truncated data raises an error. On the 25k-node, 100k-link fixture, protobuf occupied 2.80 MB and decoded in 57.3 ms. JSON occupied 6.72 MB and decoded in 26.7 ms.

## Simulation and lifecycle

The simulation uses a Barnes–Hut quadtree in flat layouts and an octree in cloud mode, with spatial-hash collision handling, springs, centring, pinning and alpha decay. Main-thread work yields between batches within a tick. The default slice budget is 3.5 ms.

The default switches to a module worker above 5,000 nodes. Override it with `sim: 'main'` or `sim: 'worker'`. Serve `layout-worker.js` next to `index.js`, or supply `workerURL` when a bundler relocates it. Cross-origin-isolated pages use two shared snapshot buffers. Other pages recycle transferable buffers. A worker startup failure falls back to the main-thread simulation.

A settled flat graph releases its animation callback. Manual pause, document visibility, viewport intersection and context loss each hold a separate suspension reason. Visible cloud mode tumbles after 1.5 seconds of inactivity. Reduced motion shows the live response to direct dragging and presents the final autonomous layout in one update. It also suppresses flick and idle tumble. Context restoration rebuilds GPU resources from the model.

## Knowledge console

The `loom-core/console` entry point exports `fromConsole`, `mountConsoleGraph`, `readConsoleTheme` and `consoleLayout`. The adapter maps the knowledge console's `{ nodes, edges }` to `{ nodes, links }` and retains the original objects and their metadata.

```ts
import { mountConsoleGraph } from 'loom-core/console'

const renderer = mountConsoleGraph(canvas, knowledgeGraph, useLoom, mountLegacyCanvas)
```

With the flag enabled, the adapter reads the host’s inherited `--kg-ink`, `--kg-dim` and six `--kg-<kind>` colours, and uses the console layout at 25% structure with temporary dragging. If the host switches colour schemes, call `graph.setTheme(readConsoleTheme(canvas))` on the Loom handle. The host supplies its feature flag and existing canvas mount function. Mount a fresh canvas when changing renderer type, since browsers associate a canvas with its first context type. The host owns its panels, links, picker and other DOM controls. Framework wrappers and activation in the console application are follow-up milestones.

## Verification

```sh
npm run build
npm run test:types
npm test
npm run size
npx playwright install chromium
npm run test:browser
LOOM_HEADFUL=1 npm run bench
```

The size gate includes both the core and optional worker and fails above 25,000 gzip bytes. Browser checks cover input, picking, idle callbacks, visibility, pause composition, both worker transports, exact and blended anchors, live spring response during uninterrupted drags, release, drag pinning and 3D picking, live marker and wire geometry, theme changes during context restoration, artwork and a 12-view visual baseline. Use `node scripts/browser.mjs --update-golden` to regenerate that baseline for review.

The performance workflow targets a hardware runner labelled `loom-perf`. The harness uses a 960 × 640 CSS-pixel canvas at DPR 1. Seven fresh-context trials create 1,000 nodes and 4,000 links. Submission ends after the first WebGL flush. Presentation uses the browser's first-contentful-paint entry in a blank document whose sole content is the graph. The 10 ms gate applies to every trial. The module evaluation probe times top-level execution separately.

Steady-state throughput counts completed WebGL fences over 72 camera-motion frames, including GPU drain. The same 5k and 25k positioned fixtures run once with the default renderer settings and once with the console preset, three wire kinds, patch cables, grid, lane guides and labels. Input latency measures trusted keyboard events during a live 5,000-node layout. The 25,000-node memory sample sums live JS heap growth, backing stores, explicit GL allocations and an estimate of the colour/depth framebuffer. Browser compositor and graphics-driver allocations are outside that measurement.

The [hardware results](benchmarks/m2-max.json) record raw startup samples, throughput, idle work, input latency, memory, settlement and codec timings. The standalone performance command exits unsuccessfully for any missed hard budget.
