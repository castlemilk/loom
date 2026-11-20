# Graph authoring

The studio and the headless editor read and write the same graph document. A human can place a node, change a relationship, inspect the proposed JSON, and undo the edit. A TypeScript or model-driven client can make the same change using stable IDs without running a browser.

## Choose an entry point

| Use case | Public surface | What the caller gets |
| --- | --- | --- |
| Create or resume a document | `createEditor(graph, options)`, `restoreEditor(checkpoint, options)` from `loom-core/editor` | An isolated document with a stable ID and revision |
| Discover available edits | `editor.describe()`, `editorSchema`, `loom-core/editor.schema.json` | Counts, operation names and a versioned JSON Schema |
| Find an object or its connections | `query({entity, text, kind, incidentTo, offset, limit})`, `getNode(id)`, `getLink(id)` | Bounded search results and authoritative full records |
| Author with TypeScript | `transact(operations, expectedRevision?)`, `EditorTransaction`, `EditorOperation` | Typed operations and a structured receipt |
| Author with JSON | `preview(input)`, `apply(input)` | Shared validation, atomic changes, revision and an error path on failure |
| Observe, undo or redo | `getSnapshot()`, `subscribe(listener)`, `undo(revision?)`, `redo(revision?)` | A stable immutable snapshot and one undo step per committed batch |
| Save or transfer | `checkpoint()`, `restoreEditor(parsedJson)`, `snapshot.data` | Lossless JSON for graph metadata, stable IDs and authored coordinates |
| Build a custom canvas editor | `createGraph`, `on('select'/'open'/'backgroundclick', …)`, `onFrame`, `getPosition`, `screenToWorld`, `getViewport`, `setViewport` from `loom-core` | Picking, CSS-pixel placement, camera bookmarks, pinning and visual overlays |
| Drill into a graph | `createDrilldown`, `inspect`, `openNeighborhood`, `openGroup`, `setGroupView`, `goTo` from `loom-core/drilldown` | A navigable scope, selection, group members and a breadcrumb path |
| Style, classify and inspect | `setTheme`, `setLayout`, `compileTaxonomies`, `attachAnnotations`, `clusterLayout`, `mapNodeRadius`, `mapWireWidth` | Domain language, grouping, legends, metric mappings and shape or stroke overrides |
| Manage a live renderer | `pause`, `resume`, `resize`, `stats`, `observePerformance`, `destroy` | Explicit lifecycle and performance readback |

