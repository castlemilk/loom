export type Mode = 'drift' | 'lanes' | 'orbit' | 'cloud'
export interface GraphNode {
  id: string
  label?: string
  kind?: string
  /** Authored overrides for this marker, applied after theme and taxonomy styling. */
  markerColor?: string
  markerShape?: NodeShape
  x?: number
  y?: number
  z?: number
  /** Defaults to true for nodes supplied with both x and y. Set false to seed a movable node. */
  pinned?: boolean
  art?: string
  degree?: number
  section?: string
  summary?: string
  content?: string
  /** Authored content size in bytes. The metric helper can also measure supplied text. */
  contentSize?: number
  complexity?: number
  metrics?: Readonly<Record<string, number>>
}
export interface GraphLink {
  /** Optional stable document identity. The editor assigns IDs to older anonymous links. */
  id?: string
  source: string
  target: string
  kind?: string
  weight?: number
  metrics?: Readonly<Record<string, number>>
}
export interface GraphData<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  nodes: readonly N[]
  links: readonly E[]
}
export type NodeShape = 'circle' | 'ring' | 'square' | 'rounded-square'
export interface NodeStyle {
  shape?: NodeShape
  color?: string
  /** Absolute world-space radius. Omit to retain degree-based sizing. */
  radius?: number
}
export interface WireStyle {
  color?: string
  opacity?: number
  width?: number
  pattern?: WirePattern
}
export type WirePattern = 'solid' | 'dashed' | 'dotted'
export type WireRoute = 'arc' | 'patch' | 'straight'
export interface LayoutOptions<N extends GraphNode = GraphNode> {
  /** 0 uses the active force mode. 1 places movable nodes exactly on their anchors. */
  blend?: number
  laneOrder?: readonly string[]
  /** Classify nodes into lanes. The default uses node.kind. */
  laneBy?: (node: N, index: number) => string
  laneGap?: number
  /** Minimum world-space distance between successive orbit rings. */
  orbitGap?: number
  /** Depth multiplier for generated Cloud coordinates. Authored z coordinates take precedence. */
  cloudDepth?: number
  /** Slowly orbit an idle Cloud. Reduced motion suppresses automatic rotation. */
  autoRotate?: boolean
  rowGap?: number
  direction?: 'horizontal' | 'vertical'
  anchor?:
    ((node: N, index: number) => { x: number; y: number; z?: number } | null | undefined) | null
  repulsion?: number
  linkDistance?: number
  springStrength?: number
  /** Per-kind rest distances and multipliers for the global spring strength. */
  springsByKind?: Readonly<Record<string, { distance?: number; strength?: number }>>
  pinOnDrag?: boolean
  guides?: boolean
}
export interface Theme<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  kind: Readonly<Record<string, string>>
  ink: string
  dim: string
  accent: string
  bg: string
  bezel: string
  font: string
  fontSize: number
  radii: { hub: number; content: number }
  plateAlpha: number
  nodes?: {
    scale?: number
    artwork?: boolean
    ringWidth?: number
    fill?: number
    byKind?: Readonly<Record<string, NodeStyle>>
    resolve?: (node: N, degree: number) => NodeStyle | undefined
  }
  wires?: WireStyle & {
    routing?: WireRoute
    hotWidth?: number
    byKind?: Readonly<Record<string, WireStyle>>
    resolve?: (link: E, index: number) => WireStyle | undefined
  }
  grid?: { spacing?: number; color?: string; opacity?: number }
  labels?: { density?: number; visibility?: 'auto' | 'focus' | 'none'; alternateSide?: boolean }
}
export interface GraphOptions<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> extends GraphData<N, E> {
  /** Rendering extension supplied by loom-core/wires. */
  wireProgram?: WireProgram
  /** Composite marks over a host background, for example an SVG group boundary layer. Set on the canvas's first mount. */
  transparentBackground?: boolean
  mode?: Mode
  theme?: Theme<NoInfer<N>, NoInfer<E>>
  layout?: LayoutOptions<NoInfer<N>>
  art?: { urlFor: (node: NoInfer<N>) => string | undefined }
  sim?: 'main' | 'worker'
  workerURL?: string | URL
  reducedMotion?: 'respect' | 'ignore'
}
/** @internal Instanced lane attributes and scene parameters for optional drawing effects. */
export interface WireProgram {
  nodeFragment?: string
  vertex: string
  fragment: string
  slots: Float32Array
  parameters: Float32Array
  step(deltaMs: number, selectedIndex: number, reducedMotion: boolean): boolean
}
export interface GraphEvents {
  select: string | null
  /** A click or tap on a node or its label, including repeated clicks on the current selection. */
  nodeclick: string
  hover: string | null
  open: string
  /** A clean click on empty graph space, in canvas CSS pixels. Nodes and labels take precedence. */
  backgroundclick: { x: number; y: number; clicks: number }
  modechange: Mode
  destroy: undefined
}
/** CSS-pixel screen coordinates are borrowed until the next draw, in input node order. */
export interface GraphFrame {
  /** Changes when the graph rebuilds its projected coordinates. Older frame providers may omit it. */
  readonly projectionVersion?: number
  /** Four floats per node: screen x, screen y, visible radius, camera depth. */
  readonly points: Readonly<Float32Array>
  readonly width: number
  readonly height: number
  readonly mode: Mode
  readonly zoom: number
  readonly yaw: number
  readonly pitch: number
  /** Screen coordinate of world zero on the lane axis. */
  readonly laneOrigin: number
  readonly vertical: boolean
  /** Lane identifiers and their world-space offsets, in visual order. */
  readonly lanes: ReadonlyMap<string, number>
}
export interface GraphStats {
  firstSubmitMs: number
  frames: number
  simTicks: number
  drawCalls: number
  labels: number
  imageTiles: number
  /** Bytes in the packed position/radius and edge-endpoint arrays. */
  geometryBytes: number
  dpr: number
  pendingFrame: boolean
  transport: 'main' | 'transfer' | 'shared'
}
export interface FrameProbe {
  beginDraw(gl: WebGL2RenderingContext): void
  endDraw(): void
  sample(time: number, mainThreadMs: number, intervalMs: number, painted: boolean): void
}
export interface GraphViewport { x: number; y: number; z: number; zoom: number; yaw: number; pitch: number }
export interface LoomGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  /** Request one paint on the existing scheduler. Honors pause, visibility and disposal. */
  invalidate(): void
  /** Subscribe to actual paints. The first subscription wakes an idle graph once. */
  onFrame(listener: (frame: GraphFrame) => void): () => void
  /** Read current projected points synchronously, including while the graph is paused. */
  getFrame(): GraphFrame
  /** Attach an optional timing probe to this graph. Returns its detach function. */
  onTiming(probe: FrameProbe): () => void
  select(id: string | null): void
  focus(id: string): void
  setMode(mode: Mode): void
  setLayout(options: LayoutOptions<N>): void
  setTheme(theme: Theme<N, E>): void
  /** Convert canvas CSS pixels to the camera-facing world plane at the given camera depth. */
  screenToWorld(x: number, y: number, depth?: number): { x: number; y: number; z: number }
  getViewport(): GraphViewport
  setViewport(viewport: GraphViewport): void
  getPosition(id: string): { x: number; y: number; z: number; pinned: boolean }
  pin(id: string, position?: { x: number; y: number; z?: number }): void
  unpin(id: string): void
  /** Frame the graph bounds. Pass true to apply the fitted viewport synchronously. */
  fit(immediate?: boolean): void
  reset(): void
  pause(): void
  resume(): void
  resize(): void
  destroy(): void
  on<K extends keyof GraphEvents>(type: K, listener: (value: GraphEvents[K]) => void): () => void
  stats(): GraphStats
}
