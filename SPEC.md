# Loom — spec v0.1

A tiny, dependency-free WebGL2 library for interactive node-graph visualization:
force-directed layouts (2D + volumetric), artwork-backed nodes, patch-wire edges,
greedy label placement, and a frame scheduler that idles at zero cost.

Codename **Loom** — rename at will; it names the patch-wire aesthetic.

## Why

The knowledge console proved the interaction model (drift/lanes/orbit/cloud,
greedy labels, momentum tumble, idle-sleep) on a Canvas2D renderer. Canvas
rasterizes CPU-side and costs real main-thread time per frame; the same work as
instanced GPU draws is ~1–4 draw calls. Loom ports the proven interaction model
to a WebGL2 backend and packages it as a reusable library.

## Non-goals

- Not a general graph-analytics workbench (no Gephi-style queries/stats).
- Not a charting library.
- No WebGPU (yet — WebGL2 covers ~97% of browsers; architecture leaves room).
- No framework lock-in: core is vanilla TS; wrappers are optional thin shells.
- No WASM sim at library scale — see notes; the numbers don't support it.

## The <10ms contract

`create(canvas, data)` must issue its first paint in **≤10ms** on a 2021+
laptop at 1k nodes. This is a hard, CI-measured budget, and it shapes the design:

| Phase | Budget | How it fits |
|---|---|---|
| Script eval (bundled) | <2ms | Core ≤25KB min+gz — no deps means nothing else to parse |
| GL context + shaders | ~3–6ms | 4 small programs, compiled in parallel at init |
| Buffer upload (1k nodes) | <1ms | Pre-packed typed arrays |
| **First paint** | **same rAF** | Seeded positions render on frame 0 — layout warms *after* first pixels |

Two consequences:

1. **Never block on layout.** Nodes seed onto a deterministic golden-angle
   spiral (looks like an intentional scatter, not noise-soup) and the sim
   settles over the next ~200ms — the "map assembles itself" effect, for free.
   Callers may pass explicit `x/y/z` to skip settling entirely → truly instant.
2. **No loader UI, ever.** The library's own contract forbids async init.

Worst-case on low-end mobile is ~15–20ms; that's the honest ceiling and it's
still under one frame at 60Hz.

## Performance budgets (CI gates)

| Metric | Budget |
|---|---|
| Package size, core | ≤25KB min+gz (hard fail at 30KB) |
| Time-to-first-paint | ≤10ms @1k nodes (2019+ laptop) |
| Steady frame rate | 60fps @5k nodes/20k edges (integrated GPU); 30fps @25k/100k |
| Idle cost | 0 rAF callbacks and 0 sim ticks when settled + unobserved |
| First-input latency | <16ms during settling (sim runs chunked or on worker) |
| Memory | <50MB @25k nodes |
| Texture atlas | single 2048² atlas, ≤1024 artwork slots |

## Package layout

```
loom-core        vanilla TS, zero deps
  sim/           force layout: Barnes-Hut charge (2D+3D), link, collide,
                 centering, pinning, alpha decay; flat + volumetric
  render/        WebGL2 renderer (instancing only — see pipeline)
  camera/        2D pan/zoom + 3D turntable, eased goals, fly-to
  interaction/   pointer/pinch/wheel, hover, drag-node, momentum flick
  sched/         awake/asleep scheduler (the sleep gate — core feature)
  theme/         style tokens + built-in themes
  io/            data model: JS objects in/out + packed-binary fast path
loom-react       ~2KB — <LoomGraph> + ref API (ships later)
loom-svelte / loom-vue   ~2KB each (ships later)
```

## Rendering pipeline (WebGL2)

Everything is instanced geometry — the whole graph is ~4 draw calls:

- **Nodes** — one instanced quad per node. Per-instance: position, radius,
  kind-color index, artwork atlas index, flags (hub/content/dimmed/hot).
  Fragment shader draws SDF circle (hubs) or rounded-square (content) with the
  kind-colored ring; artwork nodes sample the atlas inside the shape mask.
- **Artwork atlas** — images bake into one 2048² texture (64px cells) at load;
  ~1024 slots, single bind. Falls back to a second atlas if exceeded.
- **Edges** — instanced quads; the vertex shader evaluates the cubic bezier
  tangents *on the GPU* (control points as instanced attributes), so wires
  never tessellate on the CPU. Depth alpha (cloud mode) and "hot" highlights
  are per-instance attributes; quiet wires draw in one call.
- **Labels** — runtime glyph atlas: needed glyphs rasterize once via an
  offscreen 2D canvas, instanced text quads sample it. Label *placement* stays
  the proven CPU greedy pass (priority order + spatial-grid collision) — it
  emits an instance buffer, not draw calls.
- **Picking** — CPU uniform-grid over projected positions, rebuilt per painted
  frame (<1ms @25k). No GPU readback stalls.

