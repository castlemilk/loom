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
export interface GraphData {
  nodes: readonly GraphNode[]
  links: readonly GraphLink[]
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
export interface LayoutOptions {
  /** 0 uses the active force mode. 1 places movable nodes exactly on their anchors. */
  blend?: number
  laneOrder?: readonly string[]
  laneGap?: number
  rowGap?: number
  direction?: 'horizontal' | 'vertical'
  anchor?:
    ((node: GraphNode, index: number) => { x: number; y: number; z?: number } | null | undefined) | null
  repulsion?: number
  linkDistance?: number
  springStrength?: number
  /** Per-kind rest distances and multipliers for the global spring strength. */
  springsByKind?: Readonly<Record<string, { distance?: number; strength?: number }>>
  pinOnDrag?: boolean
  guides?: boolean
}
export interface Theme {
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
    resolve?: (node: GraphNode, degree: number) => NodeStyle | undefined
  }
  wires?: WireStyle & {
    routing?: WireRoute
    hotWidth?: number
    byKind?: Readonly<Record<string, WireStyle>>
    resolve?: (link: GraphLink, index: number) => WireStyle | undefined
  }
  grid?: { spacing?: number; color?: string; opacity?: number }
  labels?: { density?: number; visibility?: 'auto' | 'focus' | 'none'; alternateSide?: boolean }
}
export interface GraphOptions extends GraphData {
  mode?: Mode
  theme?: Theme
  layout?: LayoutOptions
  art?: { urlFor: (node: GraphNode) => string | undefined }
  sim?: 'main' | 'worker'
  workerURL?: string | URL
  reducedMotion?: 'respect' | 'ignore'
}
export interface GraphEvents {
  select: string | null
  hover: string | null
  open: string
  modechange: Mode
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
export interface LoomGraph {
  select(id: string | null): void
  focus(id: string): void
  setMode(mode: Mode): void
  setLayout(options: LayoutOptions): void
  setTheme(theme: Theme): void
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
