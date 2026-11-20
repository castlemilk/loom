# Layouts and styling

Give nodes a visual vocabulary, arrange them in lanes or rings, and draw the direction of a connection.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/drawing/)

## Choose a layout

Use `graph.setMode('lanes')` for categories with a shared axis, `'orbit'` for distance from a selected node, `'cloud'` for a rotatable volume, or `'drift'` for force-directed placement. In Orbit, Loom uses the highest-degree node as the center until you select one.

`graph.setLayout({ blend: 1 })` puts movable nodes on their layout targets. At zero, forces control their positions. Intermediate values let the graph respond to dragging while it approaches its anchors. A node supplied with both `x` and `y` starts pinned unless you set `pinned: false`.

## Draw a connection

Use the optional wire renderer when you need arrows, traveling pulses, separate paths for parallel links, or self-loops. Pass the same `nodes` and `links` you would pass to the core renderer. Give parallel edges stable IDs so their visual order survives a data reorder.

`drawing.ts`

```ts
import type { GraphData } from 'loom-core'
import { createWireGraph, sketchbook } from 'loom-core/wires'

export function drawConnections(canvas: HTMLCanvasElement, data: GraphData) {
  const graph = createWireGraph(canvas, {
    ...data,
    theme: sketchbook,
    drawingStyle: { fill: 'hachure', roughness: 0.7, hatchSpacing: 5 },
    wireEffects: { direction: 'arrow', separation: 16 },
  })

  graph.on('select', id => {
    graph.setWireEffects({ direction: id ? 'flow' : 'arrow', scope: 'selected' })
  })
  return graph
}
```

The flow speed is measured in CSS pixels per second. The separation between parallel paths is also in CSS pixels. A selected-node effect applies to its incident links. Reduced motion displays a static arrow. Open the working controls to compare the treatments. [Try connection drawing in the studio →](https://castlemilk.github.io/loom/studio/?example=wires#settings-style)

## Map data to appearance

Start from `parchment`, `ink`, or `blueprint`. Pass a complete theme to `graph.setTheme(theme)` to update a mounted graph. Set `nodes.byKind` for categorical differences and `nodes.resolve` for values that vary per node. The helpers `mapNodeRadius` and `mapWireWidth` in `loom-core/metrics` return resolvers for numeric measures.

For individual exceptions, store `markerColor` or `markerShape` on the node. For sketch-style fills, use `setDrawingStyle` on a wire graph. A roughness of zero draws exact outlines. The drawing and wire schemas list the settings, allowed values and units. [Drawing style schema](https://castlemilk.github.io/loom/drawing-style.schema.json) · [Wire effects schema](https://castlemilk.github.io/loom/wire-effects.schema.json)
