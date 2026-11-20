import type {
  GraphData, GraphLink, GraphNode, GraphOptions, GraphViewport, LayoutOptions,
  LoomGraph, Mode, NodeStyle, Theme, WireStyle,
} from './types.js'
import { createWireGraph, type DrawingStyle, type WireEffects, type WireGraph } from './wires.js'

type Table<T> = Readonly<Record<string, T>>
type Position = ReturnType<LoomGraph['getPosition']>
type Anchor = Pick<Position, 'x' | 'y'> & { z?: number }
type SceneTheme = Omit<Theme, 'nodes' | 'wires'> & {
  nodes?: Omit<NonNullable<Theme['nodes']>, 'resolve'>
  wires?: Omit<NonNullable<Theme['wires']>, 'resolve'>
}

/** A portable graph and its canvas appearance. Node and link records retain their application fields. */
export interface GraphScene<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink> {
  version: 1
  data: GraphData<N, E>
  mode?: Mode
  layout?: Omit<LayoutOptions, 'laneBy' | 'anchor'>
  theme?: SceneTheme
  drawingStyle?: Partial<DrawingStyle>
  wireEffects?: Partial<WireEffects>
  lanes?: Table<string>
  anchors?: Table<Anchor>
  nodeStyles?: Table<NodeStyle>
  /** Keys are link indices so parallel and anonymous edges retain their individual styling. */
  linkStyles?: Table<WireStyle>
  /** Each resolved image URL is stored once, even when many nodes share a data URL. */
  artwork?: { urls: readonly string[]; byNode: Table<number> }
  positions?: Table<Position>
  viewport?: GraphViewport
  selected?: string
}

export interface SceneCaptureOptions<N extends GraphNode = GraphNode, E extends GraphLink = GraphLink>
  extends Pick<GraphOptions<N, E>, 'layout' | 'theme' | 'art' | 'mode'> {
  drawingStyle?: Partial<DrawingStyle>
  wireEffects?: Partial<WireEffects>
  /** Capture live coordinates, pin states and the camera from the graph showing these records. */
  graph?: Pick<LoomGraph, 'getPosition' | 'getViewport'>
  selected?: string | null
}

/** Sample layout and appearance callbacks once, so a JSON consumer never needs the author's code. */
export function captureScene<D extends GraphData>(
  data: D, options: SceneCaptureOptions<D['nodes'][number], D['links'][number]> = {},
): GraphScene<D['nodes'][number], D['links'][number]> & { data: D } {
  const { layout, theme, graph, art, mode, drawingStyle, wireEffects, selected } = options
  const scene: GraphScene & { data: D } = { version: 1, data, mode, drawingStyle, wireEffects }
  const { laneBy, anchor, ...layoutValues } = layout ?? {}
  if (layout) scene.layout = layoutValues
  const { resolve: marker, ...nodeValues } = theme?.nodes ?? {}
  const { resolve: wire, ...wireValues } = theme?.wires ?? {}
  if (theme) scene.theme = { ...theme, nodes: theme.nodes && nodeValues, wires: theme.wires && wireValues }
  const degrees = new Map<string, number>()
  if (marker) {
    for (const { source, target } of data.links) {
      degrees.set(source, (degrees.get(source) ?? 0) + 1)
      degrees.set(target, (degrees.get(target) ?? 0) + 1)
    }
  }
  function nodeTable<T>(read: (node: D['nodes'][number], index: number) => T | undefined | null) {
    const values: Record<string, T> = Object.create(null)
    data.nodes.forEach((node, i) => {
      const value = read(node, i)
      if (value != null) values[node.id] = value
    })
    return values
  }
  if (laneBy) scene.lanes = nodeTable(laneBy)
  if (anchor) scene.anchors = nodeTable(anchor)
  if (art) {
    const images = new Map<string, number>()
    const byNode = nodeTable(node => {
      const url = art.urlFor(node)
      if (!url) return
      if (!images.has(url)) images.set(url, images.size)
      return images.get(url)
    })
    scene.artwork = { urls: Array.from(images.keys()), byNode }
  }
  if (marker) scene.nodeStyles = nodeTable(node => marker(node, node.degree ?? degrees.get(node.id) ?? 0))
  if (wire) {
    const styles: Record<string, WireStyle> = Object.create(null)
    data.links.forEach((link, i) => {
      const style = wire(link, i)
      if (style) styles[i] = style
    })
    scene.linkStyles = styles
  }
  if (graph) {
    scene.positions = nodeTable(node => graph.getPosition(node.id))
    scene.viewport = graph.getViewport()
  }
  if (selected != null) scene.selected = selected
  return scene
}

function lookup<T>(table: Table<T> | undefined, key: string | number): T | undefined {
  return table && Object.hasOwn(table, key) ? table[key] : undefined
}

/** Render a saved scene in a sized canvas. The caller owns the returned graph and calls destroy() on unmount. */
export function mountScene<N extends GraphNode, E extends GraphLink>(
  canvas: HTMLCanvasElement, scene: GraphScene<N, E>,
  options: Pick<GraphOptions, 'workerURL' | 'sim' | 'reducedMotion'> = {},
): WireGraph<N, E> {
  if (scene?.version !== 1) throw new TypeError('Unsupported Loom scene version')
  const { data, theme, positions, lanes, anchors, nodeStyles, linkStyles, artwork } = scene
  const graph = createWireGraph<N, E>(canvas, {
    ...options, nodes: positions ? data.nodes.map(node => ({ ...node, ...lookup(positions, node.id) })) : data.nodes,
    links: data.links, mode: scene.mode, drawingStyle: scene.drawingStyle, wireEffects: scene.wireEffects,
    layout: { ...scene.layout,
      laneBy: lanes && (node => lookup(lanes, node.id) ?? node.kind ?? ''),
      anchor: anchors && (node => lookup(anchors, node.id)),
    },
    theme: theme && { ...theme,
      nodes: { ...theme.nodes, resolve: nodeStyles && (node => lookup(nodeStyles, node.id)) },
      wires: { ...theme.wires, resolve: linkStyles && ((_, i) => lookup(linkStyles, i)) },
    },
    art: artwork && { urlFor(node) {
      const slot = lookup(artwork.byNode, node.id)
      return slot === undefined ? undefined : artwork.urls[slot]
    } },
  })
  try {
    if (scene.selected != null) graph.select(scene.selected)
    if (scene.viewport) graph.setViewport(scene.viewport)
    return graph
  } catch (error) {
    graph.destroy()
    throw error
  }
}