Install the [revision-addressed package](../README.md#use-the-core). The editor runs in Node.js and browsers. Importing the renderer alone keeps the authoring module out of its bundle.

## One human or agent edit

```ts
import { createEditor, restoreEditor, type EditorTransaction } from 'loom-core/editor'

const doc = createEditor({ nodes: [{ id: 'sensor', label: 'Sensor' }], links: [] })
const { documentId, revision } = doc.describe()

const transaction = {
  version: 1, documentId, expectedRevision: revision,
  operations: [
    { op: 'node.add', value: { id: 'scope', label: 'Oscilloscope', kind: 'instrument' } },
    { op: 'link.add', value: { id: 'signal', source: 'sensor', target: 'scope', kind: 'feeds' } },
  ],
} satisfies EditorTransaction

const preview = doc.preview(transaction)
if (!preview.ok) throw new Error(preview.error.path + ' ' + preview.error.message)
const saved = doc.apply(transaction)
if (!saved.ok) throw new Error(saved.error.path + ' ' + saved.error.message)

const connections = doc.query({ entity: 'link', incidentTo: 'scope', limit: 10 })
const authoritativeLink = doc.getLink(connections.items[0].id)
const persisted = JSON.stringify(doc.checkpoint())
const reopened = restoreEditor(JSON.parse(persisted))
console.log(authoritativeLink, reopened.describe().revision)
```

An agent can start with `describe()`, fetch the [published transaction schema](https://castlemilk.github.io/loom/editor.schema.json), and query a page of IDs. It can read full records for those IDs, preview a guarded transaction, apply those exact operations and read back the affected records. A preview reports the current revision. A successful commit returns the new revision. A stale revision or different document ID returns an error and preserves the entire graph.

## Command semantics

| Operation | Input | Effect |
| --- | --- | --- |
| `node.add` | `value: {id, …}` | Add a node with a unique nonempty string ID |
| `node.update` | `id`, `changes` and/or `unset` | Set fields or remove named optional fields. A nested object such as `metrics` is replaced as one value. |
| `node.remove` | `id`, optional `cascade` | Remove an isolated node, or explicitly remove its incident links in the same transaction |
| `link.add` | `value: {id, source, target, …}` | Connect existing nodes. Self-loops and parallel links have separate IDs. |
| `link.update` | `id`, `changes` and/or `unset` | Rewire either endpoint, change fields or clear optional fields such as weight |
| `link.remove` | `id` | Remove exactly one relationship |

Node and link IDs occupy separate namespaces. An update keeps the ID. Required endpoints cannot be unset. Omitting a field preserves it. Setting custom metadata to JSON null stores null. An operation that both sets and unsets a field is rejected. The editor accepts finite, acyclic JSON metadata and retains top-level fields such as artwork and provenance. Legacy links without an ID receive deterministic IDs in source order, skipping every explicit ID. Persist the first normalized graph before exchanging edits with other clients.

Operations see the results of earlier operations in their batch. A later failure discards the entire batch. A receipt lists each affected operation and ID, including incident links removed by a cascade. An identical field assignment or removal of an absent field returns an empty change list and keeps the revision. Successful undo and redo advance the revision. A fresh edit clears redo. The default history limit is 32 batches. Set `historyLimit: 0` for a read/write session without retained undo frames.

Queries return `{revision,total,items,nextOffset}` in document order. Text matches IDs, labels, kinds or link endpoints. `incidentTo` includes both directions and counts a self-loop once. The default page has 25 results and the maximum is 100. If the revision changes between pages, restart the query. Use `getNode` or `getLink` for custom metadata and full content. A missing ID returns `undefined`. Invalid query options throw. Failed transactions return `{ok:false,revision,error:{code,path,message}}`. Codes include `invalid_input`, `wrong_document`, `stale_revision`, `duplicate_id`, `not_found`, `missing_endpoint`, `connected_node`, and `empty_history`.

## Hosting an editor

Keep a document session per graph. Subscribe from a UI with `useSyncExternalStore(doc.subscribe, doc.getSnapshot, doc.getSnapshot)`. Snapshots share unchanged records, retain their identity until a commit, and are safe to read concurrently. Use the unsubscribe function when the view unmounts. For independent requests or processes, put the document ID and expected revision in the transaction and perform a compare-and-swap against the persisted revision when saving the checkpoint. Two separately loaded sessions need that storage-level check to avoid a lost update.

For individual marker overrides, set `markerColor` to a three- or six-digit hex colour and `markerShape` to `circle`, `ring`, `square` or `rounded-square` in a `node.update`. Use `unset` on either field to inherit that property from the theme. Undo, JSON and protobuf preserve these fields.

Authored positions live in node fields `x`, `y`, `z` and `pinned`. The simulation also has transient positions. Read one using `graph.getPosition(id)` and commit a `node.update` to make it part of a document. `graph.screenToWorld(x,y,depth)` converts canvas-local CSS pixels onto a camera-facing plane. Its default depth is zero. `getViewport()` and `setViewport()` round-trip the world centre, zoom, yaw and pitch. The studio preserves the current camera and surviving node positions when editing in the same scope.

The studio keeps named edits for this tab's session. **JSON → Download graph** saves a portable graph JSON file, and **Import graph** reopens it. For services that resume guarded commands across restarts, store the checkpoint with its document ID and revision. A restored checkpoint starts a new undo history. Protobuf snapshots preserve the renderer's typed fields, including optional link IDs. Use JSON or checkpoints for arbitrary metadata.

The optional `loom-core/wires` renderer orders parallel and reciprocal links by stable document ID and fans out self-loops. Hosts can discover valid visual settings through `wireEffectsSchema`, apply a partial patch with `setWireEffects` and read it back with `getWireEffects`. Visual changes keep the document revision and layout. For a custom connection tool, read `graph.getFrame()` for the initial endpoint positions and subscribe with `graph.onFrame()` until the gesture finishes. The [wire API example](../README.md#draw-and-animate-connections) includes the supported modes, units and defaults.

## Extension points for larger integrations

| Use case | Available today | Further library surface |
| --- | --- | --- |
| Bulk selection and editing | Apply many object operations as one undoable transaction | Marquee hit-testing, a selection set, alignment and distribution |
| Diagram authoring | Place nodes, preview and snap connections to nodes, trace separated parallel links and animate direction | Named ports, obstacle-aware routes, editable waypoints and per-object style overrides |
| Shared graph editing | Stable document IDs, optimistic revisions, snapshots and transactional errors | Durable command IDs, idempotent replay, per-client history and conflict resolution |
| Long-running agents | Schema discovery, bounded reads, previews, explicit errors and checkpoint restore | Incremental change feeds, stable cursors and cancellation |
| Host integrations | Immutable snapshots, callbacks and schema-based validation | Host-owned authorization, storage adapters, and an HTTP or MCP transport |
