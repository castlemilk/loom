import type { Notebook } from './notebook-types.js'

export const graph: Notebook = {
  nodes: [
    {
      id: 'saturn', label: 'Saturn',
      kind: 'Planet', art: 'rings',
      x: 0, y: -64,
      metadata: {
        'Order from Sun': 6,
        'Planet type': 'Gas giant',
      },
    },
    {
      id: 'titan', label: 'Titan', kind: 'Moon',
      art: 'haze', x: -143, y: 65,
      metadata: { Atmosphere: 'Dense haze', 'Huygens landing': '14 January 2005' },
    },
    {
      id: 'enceladus', label: 'Enceladus', kind: 'Moon',
      art: 'ice', x: 143, y: 65,
      metadata: { Surface: 'Water ice', 'Subsurface ocean': true },
    },
  ],
  links: [
    { source: 'titan', target: 'saturn', kind: 'orbits',
      note: 'Titan is the largest moon of Saturn.', sourceURL: 'https://science.nasa.gov/saturn/moons/titan/' },
    { source: 'enceladus', target: 'saturn', kind: 'orbits',
      note: 'Enceladus orbits inside the planet’s E ring.', sourceURL: 'https://science.nasa.gov/saturn/moons/enceladus/' },
  ],
  images: {
    rings: { src: 'saturn.webp', alt: 'The golden disc of Saturn framed by its rings.',
      credit: 'NASA/JPL-Caltech/SSI/Cornell', sourceURL: 'https://science.nasa.gov/photojournal/jewel-of-the-solar-system/' },
    haze: { src: 'titan.webp', alt: 'Titan’s hazy amber disc against black space.',
      credit: 'NASA/JPL-Caltech/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/a-last-look-at-titan/' },
    ice: { src: 'enceladus.webp', alt: 'A false-color view of fractures across the icy surface of Enceladus.',
      credit: 'NASA/JPL/Space Science Institute', sourceURL: 'https://science.nasa.gov/photojournal/enceladus-in-false-color/' },
  },
}
