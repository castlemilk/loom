import { createGraph, ink, type GraphNode, type GraphData, type GraphLink } from 'loom-core'
import { compileTaxonomies, attachAnnotations, scopeTaxonomies, type TaxonomyConfig } from 'loom-core/taxonomy'
import { createDrilldown, drilldownGroup, type DrilldownOptions, type GroupView } from 'loom-core/drilldown'
import { observePerformance, type PerformanceSample } from 'loom-core/performance'
import { clusterLayout, connectedComponents } from 'loom-core/clusters'
import { mapNodeRadius, mapWireWidth } from 'loom-core/metrics'
import { createWireGraph, wireEffectsSchema, type WireEffects } from 'loom-core/wires'
import { atlasConnections, atlasLayouts, createAtlas, createFullAtlasReader, type AtlasManifest, type AtlasLayout } from 'loom-core/atlas'
import { createSQLiteAtlasReader, type AtlasSQLiteOptions } from 'loom-core/atlas-sqlite'
import { atlasLayoutSpeed, atlasSpringControls, mountAtlasMap, type AtlasPositions, type AtlasMemberMotion, type AtlasSpringSettings } from 'loom-core/atlas-map'
import { createWikipediaImages } from 'loom-core/wikipedia-images'
import { createCardGraph } from 'loom-core/cards'
import { captureScene, mountScene, type GraphScene } from 'loom-core/scene'

interface Paper extends GraphNode {
  disciplines: readonly string[]
  year: number
}
interface Citation extends GraphLink { reviewed: boolean }
export function mountCitationScene(canvas: HTMLCanvasElement, data: GraphData<Paper, Citation> & { title: string }) {
  const scene = captureScene(data, {
    layout: { laneBy: node => node.disciplines[0] },
    theme: { ...ink, wires: { resolve: edge => ({ width: edge.reviewed ? 2 : 1 }) } },
  })
  const saved: GraphScene<Paper, Citation> = scene
  return { title: scene.data.title, graph: mountScene(canvas, saved) }
}
export function mountStreamingAtlas(canvas: HTMLCanvasElement, manifest: AtlasManifest, sqlite: AtlasSQLiteOptions, baseline: URL, positions?: AtlasPositions, memberMotion: AtlasMemberMotion = 'spring') {
  const atlas = createAtlas(manifest, { 'on-demand': () => createSQLiteAtlasReader(sqlite), full: () => createFullAtlasReader(baseline) })
  const spring: AtlasSpringSettings = { strength: atlasSpringControls.strength.default, damping: 0.65 }
  const images = createWikipediaImages()
  const map = mountAtlasMap(canvas, atlas, { theme: ink, keepView: true, animateLayouts: true, layoutSpeed: atlasLayoutSpeed.default, moveMembers: true, positions, memberMotion, spring,
    onPick: node => { if (node.kind === 'topic') void atlas.toggle(node.topic) },
    onOpen(node) { map.focus(node.id) } })
  return {
    setLoading: atlas.setLoading, expand: atlas.setExpanded, fit: map.fit,
    layouts: atlasLayouts, setLayout: (value: AtlasLayout) => atlas.setLayout(value),
    animateLayouts: map.setAnimateLayouts, isMoving: map.isAnimatingLayout, focus: map.focus,
    setLayoutSpeed: map.setLayoutSpeed, layoutSpeed: map.getLayoutSpeed, followed: map.getFollowedNode, image: images.lookup,
    tune: map.setSpring, readSpring: map.getSpring, nudge: map.moveTopicByScreen,
    moveTopic: map.moveTopic, setMoveMembers: map.setMoveMembers, setMemberMotion: map.setMemberMotion, save: map.getPositions, reset: map.resetPositions,
    connectedTopics: (topic: number) => atlasConnections(manifest, topic), crossings: atlas.crossings, focusConnection: map.focusConnection,
    close() { images.cancel(); map.destroy(); atlas.close() },
  }
}
export function mountCitationCards(svg: SVGSVGElement, data: GraphData<Paper,Citation>) {
  const cards = createCardGraph(svg, data, {root:data.nodes[0]?.id, badge:n=>String(n.year), relationship:e=>e.reviewed?'Reviewed citation':'Citation'})
  cards.setOptions({appearance:'dots',showPorts:false})
  return cards
}
export function mountWires(canvas: HTMLCanvasElement, data: GraphData<Paper, Citation>) {
  const patch = { direction: 'flow', scope: 'selected', speed: 40 } satisfies Partial<WireEffects>
  const graph = createWireGraph(canvas, { ...data, wireEffects: patch,
    theme: { ...ink, wires: { resolve: (edge) => ({ width: edge.reviewed ? 2 : 1 }) } } })
  graph.setWireEffects({ separation: 24 })
  return { graph, settings: graph.getWireEffects(), schema: wireEffectsSchema }
}
const vocabulary = {
  taxonomies: [
    { id: 'subject', label: 'Discipline', by: 'disciplines' },
    { id: 'review', label: 'Review', by: (paper, context) =>
      context.linksFor(paper.id).some((link) => link.reviewed) ? 'reviewed' : 'unreviewed' },
    { id: 'category', label: 'Category', by: { relation: 'filed-in', groupEnd: 'target' } },
  ],
  language: {
    title: (paper) => paper.id + ' (' + paper.year + ')',
    tooltip: (_paper, detail) => ({ title: detail.title, lines: detail.groups.map((group) => group.label) }),
  },
} satisfies TaxonomyConfig<Paper, Citation>

