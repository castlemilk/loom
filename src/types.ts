export type Mode = 'drift' | 'lanes' | 'orbit' | 'cloud'
export interface GraphNode {
  id: string
  label?: string
  kind?: string
  x?: number
  y?: number
  z?: number
  /** Defaults to true for nodes supplied with both x and y. Set false to seed a movable node. */
  pinned?: boolean
  art?: string
  degree?: number
}
export interface GraphLink {
  source: string
  target: string
  kind?: string
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
}
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
  mode?: Mode
  theme?: Theme<NoInfer<N>, NoInfer<E>>
  layout?: LayoutOptions<NoInfer<N>>
  art?: { urlFor: (node: NoInfer<N>) => string | undefined }
  sim?: 'main' | 'worker'
  workerURL?: string | URL
  reducedMotion?: 'respect' | 'ignore'
}
export interface GraphEvents {
  select: string | null
  hover: string | null
  open: string
  modechange: Mode
  destroy: undefined
}
/** CSS-pixel screen coordinates are borrowed until the next draw, in input node order. */
export interface GraphFrame {
  /** Four floats per node: screen x, screen y, visible radius, camera depth. */
  readonly points: Readonly<Float32Array>
  readonly width: number
  readonly height: number
  readonly mode: Mode
  readonly zoom: number
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
  dpr: number
  pendingFrame: boolean
  transport: 'main' | 'transfer' | 'shared'
}
export interface LoomGraph<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  /** Subscribe to actual paints. The first subscription wakes an idle graph once. */
  onFrame(listener: (frame: GraphFrame) => void): () => void
  select(id: string | null): void
  focus(id: string): void
  setMode(mode: Mode): void
  setLayout(options: LayoutOptions<N>): void
  setTheme(theme: Theme<N, E>): void
  getPosition(id: string): { x: number; y: number; z: number; pinned: boolean }
  pin(id: string, position?: { x: number; y: number; z?: number }): void
  unpin(id: string): void
  fit(): void
  reset(): void
  pause(): void
  resume(): void
  resize(): void
  destroy(): void
  on<K extends keyof GraphEvents>(type: K, listener: (value: GraphEvents[K]) => void): () => void
  stats(): GraphStats
}
