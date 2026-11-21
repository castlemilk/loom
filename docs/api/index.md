# API reference

Find a package import, exported type, or method on a returned controller. This index is generated from the declarations shipped with Loom.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/api/)

## Package modules

Expand a module for its exports. Open a type to see its fields, or expand a factory’s returned methods to see what its controller can do after mounting. Try searching for `GraphOptions` or `setLayoutSpeed`.

### loom-core

```text
type FrameProbe
type GraphData
type GraphEvents
type GraphFrame
type GraphLink
type GraphNode
type GraphOptions
type GraphStats
type GraphViewport
type LayoutOptions
type LoomGraph
type Mode
type NodeShape
type NodeStyle
type Theme
class WebGL2UnavailableError
type WirePattern
type WireRoute
type WireStyle
value blueprint
create<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(canvas: HTMLCanvasElement, options: GraphOptions<N, E>): LoomGraph<N, E>
  .destroy(): void
  .fit(immediate?: boolean): void
  .focus(id: string): void
  .getFrame(): GraphFrame
  .getPosition(id: string): { x: number; y: number; z: number; pinned: boolean; }
  .getViewport(): GraphViewport
  .invalidate(): void
  .on<K extends keyof GraphEvents>(type: K, listener: (value: GraphEvents[K]) => void): () => void
  .onFrame(listener: (frame: GraphFrame) => void): () => void
  .onTiming(probe: FrameProbe): () => void
  .pause(): void
  .pin(id: string, position?: { x: number; y: number; z?: number; }): void
  .reset(): void
  .resize(): void
  .resume(): void
  .screenToWorld(x: number, y: number, depth?: number): { x: number; y: number; z: number; }
  .select(id: string | null): void
  .setLayout(options: LayoutOptions<N>): void
  .setMode(mode: Mode): void
  .setTheme(theme: Theme<N, E>): void
  .setViewport(viewport: GraphViewport): void
  .stats(): GraphStats
  .unpin(id: string): void
createGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(canvas: HTMLCanvasElement, options: GraphOptions<N, E>): LoomGraph<N, E>
  .destroy(): void
  .fit(immediate?: boolean): void
  .focus(id: string): void
  .getFrame(): GraphFrame
  .getPosition(id: string): { x: number; y: number; z: number; pinned: boolean; }
  .getViewport(): GraphViewport
  .invalidate(): void
  .on<K extends keyof GraphEvents>(type: K, listener: (value: GraphEvents[K]) => void): () => void
  .onFrame(listener: (frame: GraphFrame) => void): () => void
  .onTiming(probe: FrameProbe): () => void
  .pause(): void
  .pin(id: string, position?: { x: number; y: number; z?: number; }): void
  .reset(): void
  .resize(): void
  .resume(): void
  .screenToWorld(x: number, y: number, depth?: number): { x: number; y: number; z: number; }
  .select(id: string | null): void
  .setLayout(options: LayoutOptions<N>): void
  .setMode(mode: Mode): void
  .setTheme(theme: Theme<N, E>): void
  .setViewport(viewport: GraphViewport): void
  .stats(): GraphStats
  .unpin(id: string): void
fromBinary(buffer: Uint8Array | ArrayBuffer): { nodes: GraphNode[]; links: GraphLink[]; }
fromConsole<N extends GraphNode, E extends GraphLink>(graph: { nodes: readonly N[]; edges: readonly E[]; }): { nodes: readonly N[]; links: readonly E[]; }
value ink
value knowledgeConsole
value parchment
toBinary(data: GraphData): Uint8Array
```

### loom-core/editor