export function mountCatalogue(canvas: HTMLCanvasElement, layer: HTMLElement, data: GraphData<Paper, Citation>) {
  const taxonomy = compileTaxonomies(data, vocabulary)
  const graph = createGraph(canvas, { ...data, mode: 'lanes', layout: { laneBy: taxonomy.laneBy('subject') },
    theme: { ...ink, nodes: { resolve: (node) => taxonomy.primary(node.id, 'subject') },
      wires: { resolve: (citation) => ({ width: citation.reviewed ? 2 : 1 }) } } })
  graph.setLayout({ laneBy: (paper) => String(paper.year) })
  graph.setTheme({ ...ink, nodes: { resolve: (paper) => ({ radius: paper.disciplines.length + 2 }) } })
  const annotations = attachAnnotations(graph, layer, taxonomy, { bubbles: { subject: ['physics'], review: true }, laneTaxonomy: 'subject' })
  graph.setLayout({ cloudDepth: 1.5, autoRotate: false })
  const components = connectedComponents(data, (citation) => citation.reviewed)
  const clusters = clusterLayout(data.nodes, components, { dimensions: 3, gap: 75 })
  graph.setLayout({ anchor: clusters.anchor, blend: 0.76 })
  graph.setTheme({ ...ink, nodes: { resolve: mapNodeRadius(data, (paper) => paper.metrics?.figures ?? paper.year) },
    wires: { pattern: 'solid', byKind: { cites: { pattern: 'dotted' } },
      resolve: mapWireWidth(data, 'connections', { range: [1, 6], curve: 'sqrt' }) } })
  annotations.setOptions({ boundary: { shape: 'cloud', padding: 15 },
    boundaryFor: (group) => group.id === 'physics' ? { pattern: 'dashed', width: 2 } : undefined })
  const stop = observePerformance(graph, (s: PerformanceSample) => { void [s.gpuMs, s.heapBytes, s.frameIntervals] })
  stop()
  annotations.setOptions({ tooltips: false, bubblesVisible: false })
  graph.onFrame(({ width, height, points }) => { void [width, height, points[0]] })
  return graph
}

export function mountDrilldown(canvas: HTMLCanvasElement, underlay: HTMLElement, overlay: HTMLElement, data: GraphData<Paper, Citation>) {
  const options = { groupAction: (group) => group.taxonomy === 'subject' ? 'expand' : 'isolate',
    openAction: (paper) => paper.year > 2000 ? 'neighbors' : 'focus',
    neighborhood: { direction: 'outgoing', includeLink: (citation) => citation.reviewed },
    arrangement: 'rings', memberSpacing: 36, spread: 2, expansionBlend: 0.7,
  } satisfies DrilldownOptions<Paper, Citation>
  const controller = createDrilldown(data, options)
  const snapshot = controller.getSnapshot()
  const index = scopeTaxonomies(compileTaxonomies(data, vocabulary), snapshot.data.nodes)
  const graph = createGraph(canvas, { ...snapshot.data, transparentBackground: true, ...controller.resolveLayout('cloud') })
  controller.bind(graph, snapshot.data)
  attachAnnotations(graph, overlay, index, { underlay, bubbles: { subject: true }, groupGesture: 'click',
    onOpenGroup: (term) => controller.openGroup(drilldownGroup(term, snapshot.data.nodes)),
    activeGroup: { id: 'physics', taxonomy: 'subject', boundary: 'outline' } })
  return { controller, graph,
    setGroupView: (view: GroupView) => controller.setGroupView(view),
    memberYears: () => controller.getSnapshot().groupMembers.map((paper) => paper.year),
    inspectMember: (id: string) => controller.inspect(id),
  }
}

// @ts-expect-error A numeric field needs a classifier converting its value into a group id.
const invalid: TaxonomyConfig<Paper> = { taxonomies: [{ id: 'year', label: 'Year', by: 'year' }] }
void invalid

import { createEditor, restoreEditor, editorSchema, type EditorTransaction } from 'loom-core/editor'

export function authorCatalogue(data: GraphData<Paper, Citation>) {
  const editor = createEditor(data, { documentId: 'papers', historyLimit: 10 })
  const { documentId, revision } = editor.describe()
  const edit = { version: 1, documentId, expectedRevision: revision, operations: [
    { op: 'node.add', value: { id: 'p2', label: 'Second paper', disciplines: ['Optics'] } },
    { op: 'link.add', value: { id: 'cite', source: 'p1', target: 'p2', reviewed: true } },
  ] } satisfies EditorTransaction
  const preview = editor.preview(edit)
  if (!preview.ok) return preview.error.code
  const result = editor.apply(edit)
  if (result.ok) editor.transact([{ op: 'link.update', id: 'cite', unset: ['reviewed'] }], result.revision)
  const restored = restoreEditor(editor.checkpoint())
  return { schema: editorSchema, record: restored.getNode('p2'), links: restored.query({ entity: 'link', incidentTo: 'p2' }) }
}

export const addPaper = (doc: ReturnType<typeof createEditor>, paper: Paper) =>
  doc.transact([{ op: 'node.add', value: paper }])

import { createGraphIndex } from 'loom-core/explore'
import { sketchbook, drawingStyleSchema, type DrawingStyle } from 'loom-core/wires'

export function explorePapers(canvas: HTMLCanvasElement, data: GraphData<Paper, Citation>, id: string) {
  const index = createGraphIndex(data), nav = createDrilldown(data)
  nav.followNode(id)
  const drawingStyle: DrawingStyle = { fill: 'hachure', roughness: 1, hatchSpacing: 6 }
  const graph = createWireGraph(canvas, { ...data, theme: sketchbook, drawingStyle })
  graph.setDrawingStyle({ fill: 'cross-hatch' })
  return { year: index.search(id)[0]?.year, reviewed: index.neighbors(id, 'outgoing')[0]?.links[0].reviewed,
    boundary: index.boundary([id]), style: graph.getDrawingStyle(), schema: drawingStyleSchema }
}
