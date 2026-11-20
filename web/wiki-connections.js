import { studioURL } from './site.js'

// Article IDs and topic slugs belong to the published Wikispeedia edition.
export const exampleConnections = [
  { title: 'Music → Sound', topics: ['music', 'science'], detail: 'The opening definition of music', edge: '74:2863' },
  { title: 'Algorithm → Computer science', topics: ['mathematics', 'computing'], detail: 'Turing machines in the introduction', edge: '1962:4100' },
  { title: 'Symmetry → Mosaic', topics: ['mathematics', 'art'], detail: 'Tile mosaics in architecture', edge: '1999:20' },
]

export function connectionURL(topics, edge) {
  return studioURL + 'wikispeedia/?connections=' + topics.map(encodeURIComponent).join(',') + '&edge=' + encodeURIComponent(edge)
}

export function topicSlug(topic) {
  return topic.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
}

export function parseEdge(value) {
  if (!/^\d+:\d+$/.test(value ?? '')) return null
  const [source, target] = value.split(':').map(Number)
  return Number.isSafeInteger(source) && Number.isSafeInteger(target) ? { source, target } : null
}
