# Measure graph performance

Watch a graph move and settle on your device. Learn which numbers describe loading, drawing, layout work and time between frames.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/performance/)

## Watch a graph draw and settle

Switch to Orbit, drag a node, then let go. **Frames** counts submitted graph paints over the lifetime of this canvas. **Graph FPS** falls back to zero when Loom finishes drawing. Try the same gesture again and watch the count resume.

[See live timing readings on your device](https://castlemilk.github.io/loom/docs/performance/#watch-a-graph-draw-and-settle)

The readout comes from the graph on this page. A five-node patch makes the transition to idle easy to see. Use the studio’s generated graphs to measure how a device handles a larger workload. [Open the stress graph and choose Perf →](https://castlemilk.github.io/loom/studio/?example=stress)

## Read the frame timings

- **Graph FPS** counts paints submitted in the recent one-second window. **Active p95** is the 95th percentile of positive intervals between paints in that window. A p95 of 24 ms means roughly one interval in twenty took at least that long. At 60 Hz a frame lasts about 16.7 ms.
- **Main thread** measures the average time inside Loom’s scheduler callback. Worker execution, your application’s other JavaScript, and browser layout can consume time elsewhere in the frame.
- **GPU draw** is the latest asynchronous GPU timer sample. `waiting` means a valid result has yet to arrive, `unavailable` means timing is unsupported, and `disjoint` means the timing was interrupted. Preserve those states in a report. A zero would imply a measurement.
- **Idle** means the recent window contains no scheduler samples. A resting flat graph can keep its last image on screen with zero paints per second. A fresh drag should wake it.

The optional observer publishes up to four times per second and gives one final idle reading once work clears. Keep one timing observer per graph and share its readings between any panels. Call the returned function when the panel closes. Destroying the graph also releases the observer.

`frame-times.ts`

```ts
import type { LoomGraph } from 'loom-core'
import { observePerformance } from 'loom-core/performance'

const milliseconds = (value: number | null) => value === null ? '—' : value.toFixed(1) + ' ms'

export function showFrameTimes(graph: LoomGraph, display: (values: Record<string, string>) => void) {
  return observePerformance(graph, sample => {
    display({
      State: sample.idle ? 'Idle' : 'Active',
      'Graph FPS': sample.fps.toFixed(0),
      'Active p95': milliseconds(sample.p95FrameMs),
      'Main thread': milliseconds(sample.mainThreadMs),
      'GPU draw': sample.gpuStatus === 'measured' ? milliseconds(sample.gpuMs) : sample.gpuStatus,
      Frames: String(sample.frames),
    })
  })
}
```

For a memory investigation, `geometryBytes` counts the packed node-position and edge-endpoint arrays. `heapBytes` is the browser’s JavaScript heap reading when available. GPU textures, the framebuffer and driver allocations have separate costs. Compare fresh mounts with the same canvas dimensions and artwork settings.

## Separate startup from camera movement

`graph.stats().firstSubmitMs` measures construction through the first WebGL submission. To measure when a user sees the graph, Loom’s hardware harness opens a fresh document containing just the canvas and records its first contentful paint. This keeps a heading or toolbar from ending the measurement early.

The recorded **19 November 2026** run used an Apple M2 Max, Chromium 157, and a 960 × 640 canvas at device pixel ratio 1. Across seven fresh contexts with 1,000 nodes and 4,000 links, the first frame appeared in **27.3–40.5 ms**. The 10 ms startup target was missed. A clear-only canvas took 19.2–20.5 ms in the same harness.

In a separate camera test, 25,000 positioned nodes and 100,000 links using the console theme completed **118.1 frames/s**, with a **9.88 ms** p95 and four draw calls. The harness counted 72 completed GPU frames. That figure describes camera movement over existing positions. Test an actively settling layout separately on the hardware you support. [Raw benchmark and environment (JSON)](https://castlemilk.github.io/loom/benchmarks/m2-max.json)

## Reproduce a comparison

In the studio’s **Test data** controls, choose a preset, record the seed, then generate the graph. Open **Perf**. Record startup separately, repeat the same camera gesture, and finish with a hands-off interval. Keep the node and link counts, canvas dimensions, pixel ratio, layout and motion preference with the result. Change one setting for the next run.

From a repository checkout, these commands install the test dependencies, check the compressed bundle, and run the hardware harness in a visible browser. The harness writes raw samples to `artifacts/performance.json` and reports missed budgets.

```bash
npm ci
npm run build
npm run size
npx playwright install chromium
LOOM_HEADFUL=1 npm run bench
```

Choose an intervention based on which measurement moved. [Optimise large graphs →](https://castlemilk.github.io/loom/docs/optimisations/index.md)
