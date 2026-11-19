import { createGraph, ink, type GraphNode, type GraphData, type GraphLink } from 'loom-core'
import { compileTaxonomies, attachAnnotations, type TaxonomyConfig } from 'loom-core/taxonomy'
import { observePerformance, type PerformanceSample } from 'loom-core/performance'

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
  const stop = observePerformance(graph, (s: PerformanceSample) => { void [s.gpuMs, s.heapBytes, s.frameIntervals] })
  stop()
  annotations.setOptions({ tooltips: false })
  graph.onFrame(({ width, height, points }) => { void [width, height, points[0]] })
  return graph
}

// @ts-expect-error A numeric field needs a classifier converting its value into a group id.
const invalid: TaxonomyConfig<Paper> = { taxonomies: [{ id: 'year', label: 'Year', by: 'year' }] }
void invalid
