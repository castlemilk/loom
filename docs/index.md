# Your first graph

Build a small synthesizer signal path. Mount it on a canvas, switch its layout, and focus a module by double-clicking it.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/)

[Try the interactive signal path](https://castlemilk.github.io/loom/docs/)

## Install Loom

Start in an empty directory with Node.js 22.12 or newer and npm. Vite serves the example and resolves the SDK imports.

```bash
npm init -y
npm install https://castlemilk.github.io/loom/packages/65b497f5264036e9c98fb79c290c4badb6d66b63/loom-core-0.1.0.tgz
npm install --save-dev vite
```

The install command matches this Studio build. Published releases use an exact npm version. Preview builds use their GitHub Pages archive. Commit the resulting lockfile with your app.

## Mount the graph

Save these three files in the same directory, or copy them from `node_modules/loom-core/docs/examples/` after installing the package. Give the canvas a CSS width and height so the renderer can measure it on the first draw.

`index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Signal path</title>
</head>
<body>
  <canvas id="patch" aria-label="Signal path" style="display:block;width:100%;height:360px"></canvas>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

Each node has a unique string ID. Each connection names its source and target by ID. In this patch, two sound sources feed a mixer, which sends its output through a filter to an amplifier. The preview above runs this function.

`signal-path.ts`

```ts
import { createGraph, parchment, type GraphData } from 'loom-core'

export const signalPath: GraphData = {
  nodes: [
    { id: 'osc', label: 'Oscillator', kind: 'source' },
    { id: 'noise', label: 'Noise', kind: 'source' },
    { id: 'mixer', label: 'Mixer', kind: 'mix' },
    { id: 'filter', label: 'Filter', kind: 'tone' },
    { id: 'amp', label: 'Amplifier', kind: 'output' },
  ],
  links: [
    { source: 'osc', target: 'mixer' },
    { source: 'noise', target: 'mixer' },
    { source: 'mixer', target: 'filter' },
    { source: 'filter', target: 'amp' },
  ],
}

export function mountSignalPath(canvas: HTMLCanvasElement) {
  const graph = createGraph(canvas, {
    ...signalPath,
    theme: {
      ...parchment,
      labels: { alternateSide: true },
      kind: { source: '#976343', mix: '#436653', tone: '#5d7190', output: '#a94c32' },
      wires: { routing: 'straight', width: 1.5, opacity: 0.65 },
    },
    mode: 'lanes',
    layout: { blend: 1, laneOrder: ['source', 'mix', 'tone', 'output'], laneGap: 70, rowGap: 56 },
  })
  graph.on('open', id => graph.focus(id))
  return graph
}
```

The graph handle owns its GPU buffers, listeners and layout. In a component, call `destroy()` when the canvas unmounts. This standalone entry keeps the graph available if the browser restores the page from its back-forward cache.

`main.ts`

```ts
import { mountSignalPath } from './signal-path.js'

const canvas = document.querySelector<HTMLCanvasElement>('#patch')
if (!canvas) throw new Error('Add a canvas with id="patch" to the page.')
const graph = mountSignalPath(canvas)

window.addEventListener('pagehide', event => {
  if (!event.persisted) graph.destroy()
})
```

## Run it

```bash
npx vite
```

Open the local address printed by Vite. Drag a module or double-click one to focus it. A browser with WebGL2 can run the preview. A host can catch `WebGL2UnavailableError` and offer a list or card view when WebGL2 is unavailable.

## Choose your next guide

- To draw arrows, style a node by kind or change layouts, read [Layouts and styling](https://castlemilk.github.io/loom/docs/drawing/index.md).
- To load Wikipedia topics on demand and follow Music into Orbit, read [Stream a Wikipedia atlas](https://castlemilk.github.io/loom/docs/atlas/index.md).
- To drive edits from TypeScript or JSON, read [Edit a graph document](https://castlemilk.github.io/loom/docs/editing/index.md).
- To give an assistant bounded reads and revision-checked writes, read [Build an AI graph tool](https://castlemilk.github.io/loom/docs/ai-tooling/index.md).
- To profile the patch on your device or tune a much larger map, read [Measure graph performance](https://castlemilk.github.io/loom/docs/performance/index.md) and [Optimise large graphs](https://castlemilk.github.io/loom/docs/optimisations/index.md).
