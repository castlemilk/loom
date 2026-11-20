# Loom

[![Loom — Interactive graphs in TypeScript. A copper wire network with ceramic joints.](https://castlemilk.github.io/loom/illustrations/loom-social.jpg)](https://castlemilk.github.io/loom/)

Loom is a TypeScript library for interactive network diagrams and knowledge graphs. Give its WebGL2 renderer nodes and links, or draw a graph in Studio and export a working JavaScript or TypeScript project. Readers can drag clusters, trace relationships to their source, and open topics on demand from SQLite/WASM.

[Build your first graph](https://castlemilk.github.io/loom/docs/) · [Open a blank canvas](https://castlemilk.github.io/loom/studio/?example=blank) · [Explore Wikipedia](https://castlemilk.github.io/loom/studio/wikispeedia/) · [Browse the API](https://castlemilk.github.io/loom/docs/api/) · [MIT license](https://github.com/castlemilk/loom/blob/main/LICENSE)

## Draw your first graph

Copy the [current SDK install command](https://castlemilk.github.io/loom/docs/#install-loom). It pins the same build used in Studio, including preview releases hosted on GitHub Pages. Published npm releases can also be installed by name with `npm install loom-core`.

Add a canvas to the page and run this TypeScript after it mounts.

```html
<canvas id="map" style="width: 100%; height: 360px"></canvas>
```

```ts
import { createGraph, parchment } from 'loom-core'

const canvas = document.querySelector<HTMLCanvasElement>('#map')!
const graph = createGraph(canvas, {
  nodes: [{ id: 'music', label: 'Music' }, { id: 'sound', label: 'Sound' }],
  links: [{ source: 'music', target: 'sound' }],
  theme: parchment,
})
graph.on('open', id => graph.focus(id))
```

Double-click a node to focus it. Call `graph.destroy()` when removing the canvas. The quickstart has a complete five-node example and a live preview. [Build your first graph](https://castlemilk.github.io/loom/docs/)

## Try a demo, then build it

| Explore in the studio | What to try | SDK guide |
| --- | --- | --- |
| [Music → Sound on Wikipedia](https://castlemilk.github.io/loom/studio/wikispeedia/?connections=music,science&edge=74%3A2863) | Inspect the archived passage, then show both articles on the map. | [Stream topics with SQLite/WASM](https://castlemilk.github.io/loom/docs/atlas/#inspect-links-across-topics) |
| [Canva’s relationship cards](https://castlemilk.github.io/loom/studio/cards/) | Select a founder or investor and follow the evidence for their connection. | [Build relationship cards](https://castlemilk.github.io/loom/docs/navigation/#open-relationship-cards) |
| [Weighted connections](https://castlemilk.github.io/loom/studio/?example=wires#settings-style) | Change a wire’s stroke and animate the direction of travel. | [Draw and style connections](https://castlemilk.github.io/loom/docs/drawing/#draw-a-connection) |
| [Generated stress graph](https://castlemilk.github.io/loom/studio/?example=stress) | Open **Perf**, pan the map, and watch frame times as it settles. | [Measure performance](https://castlemilk.github.io/loom/docs/performance/) · [Optimise large graphs](https://castlemilk.github.io/loom/docs/optimisations/) |

Start from a named article in the [Bauhaus graph](https://castlemilk.github.io/loom/examples/bauhaus/) or the [Outer Solar System graph](https://castlemilk.github.io/loom/examples/outer-solar-system/). Each index lists outgoing links and opens that article in Studio. The example datasets retain their source licenses.

For an AI integration, start with the worked graph edit and its revision checks. Tools can read the same documentation as Markdown and discover the SDK’s public imports from `loom-core/api-index.json`. [AI tooling guide](https://castlemilk.github.io/loom/docs/ai-tooling/) · [Markdown index](https://castlemilk.github.io/loom/llms.txt) · [API index](https://castlemilk.github.io/loom/docs/api-index.json) · [SDK roadmap](https://castlemilk.github.io/loom/docs/roadmap/)

## Edit a graph

Start with a blank canvas or edit a demo. Choose **Node** to create a record and **Connect** to link two nodes. Click a node to edit its properties and connections. **JSON** previews and applies the same commands as the controls. [Open a blank canvas](https://castlemilk.github.io/loom/studio/?example=blank)

Choose **Export** to download a runnable JavaScript or TypeScript project, or copy the mount code and download `scene.json` for your own app. The scene carries the visible graph, its layout and drawing style, with optional positions and camera. **Download full graph data** saves the entire document for editing again. [Use a studio export in your app](https://castlemilk.github.io/loom/docs/editing/#export-a-graph-to-your-app)

For integrations, import `createEditor` from `loom-core/editor`. Discover commands with `describe()`, query nodes or links, preview a revision-guarded batch and read back the result. The [authoring API guide](docs/editor-api.md) covers examples, six operations, undo, checkpoints, viewport coordinates, hosting and extension points. The [transaction schema](https://castlemilk.github.io/loom/editor.schema.json) is machine-readable.

## Draw and animate connections

Open **Style → Connection drawing** in the [weighted connections example](https://castlemilk.github.io/loom/studio/?example=wires#settings-style). Parallel and reciprocal links take separate paths. Self-loops fan around their node. Choose **Arrows** for static direction or **Flow** for a pulse travelling from source to target. Limit the cue to a selected node or show it across the graph. The **Connect** tool previews the path and rings its target before you commit.

```js
import { createWireGraph } from 'loom-core/wires'

const graph = createWireGraph(document.querySelector('canvas'), {
  nodes: [{ id: 'reader' }, { id: 'paper' }],
  links: [{ id: 'cites', source: 'reader', target: 'paper' },
          { id: 'reviews', source: 'reader', target: 'paper' }],
  wireEffects: { direction: 'flow', scope: 'selected', separation: 18, speed: 48 },
})
graph.select('reader')
graph.setWireEffects({ direction: 'arrow' })
```

| Setting | Values | Default |
| --- | --- | --- |
| `separation` | 0–96 CSS pixels between adjacent paths at their midpoint | 14 |
| `direction` | `none`, `arrow`, `flow` | `arrow` |
| `scope` | `selected` for incoming and outgoing links of the selection, or `all` | `selected` |
| `speed` | 0–240 CSS pixels per second. Zero holds a static arrow. | 48 |

`getWireEffects()` returns an immutable settings snapshot. `setWireEffects(patch)` validates the whole patch and updates the mounted graph. The [wire settings schema](https://castlemilk.github.io/loom/wire-effects.schema.json) is also exported as `wireEffectsSchema` for tool definitions and form generation. These settings belong to the view. Hosts can persist them alongside their graph document.

Stable link IDs determine the order of parallel paths across input reordering and protobuf round trips. Anonymous links follow input order. Strokes, arrowheads and pulses share one instanced wire draw. Reduced motion displays static arrows. Pausing the graph, hiding the page or moving the canvas offscreen suspends the pulse. The base `createGraph` entry point loads the original wire renderer.

## Explore the Wikipedia atlases

### Wikispeedia at 4,604 articles

Open a topic to reveal its articles. Opening another adds the hyperlinks between them and keeps existing nodes and the camera in place. Pick an article to read it on Wikipedia or open a labeled card view of its visible neighbors. Links to the studio preserve the open topics and loading mode. [Try the topic map](https://castlemilk.github.io/loom/studio/wikispeedia/) · [Start in Mathematics](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=mathematics)

Use **Layout** above the map to choose the original **Topic grid**, **Drift** with link-based spacing, **Lanes** by topic size, **Orbit** with rings of connected topics, or a rotatable **3D Cloud**. Switching layouts preserves open topics, the selected article, and hand-placed offsets. It uses the topic overview and cached articles. [Try Music in Orbit](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&layout=orbit)

Double-click Music, then switch from **Topic grid** to **Orbit**. Music stays centered as its 96 articles form rings, with the most-linked articles nearest the center. Adjust **Layout speed** even during a move. At 1× the trip takes 0.7 seconds, at 0.25× it takes 2.8 seconds. The URL remembers the speed and the **Animate layouts** toggle. System reduced motion makes layout changes immediate. [Follow Music at quarter speed](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&speed=0.25) · [Instant comparison](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&transition=instant)

Double-click, double-tap or press **Enter** on a topic or article to follow it. A closed topic opens when focused. Following keeps the node centered across later layout changes. Panning, zooming and **Fit view** release the camera.

With **Wikipedia node images** enabled, the map requests lead images for the selected article, the open topic when it has a matching article, and a few well-spaced articles in the zoomed view. Cards and the article inspector share the same lookups. Select an image-bearing article and open **Image credits** for its file description, author and license. Images come from current Wikipedia pages. [Compare with images off](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&speed=0.25&images=off)

Drag the Music dot or its name. Under **Article motion → Spring**, lower **Spring strength** for a longer trail or raise it for a tighter follow. Lower **Damping** lets articles swing past their resting positions. At 100%, a resting article approaches a fixed target directly. **Reset tuning** restores 1× strength and 100% damping. The URL includes both slider values and the layout. [Try a loose spring](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&strength=0.5&damping=0.45) · [Try a tight spring](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&strength=3&damping=1)

**Rigid** moves all 96 articles in step with Music. You can move a closed topic before its first data read or arrange individual articles. Arrow keys move a focused topic and Shift takes a larger step. Turn off **Move articles with their topic** to move its dot alone. The studio saves resting offsets in this browser. **Reset positions** restores the selected layout's arrangement. Reduced motion uses immediate movement. [Compare Rigid](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music&motion=rigid)

Select a line between topics or choose **Explore connections** to inspect the underlying articles. Mathematics and Computing share 52 hyperlinks, with 23 pointing from Mathematics to Computing and 29 in the reverse direction. Search the pair list, inspect a link's original section and anchor, then choose **Show link on map** to frame both endpoints. Evidence loads only for the topic pair being inspected. [Explore Mathematics and Computing](https://castlemilk.github.io/loom/studio/wikispeedia/?connections=mathematics,computing)

**On demand** starts with 16 topic summaries. A dedicated SQLite/WASM worker reads indexed database pages over HTTP byte ranges on the first expansion. Reopening a cached topic costs no graph reads. **All at once** loads the same articles and edges from one JSON file. Switch modes with topics open to compare the same view, or turn off **Keep camera in place** to center each new topic. The sidebar reports uncompressed graph payload bytes and data reads. The overview and the separately cached SQLite runtime have their own download cost. [Full-download comparison](https://castlemilk.github.io/loom/studio/wikispeedia/?loading=full)

The historical Wikispeedia graph contains 119,882 directed hyperlinks. Each article uses its first listed subject, with six unclassified articles. The overview draws each subject’s two strongest connections. Expanding every subject reveals every recorded hyperlink. Regenerate both data files with `python3 scripts/build-wikispeedia.py`. The script verifies the source archive against a recorded SHA-256 digest. [Stanford SNAP dataset and citations](https://snap.stanford.edu/data/wikispeedia.html)

The evidence index maps 79,126 of 79,128 cross-topic hyperlinks to their original HTML anchors. It includes a short passage for 58,816 links. For the other links, the inspector identifies the anchor or the dataset record and links to the archived page. To rebuild it from the SNAP HTML archive, use `uv run --with lxml scripts/index-wiki-connections.py wikispeedia_articles_html.tar.gz` with Python 3.11 or later. The 2007 Schools Wikipedia Selection credits Wikipedia contributors under the GNU Free Documentation License. [Archived edition](https://dlab.epfl.ch/wikispeedia/wpcd/index.htm) · [License](https://dlab.epfl.ch/wikispeedia/wpcd/wp/w/Wikipedia_Text_of_the_GNU_Free_Documentation_License.htm)

```ts
import { parchment } from 'loom-core'
import { atlasConnections, createAtlas, createFullAtlasReader } from 'loom-core/atlas'
import { createSQLiteAtlasReader } from 'loom-core/atlas-sqlite'
import { mountAtlasMap } from 'loom-core/atlas-map'

const base = new URL('./examples/wikispeedia/', siteURL)
const manifest = await (await fetch(new URL('manifest.json', base))).json()
const atlas = createAtlas(manifest, {
  'on-demand': () => createSQLiteAtlasReader({
    database: new URL(manifest.database, base), databaseBytes: manifest.databaseBytes, pageSize: manifest.pageSize,
    worker: new URL('sqlite.worker.js', runtimeURL), wasm: new URL('sql-wasm.wasm', runtimeURL),
  }),
  full: () => createFullAtlasReader(new URL(manifest.full, base)),
})
const map = mountAtlasMap(canvas, atlas, { theme: parchment, keepView: true, animateLayouts: true, moveMembers: true, memberMotion: 'spring',
  spring: { strength: 0.5, damping: 0.45 },
  onPick: node => { if (node.kind === 'topic') void atlas.toggle(node.topic) },
  onOpen(node) {
    if (node.kind === 'topic') void atlas.setExpanded(new Set([...atlas.getSnapshot().expanded, node.topic]))
    map.focus(node.id)
  },
})
atlas.setLayout('orbit') // works before or after expanding topics
map.setSpring({ damping: 0.8 }) // keeps the current strength and velocity
map.moveTopic(1, { x: -140, y: -175 }) // Music and its articles, even before loading
// map.setMemberMotion('rigid') switches a running map back to the library default.
await atlas.setExpanded([8, 12]) // Mathematics and Computing in this edition
const topics = atlasConnections(manifest, 8) // directional counts from the overview
const links = atlas.crossings(8, 12) // actual article pairs from the two loaded topics
// Pass map.getPositions() as the next mount's positions option to restore a layout.
await atlas.setLoading('full')
// On unmount
map.destroy()
atlas.close()
```

`loom-core/atlas` exports `atlasLayouts` and the `AtlasLayout` type. Read the active layout from `atlas.getSnapshot().layout`. `loom-core/atlas-map` exports `atlasSpringControls` with the ranges, defaults and steps for each slider. Strength ranges from 0.25 to 4 and damping from 0.2 to 1. Both default to 1. `map.getSpring()` returns the current values.

Layout animation is opt-in when embedding the library. Use `animateLayouts: true` at mount or `map.setAnimateLayouts(true)` at runtime. Setting it to false finishes the current move immediately. Set `layoutSpeed` at mount or call `map.setLayoutSpeed(0.25)` during a move. The `atlasLayoutSpeed` export describes the slider range of 0.1× to 2×. External labels can call `map.pick(id)` for a pointer activation and `map.open(id)` for keyboard activation. By default, opening a topic reveals its articles and calls `map.focus(id)`. Read the followed ID with `map.getFollowedNode()` or subscribe with the `onFollowChange` option.

`createWikipediaImages()` from `loom-core/wikipedia-images` provides an optional asynchronous image source. Call `await images.lookup(title)` for a visible node to get its thumbnail URL, dimensions, canonical title and file-credit link, or `null`. Concurrent lookups share a request. The source follows redirects, caches hits and misses, and backs off on service errors. Call `images.cancel()` when the view closes. The studio uses the free-image filter from the same MediaWiki extension that supplies Wikipedia’s Open Graph images. [MediaWiki PageImages](https://www.mediawiki.org/wiki/Extension:PageImages#API)

Host the two files from `loom-core/atlas-runtime/` together under `runtimeURL` on the page’s origin. The server must return byte ranges from the uncompressed SQLite file. Pass its published `databaseBytes` so the reader knows its actual size even when a CDN compresses ordinary GET or HEAD responses. A custom `AtlasReader` can supply the same topic blocks from another source. Its article IDs occupy each manifest topic’s contiguous range starting at `first`. Each block owns its articles’ outgoing edges, including links into other topics. [SQLite HTTP reader](https://github.com/phiresky/sql.js-httpvfs)

### Relationship cards

Double-click or double-tap a card to center and magnify it with its connected lines in view. Press Enter on a focused card for the same action. An embedded card graph can call `cards.focus(id)` directly or disable the gesture with `focusOnOpen: false`.

The SVG renderer accepts ordinary Loom nodes and links. Give cards explicit world coordinates to reproduce an existing diagram, or supply a root and let Loom arrange the surrounding cards. Logo images fall back to initials. Pills name relationships where space permits. Selecting a card highlights its links. Drag it or use its arrow keys to move it. The demo inspector links each relationship to its source. [Around Canva](https://castlemilk.github.io/loom/studio/cards/)

In the regular studio, select any node and choose **View relationship cards** to inspect up to eight neighbors, including nodes in imported graphs. The library helper `cardNeighborhood(data, root, limit)` retains directed links, reciprocal links and self-loops for the neighbors shown. Set `useNodePositions: false` to arrange cards for readability or `showArrows: true` to display edge direction.

```ts
import { createCardGraph } from 'loom-core/cards'

const cards = createCardGraph(svg, data, {
  root: 'startup:canva', image: node => node.logoURL, badge: node => node.kind,
  relationship: edge => edge.label, onSelect: node => inspect(node.id),
})
cards.setOptions({ appearance: 'dots', showLabels: false, showPorts: false })
cards.destroy()
```

### Curated Wikipedia collections

Choose either collection from the studio’s **Graph** menu.

| Collection | Articles | Directed links | Topics |
| --- | ---: | ---: | --- |
| [Bauhaus snapshot](demo/atlases/bauhaus.json) | 15 | 52 | Schools, designers and works |
| [Outer Solar System snapshot](demo/atlases/outer-solar-system.json) | 16 | 62 | Worlds, moons and spacecraft |

Pick a topic to see its members. **Beyond this group** lists the outside nodes connected to those members, ordered by the number of crossing links. Select an article to read its description, open its Wikipedia revision, or follow an incoming or outgoing link across the atlas. **Back** returns to the previous selection and camera position. Press **/** to search names, IDs, sections, kinds and summaries. Enter opens the first match. An **Article permalink** reopens its neighborhood, for example `/studio/?example=bauhaus&article=Anni_Albers`.

The collections index links between selected English Wikipedia articles. For each article, the indexer counts direct links in prose paragraphs, excludes self-references, and retains up to four destinations. Link weight is the number of occurrences. First mention breaks ties. Builds and browsing use the bundled snapshots. Run `python3 scripts/index-wikipedia.py` to rebuild from recorded revisions or pass `--latest` to capture a fresh edition. The article descriptions are by English Wikipedia contributors. The JSON records each source revision in `wikipediaRevision`. [Corpus definition](demo/atlases/catalog.json) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

```ts
import { createGraphIndex } from 'loom-core/explore'
import { createDrilldown } from 'loom-core/drilldown'

const index = createGraphIndex(data)
const matches = index.search('laszlo', { limit: 5 })
const outbound = index.neighbors('Anni_Albers', 'outgoing')
const bridges = index.boundary(['Anni_Albers', 'Josef_Albers'])
const navigation = createDrilldown(data)
navigation.followNode('Black_Mountain_College')
navigation.back()
```

Search accepts an optional `within` set of node IDs. It folds accents and ranks exact names and IDs ahead of prefixes, substrings and metadata matches. Neighbor rows retain the actual links, including parallel edges. Boundary rows count incoming and outgoing links relative to the supplied members. Rebuild the index when the graph document changes. `openNeighborhood` drills into the current view. `followNode` searches the original graph and adds a breadcrumb from the current view.

## Sketchbook styling

In **Style**, choose **Sketchbook**, then try the paper swatches, marker fills, hatch spacing, linework and outline width. To style a single node, select it and open **Marker style**. Its ink and shape support undo, redo and JSON export. In the library, the optional `markerColor` and `markerShape` node fields override the theme for that node and survive a protobuf round trip.

```ts
import { createWireGraph, sketchbook } from 'loom-core/wires'

const graph = createWireGraph(canvas, {
  ...data, theme: sketchbook,
  drawingStyle: { fill: 'hachure', roughness: 1, hatchSpacing: 5 },
})
graph.setDrawingStyle({ fill: 'cross-hatch', roughness: 2 })
```

`fill` accepts `solid`, `hachure` or `cross-hatch`. `roughness` ranges from 0 to 2 and affects both marker outlines and wire curves. `hatchSpacing` ranges from 2 to 16 CSS pixels. The defaults are solid fill, zero roughness and 5 px spacing. The strokes stay still between frames. Hosts can store `getDrawingStyle()` alongside the view and discover settings through `drawingStyleSchema` or `loom-core/drawing-style.schema.json`.

## Run the studio

Use Node.js 22 or later.

The [Loom field guide](https://castlemilk.github.io/loom/) is the entry point for the demos. Run the wire model on the page, open a preset in the full editor, or visit the [artwork catalogue](https://castlemilk.github.io/loom/artwork/) for the four settings illustrations, model geometry, mark and palette. The [art direction](DESIGN.md) documents the visual system.

The [hosted graph studio](https://castlemilk.github.io/loom/studio/) is a Next.js static export. It includes the 25-node excerpt in the initial page and uses TanStack Query to fetch and cache the full graph on demand. Tailwind CSS styles the responsive controls. The framework dependencies live in `web/`.

Open the [Section atlas](https://castlemilk.github.io/loom/studio/?example=clusters) to explore 45 nodes and 88 relationships across four synthetic notebooks. Rotate the Cloud or drag a node to see its section boundary follow. In **Taxonomies**, switch **Group by** to **Connected component** to find the two sets joined by citations. **Group bubbles** controls contour shape, padding, fill, stroke and individual group visibility. **Appearance** maps node radius and wire thickness to fields, with editable scale curves and output ranges. **Style controls → Kind stroke** assigns a pattern to a specific relationship.

In **Taxonomies**, choose **Category** and open **Group bubbles** to outline a single knowledge category. Outlines from several taxonomies can be visible together. **Define a taxonomy** accepts JSON field or relationship mappings, and **Display language** edits the connection and unassigned-lane labels. Applied definitions and language are saved in this browser. Drag the separator to change the graph width, or its height on a narrow screen. The arrow keys adjust the separator and Enter restores its starting size.

The illustrated **Explore**, **Layout**, **Groups** and **Style** tabs switch the editor panel and preserve your edits. Use the arrow keys to change tabs and Tab to enter the controls. A link ending in `#settings-groups` opens **Groups** directly. Switch off **Show group bubbles** there to hide every boundary. Switch it on to restore the chosen groups. Layout clustering, lane labels and group navigation work with either setting. Add `bubbles=off` to a studio URL to start with boundaries hidden.

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

Visit `http://localhost:3000/loom/` for the guide and `http://localhost:3000/loom/studio/` for the editor. Existing root links with studio settings or example parameters forward to the editor. To reproduce the Pages build, run `npm run site:build`. GitHub Actions tests the export under the repository path before deploying it. Set `PAGES_BASE_PATH` to an empty string for a root-domain export.

For the standalone core demo, run:

```sh
npm ci
npm run dev
```

Open the URL printed by the server. The studio opens a 25-node, 30-link excerpt of the benebsworth.com knowledge console, with offline artwork. The graph picker includes both Wikipedia atlases, the full 508-node console and a generated 100–25,000-node stress graph. In an atlas, choose an **Article** to see its source and follow its outgoing links. Move **Structure** between free physics and an exactly positioned diagram. **Spacing & forces** adjusts lane geometry and spring behaviour. **Style controls** edits marker shapes, colours, fill, linework, wire weights and labels in place. Select a node to pin or release it. Open **Simulation & diagnostics** to switch transports or sample the counters. For a single HTML file with both Wikipedia atlases embedded, run `npm run demo:build` and open `artifacts/loom-studio.html`.

## Use the core

The [package quickstart](#draw-your-first-graph) uses the typed ESM package. To run the following HTML directly from a checkout, build the library with `npm run build` and serve the checkout over HTTP. Its `dist` directory includes the core, optional entry points, and the layout worker.

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
| `on(event, callback)` | Subscribe to `select`, `nodeclick`, `backgroundclick`, `hover`, `open`, `modechange` or `destroy`. Selection and hover deliver a node ID or `null`. `nodeclick` reports each completed pick, including a second pick on the same node to draw a loop. The return value unsubscribes. |
| `getFrame()`, `onFrame(callback)` | Read projected points synchronously, including while paused, or subscribe to paints for a custom overlay. Screen positions and radii use CSS pixels in input node order. Copy the borrowed points to retain them across updates. |
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
    showBoundaries(visible: boolean) { annotations.setOptions({ bubblesVisible: visible }) },
    showAllSubjects() { annotations.setOptions({ bubbles: { subject: true, category: ['physics'] } }) },
    destroy() { graph.destroy(); canvas.remove(); overlay.remove() },
  }
}
```

`by` accepts a string-valued field, an array-valued field, a relationship endpoint, or a typed classifier such as `(node, context) => context.linksFor(node.id).length ? 'connected' : 'isolated'`. Relationship groups include their hub and its incident members. `remap` translates raw values to one or more term IDs. Multiple memberships are deduplicated. All apply to bubbles and tooltips, and the first determines exclusive lane placement. Unassigned nodes get their own lane. Term labels, descriptions and colours are independent of the raw IDs.

`legend(id)` returns ordered groups, display properties and member indices. `describe(nodeId)` returns the title, formatted count and full membership. For custom tooltip content, supply `language.tooltip(node, description)` returning `{ title, lines }`. Text renders literally. Outlines and lane captions follow the camera, node drags and canvas resizes on the engine's existing paint cycle. `setOptions({ bubblesVisible: false })` hides every outline and its hit area. Visibility defaults to true. `setOptions({ bubbles: {} })` clears the group choices. Destroying the graph also releases its annotations.

## Drilldowns and group interactions

Open **Optics** in the legend or click the space between its nodes in the [Section atlas](https://castlemilk.github.io/loom/studio/?example=drilldown). Its eight members spread out while its links to other sections stay visible. Click the same legend entry to collapse it. A click on a child selects it. Double-click or press Enter on a selection to focus the camera. In **Drilldown settings**, change **Double-click / Enter** to **Open neighbors** to explore a neighborhood. Use Back, an ancestor breadcrumb or Escape on the canvas to return.

The [Optics members demo](https://castlemilk.github.io/loom/studio/?example=drilldown&group=Optics&bubbles=off) opens the notebook hub and its seven child nodes in Orbit, with 14 internal links. Select a name under **Explore** to inspect that node. **In context** brings back the surrounding atlas. **Members only** isolates the same group again. Both views share a breadcrumb and the full member list. Larger groups show eight rows per page and search matches names and IDs across every page. The `group` parameter accepts the Section atlas term ID, including `Materials`, `Tides` and `Acoustics`.

In **Explore**, **Open a group** switches between in-place expansion, an isolated group with its internal links, and disabled navigation. **Drilldown settings** lets you choose the node actions, bubble gesture, open boundary, member arrangement, spacing, expansion strength and detail layout. The group buttons also work with a keyboard. Search finds nodes in the current view.

The Section atlas enables **Style → Style controls → Allow labels on either side**. This lets the renderer place a name to the left of its marker when it would cross the right edge. A single isolated group has dedicated space for its breadcrumb and toolbar.

The release includes captures from the same browser interaction tests. [Desktop overview](https://castlemilk.github.io/loom/previews/atlas-desktop.png) · [Expanded desktop group](https://castlemilk.github.io/loom/previews/atlas-desktop-expanded.png) · [Optics members](https://castlemilk.github.io/loom/previews/atlas-optics-members.png) · [Mobile members](https://castlemilk.github.io/loom/previews/atlas-mobile-members.png)

| Library option | Behavior |
| --- | --- |
| `selectAction`, `openAction` | Choose `inspect`, `focus`, `neighbors` or `group`, globally or per node. Supply `groupFor(node)` for the group action. |
| `groupAction` | Set `expand`, `isolate` or `none`, or return one per taxonomy or term from a callback. |
| `setGroupView('isolate' \| 'expand')` | Switch the current group's view with one update. Links and outside nodes come from its parent scope. Returns false at a node, at the overview or when already in that view. |
| `getSnapshot().groupMembers` | The complete typed member nodes in parent source order, deduplicated by ID. The same array survives selections and view switches. Empty outside a group. |
| `inspect(id)` | Select a node for an inspector independently of the configured canvas gesture. Pass null to clear. |
| `arrangement`, `memberSpacing`, `spread` | Rings place coincident nodes on spaced targets in the camera-facing plane captured when a Cloud group opens. You can orbit those targets afterwards. Radial expansion follows previous directions. Default ring targets are 28 world units × 2 apart. The studio scales spacing with node size. |
| `expansionBlend` | Defaults to 0.7. Intermediate values let springs and repulsion respond to dragging. At 1, movable nodes use the exact targets. Pinned nodes keep their positions. |
| `neighborhood`, `detail` | Set hop count, direction and a typed link filter. `openNeighborhood(id)` uses the current scope. `followNode(id)` can cross group boundaries. Isolated detail uses free Drift by default. Pass an empty detail object to inherit the overview layout. |
| `getTrail()` | Read the level and selected node at each breadcrumb, including the article from which a reference was followed. |
| `bubbleLabels` (annotations) | Show the names of visible group boundaries on the canvas. With an `onOpenGroup` callback, each name becomes a keyboard-accessible button. Defaults to false. |
| Annotation options | `groupGesture` accepts `click`, `double-click` or `controls`. The opened boundary can use `outline`, `fade`, `hide` or `keep`. Set `activeGroup.shape` to change its geometry. The studio uses one unfilled hull around expanded rings. Child nodes and labels take priority over a boundary. |

The framework-independent controller ships in `loom-core/drilldown`. Its snapshot supplies nodes and links in source order, a selection and a navigation path. On a scope change, remount with the new data. A bound in-place expansion keeps the same data and renderer. Apply the resolved layout when navigation or configuration changes. Back restores the parent positions, selection and saved camera, and incorporates current pins. Hosts without viewport controls can fit the restored positions.

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

`clusterLayout` sorts stable group and node IDs, sizes envelopes by membership and packs them into rows. Set `aspectRatio` to a preferred width divided by height for the packing area. It defaults to 1. Use `dimensions: 2` with Drift for disks or `dimensions: 3` with Cloud for volumes. `spacing` and `gap` use world units. `depth` scales the Z coordinate. `groups` exposes the members, center and radius of each envelope before depth scaling. Intermediate structure values retain spring response and node dragging. A blend of 1 uses exact anchors for movable nodes. Set `graph.setLayout({ anchor: null })` to restore native placement. Orbit uses hop rings and Lanes uses its lane classifier in the studio.

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

The first draw contains nodes and Bézier wires. By default, unpositioned nodes start on a deterministic golden-angle spiral. A structured layout can seed them on diagram anchors or blend the two positions. Force layout, label rasterization and artwork loading begin on later frames.

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

Maintainers can prepare a tested npm archive from GitHub Actions, bootstrap the first release, and publish subsequent versions by tag. [npm release instructions](https://github.com/castlemilk/loom/blob/main/docs/npm-release.md)

In the recorded M2 Max run, a 1,000-node graph first appeared in 27.3–40.5 ms across seven fresh contexts, above the 10 ms first-paint target. A clear-only canvas took 19.2–20.5 ms. In separate trials the layout settled in 295 ms, and camera movement with the console theme sustained 118.9 fps at 5,000 positioned nodes and 118.1 fps at 25,000 nodes and 100,000 links. Both camera trials used four draw calls. The benchmark revision’s core and worker measured 23,945 bytes gzipped. [Hardware measurements](benchmarks/m2-max.json) · [How to reproduce the benchmark](https://castlemilk.github.io/loom/docs/performance/#reproduce-a-comparison)

`npm run bench:contours` measures boundary CPU time for 25,000 projected nodes in 32 groups. It reports the median, p95 and number of rebuilt paths over 100 frames for a single moving group and for movement across every group. Selection-only paints reuse existing paths.

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