```text
type EditorChange
type EditorCheckpoint
type EditorData
type EditorErrorCode
type EditorLink
type EditorNode
type EditorOperation
type EditorQuery
type EditorReceipt
type EditorSnapshot
type EditorTransaction
createEditor<T extends GraphData>(data: T, { historyLimit, documentId }?: { historyLimit?: number | undefined; documentId?: string | undefined; })
  .apply(input: unknown): EditorReceipt
  .checkpoint(): EditorCheckpoint
  .describe(): { version: 1; documentId: string; revision: number; nodes: number; links: number; canUndo: boolean; canRedo: boolean; operations: string[]; }
  .getLink(id: string): Readonly<GraphLink & { id: string; } & Record<string, unknown>> | undefined
  .getNode(id: string): Readonly<GraphNode & Record<string, unknown>> | undefined
  .getSnapshot(): EditorSnapshot
  .preview(input: unknown): EditorReceipt
  .query({ entity, text, kind, incidentTo, offset, limit }: EditorQuery): { revision: number; total: number; items: { id: string; kind?: string; label?: string; source?: string; target?: string; }[]; nextOffset: number | null; }
  .redo(expectedRevision?: number): EditorReceipt
  .replaceData(data: GraphData, expectedRevision?: number): EditorReceipt
  .subscribe(fn: () => void): () => void
  .transact(operations: readonly EditorOperation[], expectedRevision?: number): EditorReceipt
  .undo(expectedRevision?: number): EditorReceipt
value editorSchema
restoreEditor(checkpoint: unknown, { historyLimit }?: { historyLimit?: number | undefined; })
  .apply(input: unknown): EditorReceipt
  .checkpoint(): EditorCheckpoint
  .describe(): { version: 1; documentId: string; revision: number; nodes: number; links: number; canUndo: boolean; canRedo: boolean; operations: string[]; }
  .getLink(id: string): Readonly<GraphLink & { id: string; } & Record<string, unknown>> | undefined
  .getNode(id: string): Readonly<GraphNode & Record<string, unknown>> | undefined
  .getSnapshot(): EditorSnapshot
  .preview(input: unknown): EditorReceipt
  .query({ entity, text, kind, incidentTo, offset, limit }: EditorQuery): { revision: number; total: number; items: { id: string; kind?: string; label?: string; source?: string; target?: string; }[]; nextOffset: number | null; }
  .redo(expectedRevision?: number): EditorReceipt
  .replaceData(data: GraphData, expectedRevision?: number): EditorReceipt
  .subscribe(fn: () => void): () => void
  .transact(operations: readonly EditorOperation[], expectedRevision?: number): EditorReceipt
  .undo(expectedRevision?: number): EditorReceipt
```

### loom-core/wires

```text
type DrawingStyle
type WireEffects
type WireGraph
createWireGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(canvas: HTMLCanvasElement, options: Omit<GraphOptions<N, E>, 'wireProgram'> & { wireEffects?: Partial<WireEffects>; drawingStyle?: Partial<DrawingStyle>; }): WireGraph<N, E>
  .destroy(): void
  .fit(immediate?: boolean): void
  .focus(id: string): void
  .getDrawingStyle(): Readonly<DrawingStyle>
  .getFrame(): GraphFrame
  .getPosition(id: string): { x: number; y: number; z: number; pinned: boolean; }
  .getViewport(): GraphViewport
  .getWireEffects(): Readonly<WireEffects>
  .invalidate(): void
  .on<K extends keyof GraphEvents>(type: K, listener: (value: GraphEvents[K]) => void): () => void
  .onFrame(listener: (frame: GraphFrame) => void): () => void
  .onTiming(probe: FrameProbe): () => void
  .pause(): void
  .pin(id: string, position?: { x: number; y: number; z?: number; }): void
  .reset(): void
  .resize(): void
  .resume(): void
  .screenToWorld(x: number, y: number, depth?: number): { x: number; y: number; z: number; }
  .select(id: string | null): void
  .setDrawingStyle(patch: Partial<DrawingStyle>): void
  .setLayout(options: LayoutOptions<N>): void
  .setMode(mode: Mode): void
  .setTheme(theme: Theme<N, E>): void
  .setViewport(viewport: GraphViewport): void
  .setWireEffects(patch: Partial<WireEffects>): void
  .stats(): GraphStats
  .unpin(id: string): void
value defaultDrawingStyle
value defaultWireEffects
value drawingStyleSchema
value sketchbook
value wireEffectsSchema
```

### loom-core/scene