## Simulation

Own force implementation — no d3-force dependency:

- Barnes-Hut octree/quadtree charge, spatial-hash collide, link springs,
  centering — O(n log n) ticks.
- Tick modes: synchronous warm (fast path, chunked ~4ms/frame so input never
  stalls), or **Worker** (`{ sim: 'worker' }`) with transferable Float32Arrays —
  the never-jank option for >5k nodes.
- Position buffers are Float32Arrays shared read-only with the renderer
  (zero-copy in worker mode via SharedArrayBuffer where COOP/COEP allows).

## Frame scheduler (carried from the console — it works)

Frames paint only when something can produce new ink: sim settling, camera
easing, momentum, live pointer, wake window (~5s after interactions). Idle →
zero rAF and zero sim ticks. `IntersectionObserver` freezes sim + paint when
the canvas leaves the viewport. Adaptive resolution: sustained >15ms frames
step the backing scale down; <6ms steps back up (cooldown + hysteresis).

## Interaction model (unchanged semantics, GPU backend)

- Drag pan / drag node / flick momentum / pinch zoom — cursor-anchored zoom.
- Hover pick (squared-distance uniform grid), click select, dimmed-neighborhood.
- Volumetric mode: drag tumbles, flick spins with capped velocity, idle tumble
  ramps in after ~1.5s stillness, pinch zooms the perspective.
- Keyboard: arrows pan/tumble, +/- zoom, Enter opens selection — same contract
  as the console's a11y layer.

## Theming

Flat token object: `{ kind: Record<NodeKind,string>, ink, dim, accent, bg,
bezel, font, fontSize, radii, plateAlpha }`. Built-ins: `parchment` (the
console's look), `ink` (dark), `blueprint`. No CSS coupling — the lib draws
everything inside the canvas; chrome stays the caller's job.

## Data model

Canonical model in protobuf (house convention), with plain-JS ergonomics:

```proto
message Graph { repeated GNode nodes = 1; repeated GLink links = 2; }
message GNode { string id=1; string label=2; string kind=3;
                float x=4; float y=5; float z=6; string art=7; uint32 degree=8; }
message GLink { string source=1; string target=2; string kind=3; }
```

- `create(canvas, { nodes, links })` accepts plain objects (zero-friction path).
- `toBinary(graph)` / `fromBinary(buf)` pack/unpack the proto — the fast-load
  path for large graphs (JSON parse of 25k nodes ~80ms; proto ~10ms).

## API surface (core)

```ts
const g = createGraph(canvas, {
  nodes, links,
  mode: 'drift' | 'lanes' | 'orbit' | 'cloud',
  theme: parchment,
  art: { urlFor: (n) => n.art },      // optional artwork source
  sim: 'main' | 'worker',
  reducedMotion: 'respect' | 'ignore',
})
g.setMode('cloud'); g.select(id); g.focus(id); g.fit(); g.reset()
g.on('select' | 'hover' | 'modechange', cb)
g.pause(); g.resume(); g.resize(); g.destroy()
```

React wrapper: `<LoomGraph nodes links mode theme onSelect ref>` — props map
1:1; `ref` exposes the core instance for imperative calls.

## Testing & CI gates

- **Unit** — sim convergence, camera easing, label collision, spiral seed.
- **Golden images** — headless WebGL screenshot diff per theme/mode.
- **Perf harness** — TTF paint, steady fps, idle callbacks; CI fails over budget.
- **Size gate** — `bundlesize` on the core artifact.
- **Manual page** — dev harness with a slider for node count (100 → 25k).

## Migration path (knowledge console)

`loom-core` first, then the console's canvas region swaps to `<LoomGraph>`
behind `fromConsole(graph)` (KGNode/KGEdge → loom model). The DOM chrome —
layer switches, panel, picker, Fluid controls — stays exactly as-is; only the
canvas internals change. Rollback = keep the canvas renderer behind a flag.

## Milestones

1. **M1 render core** — instanced nodes/edges/labels, camera, sleep gate, budgets harness. ~1 wk.
2. **M2 sim + interactions** — force impl, picking, momentum, pinch, hover/dim.
3. **M3 volumetric + artwork atlas** — cloud mode, tumble, atlas bake.
4. **M4 package + adapters** — loom-react, binary IO, docs, console migration.

## Open questions / risks

- **Glyph atlas** — runtime rasterization is pragmatic; MSDF is prettier for
  tiny text but adds complexity. Decide after M1 on real label sizes.
- **WebGL context loss** — must handle `webglcontextlost/restore` (rebuild
  atlas + buffers); easy to get wrong, explicitly tested.
- **Fallback** — WebGL2 absent (~3%): clean capability error; a Canvas2D
  fallback would double the codebase — defer unless needed.
- **Name** — `loom` is taken on npm (Python tool); check `-gl` variants or
  rename before publish.
