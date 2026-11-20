import { loadBuiltinGraphs } from '../mcp/catalog.js'
import { getConnection, indexGraph } from '../mcp/query.js'
import { topicSlug } from './wiki-connections.js'

// Build the page from the same graph and archived pages as Studio and Graph MCP.
export async function lightStudy() {
  const [wiki] = await loadBuiltinGraphs()
  const graph = indexGraph(wiki)
  function article(title) {
    const [node] = graph.index.search(title, { limit: 1 })
    if (node?.label !== title) throw new Error('Missing Wikispeedia article: ' + title)
    return node
  }
  const light = article('Light')

  async function branch(title, incoming) {
    const other = article(title)
    const [from, to] = incoming ? [other, light] : [light, other]
    const { evidence } = await getConnection(graph, { from: from.id, to: to.id, offset: 0, limit: 1 })
    if (!evidence?.excerpt) throw new Error('Missing Wikipedia passage for ' + from.label + ' → ' + to.label)
    return {
      name: other.label,
      edge: from.article + ':' + to.article,
      topics: [from, to].map(node => topicSlug({ label: node.section })),
      ...evidence,
    }
  }

  return {
    hub: light.label,
    incoming: await Promise.all(['Architecture', 'Radio', 'Saffron'].map(title => branch(title, true))),
    outgoing: await Promise.all(['Rainbow', 'Microscope', 'Max Planck'].map(title => branch(title, false))),
  }
}