```text
type GraphScene
type SceneCaptureOptions
captureScene<D extends GraphData>(data: D, options?: SceneCaptureOptions<D['nodes'][number], D['links'][number]>): GraphScene<D['nodes'][number], D['links'][number]> & { data: D; }
mountScene<N extends GraphNode, E extends GraphLink>(canvas: HTMLCanvasElement, scene: GraphScene<N, E>, options?: Pick<GraphOptions, 'workerURL' | 'sim' | 'reducedMotion'>): WireGraph<N, E>
  .destroy(): void
  .fit(immediate?: boolean): void
  .focus(id: string): void
  .getDrawingStyle(): Readonly<DrawingStyle>
  .getFrame(): GraphFrame
  .getPosition(id: string): { x: number; y: number; z: number; pinned: boolean; }
  .getViewport(): GraphViewport
  .getWireEffects(): Readonly<WireEffects>
  .invalidate(): void
  .on<K extends keyof GraphEvents>(type: K, listener: (value: GraphEvents[K]) => void): () => void
  .onFrame(listener: (frame: GraphFrame) => void): () => void
  .onTiming(probe: FrameProbe): () => void
  .pause(): void
  .pin(id: string, position?: { x: number; y: number; z?: number; }): void
  .reset(): void
  .resize(): void
  .resume(): void
  .screenToWorld(x: number, y: number, depth?: number): { x: number; y: number; z: number; }
  .select(id: string | null): void
  .setDrawingStyle(patch: Partial<DrawingStyle>): void
  .setLayout(options: LayoutOptions<N>): void
  .setMode(mode: Mode): void
  .setTheme(theme: Theme<N, E>): void
  .setViewport(viewport: GraphViewport): void
  .setWireEffects(patch: Partial<WireEffects>): void
  .stats(): GraphStats
  .unpin(id: string): void
```

### loom-core/console

```text
value consoleLayout
fromConsole<N extends GraphNode, E extends GraphLink>(graph: { nodes: readonly N[]; edges: readonly E[]; }): { nodes: readonly N[]; links: readonly E[]; }
mountConsoleGraph<N extends GraphNode, E extends GraphLink, Legacy>(canvas: HTMLCanvasElement, graph: { nodes: readonly N[]; edges: readonly E[]; }, enabled: boolean, legacy: (canvas: HTMLCanvasElement, graph: { nodes: readonly N[]; edges: readonly E[]; }) => Legacy, options?: Omit<GraphOptions<N, E>, keyof GraphData>): Legacy | LoomGraph<N, E>
readConsoleTheme(element: Element): Theme
```

### loom-core/drilldown

```text
type DrilldownGroup
type DrilldownLevel
type DrilldownOptions
type DrilldownSnapshot
type GroupAction
type GroupView
type LinkDirection
type Neighborhood
type NodeAction
createDrilldown<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>(source: GraphData<N, E>, initial?: DrilldownOptions<N, E>)
  .activate(id: string): boolean
  .back(): boolean
  .bind(graph: GraphPort, data?: GraphData<N, E>): () => void
  .followNode(id: string, patch?: Neighborhood<E>): boolean
  .getSnapshot(): DrilldownSnapshot<N, E>
  .getTrail(): { level: DrilldownLevel; selected: string | null; }[]
  .goTo(depth: number): boolean
  .inspect(id: string | null): void
  .openGroup(group: DrilldownGroup, override?: GroupAction): boolean
  .openNeighborhood(id: string, patch?: Neighborhood<E>): boolean
  .resolveLayout(mode: Mode, layout?: LayoutOptions<N>): { mode: Mode; layout: LayoutOptions<N>; }
  .select(id: string | null): void
  .setGroupView(action: GroupView): boolean
  .setOptions(patch: DrilldownOptions<N, E>): void
  .subscribe(listener: () => void): () => void
drilldownGroup(group: TaxonGroup, nodes: readonly GraphNode[]): DrilldownGroup
```

### loom-core/explore

```text
type BoundaryNode
type Neighbor
type SearchOptions
createGraphIndex<N extends GraphNode, E extends GraphLink>(data: GraphData<N, E>)
  .boundary(members: Iterable<string>): BoundaryNode<N>[]
  .neighbors(id: string, direction: "incoming" | "outgoing"): Neighbor<N, E>[]
  .search(query: string, { within, limit }?: SearchOptions): N[]
```

### loom-core/atlas

