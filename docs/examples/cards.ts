import { cardNeighborhood, createCardGraph } from 'loom-core/cards'

export function showCanva(svg: SVGSVGElement) {
  const data = {
    nodes: [
      { id: 'canva', label: 'Canva', kind: 'Startup' },
      { id: 'melanie', label: 'Melanie Perkins', kind: 'Person' },
      { id: 'blackbird', label: 'Blackbird Ventures', kind: 'Investor', x: 415, y: -90 },
    ],
    links: [
      { source: 'melanie', target: 'canva', label: 'Founder' },
      { source: 'blackbird', target: 'canva', label: 'Listed in portfolio' },
    ],
  }
  return createCardGraph(svg, cardNeighborhood(data, 'canva'), {
    root: 'canva',
    badge: node => node.kind,
    relationship: link => link.label,
  })
}
