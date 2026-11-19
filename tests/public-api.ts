import { createGraph, ink, type GraphNode, type GraphData, type GraphLink } from 'loom-core'
import { compileTaxonomies, attachAnnotations, scopeTaxonomies, type TaxonomyConfig } from 'loom-core/taxonomy'
import { createDrilldown, drilldownGroup, type DrilldownOptions, type GroupView } from 'loom-core/drilldown'
import { observePerformance, type PerformanceSample } from 'loom-core/performance'
import { clusterLayout, connectedComponents } from 'loom-core/clusters'
import { mapNodeRadius, mapWireWidth } from 'loom-core/metrics'

interface Paper extends GraphNode {
  disciplines: readonly string[]
  year: number
}
interface Citation extends GraphLink { reviewed: boolean }
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