```text
type Atlas
type AtlasBlock
type AtlasCrossing
type AtlasLayout
type AtlasLink
type AtlasLoading
type AtlasManifest
type AtlasNode
type AtlasReader
type AtlasReaders
type AtlasReads
type AtlasScene
type AtlasSnapshot
type AtlasTopic
atlasConnections(manifest: AtlasManifest, topic: number): { topic: number; incoming: number; outgoing: number; total: number; }[]
value atlasLayouts
createAtlas(manifest: AtlasManifest, readers: AtlasReaders, loading?: AtlasLoading, initialLayout?: AtlasLayout)
  .block(id: number): AtlasBlock | undefined
  .close(): void
  .crossings(left: number, right: number): AtlasCrossing[]
  .getSnapshot(): AtlasSnapshot
  .retry(): Promise<void>
  .setExpanded(ids: Iterable<number>): Promise<void>
  .setLayout(next: AtlasLayout): void
  .setLoading(next: AtlasLoading): Promise<void>
  .subscribe(fn: () => void): () => void
  .toggle(id: number): Promise<void>
createFullAtlasReader(url: string | URL): AtlasReader
  .close(): void
  .read(topics: readonly number[]): Promise<AtlasBlock[]>
  .stats(): AtlasReads
```

### loom-core/atlas-map

```text
type AtlasMapOptions
type AtlasMemberMotion
type AtlasPositions
type AtlasSpringSettings
value atlasLayoutSpeed
value atlasSpringControls
mountAtlasMap(canvas: HTMLCanvasElement, atlas: Atlas, options: AtlasMapOptions)
  .destroy(): void
  .fit(): void
  .focus(id: string): void
  .focusConnection(source: string, target: string): void
  .getFollowedNode(): string | null
  .getFrame(): GraphFrame
  .getLayoutSpeed(): number
  .getPosition(id: string): { x: number; y: number; z: number; pinned: boolean; }
  .getPositions(): AtlasPositions
  .getSpring(): { strength: number; damping: number; }
  .getViewport(): GraphViewport
  .isAnimatingLayout(): boolean
  .moveTopic(id: number, position: Point): void
  .moveTopicByScreen(id: number, dx: number, dy: number): void
  .open(id: string): void
  .pick(id: string): void
  .resetPositions(): void
  .select(id: string | null): void
  .setAnimateLayouts(value: boolean): void
  .setKeepView(value: boolean): void
  .setLayoutSpeed(value: number): void
  .setMemberMotion(value: AtlasMemberMotion): void
  .setMoveMembers(value: boolean): void
  .setSpring(patch: Partial<AtlasSpringSettings>): void
  .setTheme(next: Theme<AtlasNode, AtlasLink>): void
  .zoom(factor: number): void
```

### loom-core/wikipedia-images

```text
type WikipediaImage
createWikipediaImages(request?: typeof fetch)
  .cancel(): void
  .lookup(title: string): Promise<Result>
```

### loom-core/atlas-sqlite

```text
type AtlasSQLiteOptions
createSQLiteAtlasReader(options: AtlasSQLiteOptions): AtlasReader
  .close(): void
  .read(topics: readonly number[]): Promise<AtlasBlock[]>
  .stats(): AtlasReads
```

### loom-core/cards

```text
type CardOptions
cardNeighborhood<N extends GraphNode, E extends GraphLink>(data: GraphData<N, E>, root: string, limit?: number): GraphData<N, E>
createCardGraph<N extends GraphNode, E extends GraphLink>(svg: SVGSVGElement, initial: GraphData<N, E>, initialOptions?: CardOptions<N, E>)
  .destroy(): void
  .fit(): void
  .focus(id: string): void
  .select(id: string | null, notify?: boolean): void
  .setData(next: GraphData<N, E>): void
  .setOptions(patch: Partial<CardOptions<N, E>>): void
  .zoom(factor: number): void
```

### loom-core/clusters

```text
type ClusterGroup
type ClusterOptions
type ClusterPoint
clusterLayout<N extends GraphNode>(nodes: readonly N[], groupBy: (node: N, index: number) => string, { gap, spacing, dimensions, depth, aspectRatio }?: ClusterOptions)
  .anchor(node: N): ClusterPoint | undefined
connectedComponents<N extends GraphNode, E extends GraphLink>(data: GraphData<N, E>, include?: (link: E) => boolean): (node: N) => string
```

