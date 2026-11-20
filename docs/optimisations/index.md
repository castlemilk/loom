# Optimise large graphs

Trace a slow interaction to the work behind it. Compare worker layouts, labels, artwork and incremental loading while keeping the graph and camera consistent.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/optimisations/)

## Reduce the first download

For a reader who opens one Wikipedia topic, start with the topic manifest and fetch that topic’s articles. The Wikispeedia demo has 4,604 articles and 119,882 directed links. Opening Music brings 96 articles into view. Close and reopen Music in the same on-demand session and compare `atlas.getSnapshot().reads` before and after. The cached block costs zero additional graph reads.

Open Music in the two modes below. Keep Wikipedia images off in both and use a fresh page for each cold run. Compare **graph payload** bytes and requests in the sidebar, then inspect the browser network panel for the worker, WASM binary, manifest and total transfer. A user who visits every topic can make a single full download worthwhile. [On-demand Music](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music\&images=off) · [Full-download Music](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music\&images=off\&loading=full)

With the published fixture, a cold Music expansion read **160 KiB in five range requests**. The full JSON reader loaded **1,517,612 bytes in one request** to show the same 96 articles. These counts cover uncompressed graph payloads. The SQLite worker and WASM download have their own cold-start cost.

If the app always needs the entire graph, compare JSON with `toBinary` and `fromBinary`. In the recorded 25k-node fixture, protobuf used 2.80 MB and decoded in 57.3 ms. JSON used 6.72 MB and decoded in 26.7 ms. These are payload sizes before HTTP compression. Measure compressed transfer and decode on your target device. Keep custom fields that the protobuf schema cannot represent in your application data. [Codec measurements (JSON)](https://castlemilk.github.io/loom/benchmarks/m2-max.json) · [Graph schema](https://github.com/castlemilk/loom/blob/main/proto/graph.proto)

## Keep dragging responsive

If the camera moves smoothly over positioned nodes but dragging during layout stalls, compare the physics transports. The default uses a worker above 5,000 nodes when simulation starts. Force the comparison with `sim: 'main'` and `sim: 'worker'` at mount, keeping the seed and placement identical. Check `graph.stats().transport` after simulation ticks begin. Shared buffers require a cross-origin-isolated page. Other pages use transferable buffers, and a worker startup failure falls back to the main thread.

This overview uses focused labels and starts with artwork disabled. Copy `node_modules/loom-core/dist/layout-worker.js` to your app’s public assets. Pass its served URL as `workerURL`. The Loom demo hosts it at the site root. [Layout worker](https://castlemilk.github.io/loom/layout-worker.js)

`large-graph.ts`

```ts
import { createGraph, parchment, type GraphData } from 'loom-core'

export function mountOverview(canvas: HTMLCanvasElement, data: GraphData, workerURL: URL) {
  return createGraph(canvas, {
    ...data,
    sim: 'worker',
    workerURL,
    layout: { autoRotate: false },
    theme: {
      ...parchment,
      labels: { visibility: 'focus' },
      nodes: { ...parchment.nodes, artwork: false },
    },
  })
}
```

Authored `x` and `y` pin a node by default. For a camera-only baseline, use a completely positioned, pinned fixture and verify that `simTicks` stays flat. For the layout test, set `pinned: false` on those same coordinates so the solver has work to do.

## Spend detail where it can be seen

At overview scale, hundreds of nearby labels compete for the same pixels. With `labels.visibility: 'focus'`, hovering or selecting a node reveals context. To isolate label cost, keep the other theme fields identical, switch just the visibility between `'auto'` and `'focus'` with `graph.setTheme`, and repeat the same pan. Record `stats().labels`, draw calls and active p95.

For artwork, compare fresh mounts with `nodes.artwork` enabled and disabled. Repeated artwork URLs share a tile. Use the browser network panel for requests and `stats().imageTiles` for loaded tiles. The Wikipedia image source can batch visible or selected titles, cache missing results and cancel pending lookups. The atlas guide shows how to keep a late thumbnail from replacing the current selection. [Fetch a Wikipedia node image](https://castlemilk.github.io/loom/docs/atlas/index.md)

Use SVG relationship cards for the neighborhood someone is inspecting. Bound it with `cardNeighborhood(data, id, limit)` so article pagination or a high-degree hub cannot add thousands of DOM elements in one interaction. [Open relationship cards](https://castlemilk.github.io/loom/docs/navigation/index.md)

## Let a finished map sleep

If the frame count keeps rising at rest, check for a host animation loop, Cloud’s idle rotation or a wire flow effect. For a static comparison, use `graph.setLayout({ autoRotate: false })` and a static arrow on a wire graph. Let the layout settle and compare two frame and tick readings a second apart.

Use `onFrame` for overlays that follow painted positions. Reuse projected geometry on selection-only paints when the frame’s `projectionVersion` is unchanged. Refresh styles and selection independently. Detach listeners when leaving the view, and call `destroy()` on the graph when its canvas is removed. [Read frame timings](https://castlemilk.github.io/loom/docs/performance/index.md)
