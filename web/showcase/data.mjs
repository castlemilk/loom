import { readFile } from 'node:fs/promises'
import { createGraphIndex } from '../../dist/explore.js'
import { loadBuiltinGraphs } from '../../mcp/catalog.js'
import { getConnection, indexGraph } from '../../mcp/query.js'

// Record from the same archive, graph IDs and query implementations as the public components.
export async function tourData() {
  const [wiki] = await loadBuiltinGraphs()
  const graph = wiki.data
  const index = createGraphIndex(graph)
  const [music] = index.search('Music'), [sound] = index.search('Sound')
  const outgoing = index.neighbors(music.id, 'outgoing')
  const soundLink = outgoing.find(({ node }) => node.id === sound.id)
  if (!soundLink) throw new Error('The Music → Sound link is missing from the tour dataset.')
  const connection = await getConnection(indexGraph(wiki), { from: music.id, to: sound.id, offset: 0, limit: 1 })
  const manifest = JSON.parse(await readFile(new URL('../public/examples/wikispeedia/manifest.json', import.meta.url)))
  const topic = manifest.topics.find(t => t.id === music.topic)
  const members = graph.nodes.filter(n => n.topic === topic.id)
  const memberIds = new Set(members.map(n => n.id))
  return {
    articles: manifest.articles, topic: { count: topic.count },
    members: members.map(n => ({ id: n.id, label: n.label })),
    edges: graph.links.filter(e => memberIds.has(e.source) && memberIds.has(e.target)).map(e => [e.source, e.target]),
    soundId: sound.id, neighbors: outgoing.map(({ node: { id, label, section } }) => ({ id, label, section })),
    evidence: connection.evidence,
  }
}