### loom-core/metrics

```text
type NodeMetric
type ScaleOptions
type WireMetric
contentBytes(node: GraphNode): number | undefined
mapNodeRadius<N extends GraphNode>(data: GraphData<N>, by: NodeMetric<N>, options?: ScaleOptions): (node: N) => NodeStyle | undefined
mapWireWidth<E extends GraphLink>(data: GraphData<GraphNode, E>, by: WireMetric<E>, options?: ScaleOptions): (link: E, index: number) => WireStyle | undefined
```

### loom-core/performance

```text
type GPUStatus
type PerformanceSample
observePerformance(graph: Pick<LoomGraph, 'onTiming' | 'on' | 'stats'>, listener: (sample: PerformanceSample) => void): () => void
```

### loom-core/taxonomy

```text
type AnnotationOptions
type BoundaryStyle
type GraphAnnotations
type GraphLanguage
type Membership
type NodeDescription
type RelationGrouping
type TaxonGroup
type TaxonTerm
type TaxonomyConfig
type TaxonomyContext
type TaxonomyDefinition
type TaxonomyIndex
type TooltipContent
attachAnnotations(graph: Pick<LoomGraph, 'on' | 'onFrame'>, host: HTMLElement, index: TaxonomyIndex, options?: AnnotationOptions): GraphAnnotations
  .destroy(): void
  .setIndex(index: TaxonomyIndex): void
  .setOptions(options: Partial<AnnotationOptions>): void
compileTaxonomies<N extends GraphNode, E extends GraphLink>(data: GraphData<N, E>, { taxonomies, language }: TaxonomyConfig<N, E>): TaxonomyIndex
  .describe(id: string): NodeDescription | undefined
  .laneBy(taxonomy: string): (node: GraphNode) => string
  .legend(taxonomy: string): readonly TaxonGroup[]
  .nodeIndex(id: string): number | undefined
  .primary(id: string, taxonomy: string): TaxonGroup | undefined
  .tooltip(id: string): TooltipContent | undefined
parseTaxonomy(json: string): TaxonomyDefinition
scopeTaxonomies(source: TaxonomyIndex, nodes: readonly GraphNode[]): TaxonomyIndex
  .describe(id: string): NodeDescription | undefined
  .laneBy(taxonomy: string): (node: GraphNode) => string
  .legend(taxonomy: string): readonly TaxonGroup[]
  .nodeIndex(id: string): number | undefined
  .primary(id: string, taxonomy: string): TaxonGroup | undefined
  .tooltip(id: string): TooltipContent | undefined
```

## Schemas and runtime files

- `loom-core/editor.schema.json` describes versioned document transactions. [Open the editor schema](https://castlemilk.github.io/loom/editor.schema.json)
- `loom-core/wire-effects.schema.json` and `loom-core/drawing-style.schema.json` describe drawing controls. [Wire effects](https://castlemilk.github.io/loom/wire-effects.schema.json) · [Drawing style](https://castlemilk.github.io/loom/drawing-style.schema.json)
- `loom-core/layout-worker.js` is the optional force-layout worker. The SQLite worker and its WASM binary ship separately under `loom-core/atlas-runtime/*`. [Set up a streaming atlas](https://castlemilk.github.io/loom/docs/atlas/index.md)

## Read the index from code

The same versioned JSON index powers this page and ships in the package. Look up an import, enumerate its exports, or inspect a controller’s methods. TypeScript declarations in the archive contain the full types.

```js
import index from 'loom-core/api-index.json' with { type: 'json' }

const atlas = index.modules.find(module => module.name === 'loom-core/atlas-map')
const mount = atlas.exports.find(item => item.name === 'mountAtlasMap')
console.log(mount.methods.find(method => method.name === 'setLayoutSpeed'))
```

[Open the API index as JSON →](https://castlemilk.github.io/loom/docs/api-index.json)

An assistant can retrieve individual Markdown chapters from the documentation index. The tool-host example shows how to combine API discovery with reads and writes against a particular graph. [Documentation index](https://castlemilk.github.io/loom/llms.txt) · [Build an AI graph tool](https://castlemilk.github.io/loom/docs/ai-tooling/index.md)
