import type { Notebook, RecordNode } from './notebook-types.js'

const moons: RecordNode[] = [
  { id: 'titan', label: 'Titan', kind: 'Moon', art: 'haze',
    x: -143, y: 65, metadata: { 'Targeted flybys': 127 } },
  { id: 'enceladus', label: 'Enceladus', kind: 'Moon', art: 'ice',
    x: 143, y: 65, metadata: { 'Targeted flybys': 23 } },
]

export const graph: Notebook = {
  nodes: [
    { id: 'cassini', label: 'Cassini', kind: 'Spacecraft', art: 'orbiter',
      x: 0, y: -64, metadata: { Launch: 1997, 'Saturn orbits': 293, Partners: ['NASA', 'ESA', 'ASI'] } },
    ...moons,
  ],
  links: moons.map(moon => ({
    source: 'cassini', target: moon.id, kind: 'flew past',
    note: `Cassini made ${moon.metadata?.['Targeted flybys']} targeted flybys of ${moon.label}.`,
    sourceURL: 'https://science.nasa.gov/mission/cassini/quick-facts/',
  })),
  images: {
    orbiter: { src: 'cassini.webp', alt: 'Cassini in the assembly room at the Jet Propulsion Laboratory.',
      credit: 'NASA/JPL', sourceURL: 'https://science.nasa.gov/photojournal/cassini-spacecraft-in-a-jpl-assembly-room/' },
    haze: { src: 'titan.webp', alt: 'Titan’s orange haze seen by Cassini.',
      credit: 'NASA/JPL-Caltech/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/a-last-look-at-titan/' },
    ice: { src: 'enceladus.webp', alt: 'Fractured ice on Enceladus, shown in false color.',
      credit: 'NASA/JPL/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/enceladus-in-false-color/' },
  },
}
