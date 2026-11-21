# Edit a graph document

Give a person or an agent the same editing contract. Preview a batch, commit it against a known revision, and read back the result.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/editing/)

## Export a graph to your app

Choose **New** in the studio and give your graph a name. Add two nodes, connect them and choose a layout or drawing style. You can also edit any graph in the main studio. [Open a blank canvas →](https://castlemilk.github.io/loom/studio/?example=blank)

Open **TS** in the toolbar to edit the live `data.ts` beside the canvas. Drag a node, open **Node properties → Edit metadata**, or use **Node** and **Connect** to add a relationship. Edit the module to change the canvas in return. A type error leaves the last valid graph on screen. **Revert text** restores its source. **Undo** and **Redo** recover both the data and its module. [Try the Saturn notebook →](https://castlemilk.github.io/loom/studio/?example=saturn)

The **TypeScript starter project** includes the graph in `data.ts`, its types, and a renderer that imports it. The scene records the styling, camera and live positions. On the overview, an authored module is exported exactly as it appears in the editor. A drilldown exports just its visible records. You can also download the module and its types individually from **Export**.

**Export → Starter project** downloads a ZIP with your scene, a TypeScript or JavaScript module and a working page. Unzip it, run `npm install` and `npm run dev`, and open the local address. Use `npm run build` to produce a static site. The published studio pins its own SDK release in the project's `package.json`.

**Export → Existing app** gives you the install command and the same mount code. Put `graph.ts`, `data.ts`, `notebook-types.ts` and `scene.json` together. The JavaScript version reads the scene directly. When your canvas has a width and height, call `const graph = await mountGraph(canvas)`. Use `graph.destroy()` when the component unmounts.

`mount-export.ts`

```ts
import { mountScene, type GraphScene } from 'loom-core/scene'
import { graph as data } from './data.js'

export async function mountGraph(canvas: HTMLCanvasElement, workerURL?: string) {
  const response = await fetch(new URL('./scene.json', import.meta.url))
  if (!response.ok) throw new Error('Could not load scene.json (' + response.status + ')')
  const scene: GraphScene = await response.json()
  const graph = mountScene(canvas, { ...scene, data }, { workerURL })
  graph.on('open', id => graph.focus(id))
  return graph
}
```

The scene contains the visible nodes and links, their custom fields, layout, marker and wire styles, and artwork URLs. **Keep positions and camera** starts the graph at the captured view. Clear it to run the layout from the document's authored coordinates and fit the new canvas. Unpinned nodes can move in both cases. The studio inspector, legend and group outlines belong to the host interface.

Exporting inside a drilldown gives you that view. Return to the overview for a scene of the entire graph. **Download full graph data** saves the whole editable document as JSON in either view. Use **JSON → Import graph** to reopen that data in the studio.

For a custom editor, call `captureScene(data, { graph, layout, theme, mode })` from `loom-core/scene` before serializing. Loom records the values returned by marker, wire, lane and anchor callbacks so other applications can reproduce the drawing.

**Export → Graph MCP** saves the current scene for a local assistant. Open client setup and enter the full path to the download. Ask the assistant to find a node or trace one of its links. [Connect your exported graph →](https://castlemilk.github.io/loom/mcp/?source=studio#connect)

## Preview and commit

Create an editor for each graph document. A batch can add a node and connect it in one undo step. Operations see the results of earlier operations in the same batch. A validation error leaves the entire document at its original revision.

`edit.ts`

```ts
import { createEditor, restoreEditor, type EditorTransaction } from 'loom-core/editor'

export function addFilter() {
  const doc = createEditor({ nodes: [{ id: 'mixer' }], links: [] })
  const { documentId, revision } = doc.describe()
  const edit = {
    version: 1, documentId, expectedRevision: revision,
    operations: [
      { op: 'node.add', value: { id: 'filter', label: 'Filter' } },
      { op: 'link.add', value: { id: 'signal', source: 'mixer', target: 'filter' } },
    ],
  } satisfies EditorTransaction

  const preview = doc.preview(edit)
  if (!preview.ok) throw new Error(preview.error.path + ' ' + preview.error.message)
  const receipt = doc.apply(edit)
  if (!receipt.ok) throw new Error(receipt.error.code)

  const reopened = restoreEditor(JSON.parse(JSON.stringify(doc.checkpoint())))
  return { receipt, link: reopened.getLink('signal'), revision: reopened.describe().revision }
}
```

On success, this example returns revision 1 and a link named `signal` from `mixer` to `filter`. A preview leaves the revision unchanged. Another edit can land between preview and apply, so always check the apply receipt.

## Build an agent workflow

1. Call `describe()` for the document ID, revision and supported operations.
2. Query a bounded page of IDs with `query({ entity: 'node', text: 'mixer', limit: 10 })`. Read a full record with `getNode` or `getLink`.
3. Preview a transaction with `expectedRevision`, then apply the same payload. If the receipt reports `stale_revision`, read the current state and reconcile the proposed edit.
4. Read back affected IDs. Store the checkpoint to resume that document later.

The transaction schema is available as a package export and from the public studio. The generated API index also lists the methods on each controller. [Transaction schema](https://castlemilk.github.io/loom/editor.schema.json) · [Machine-readable API index](https://castlemilk.github.io/loom/docs/api-index.json)

For a worked tool-calling example, connect a Recorder to an Amplifier, inspect the receipt and handle a competing edit. [Build an AI graph tool →](https://castlemilk.github.io/loom/docs/ai-tooling/index.md)

## Save and restore

`checkpoint()` captures document identity, graph metadata and revision. `restoreEditor()` resumes that revision with a fresh undo history. Undo and redo each advance the revision. A host with multiple writers must compare the stored revision when saving the next checkpoint.

For an editor that evaluates a complete TypeScript module, use `editor.replaceData(graph, revision)` to validate and commit the result in one undo step. A card view exposes the new world coordinates via `onMove(node, position)`. A WebGL view emits `nodedrop` with the node ID. Read `graph.getPosition(id)` there to capture its coordinates and pin state.

The editor runs in Node.js and in a browser. A mounted WebGL graph has its own buffers and transient positions. The studio remembers the camera and surviving positions when it rebuilds the view after an edit. A shared live-update API is the first proposal on the roadmap. [Read the SDK roadmap →](https://castlemilk.github.io/loom/docs/roadmap/index.md)
