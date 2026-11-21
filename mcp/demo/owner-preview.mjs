import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { graphServerFactory } from '../graph-server.js'
import { graphFileSource } from '../query.js'

// The same tools that ship in the CLI run on a private transport inside this tab.
export async function previewGraph(document, filename) {
  const source = graphFileSource(document, filename)
  const server = graphServerFactory([source])()
  const client = new Client({ name: 'loom-graph-setup', version: '1' })
  const [serverPort, clientPort] = InMemoryTransport.createLinkedPair()
  async function call(name, args) {
    const response = await client.callTool({ name, arguments: args })
    if (response.isError) throw new Error(response.content[0]?.text || 'The graph query failed.')
    return response.structuredContent
  }
  try {
    await server.connect(serverPort)
    await client.connect(clientPort)
    const catalog = await call('list_graphs', {})
    const [graph] = catalog.graphs
    const edge = source.data.links[0], node = source.data.nodes[0]
    if (edge) {
      const args = { graph: graph.id, from: edge.source, to: edge.target, limit: 1 }
      const result = await call('get_connection', args)
      return { graph, tool: 'get_connection', args, result,
        title: result.from.label + ' → ' + result.to.label,
        question: 'How does ' + result.from.label + ' connect to ' + result.to.label + ' in my graph?' }
    }
    if (node) {
      const args = { graph: graph.id, id: node.id }
      const result = await call('get_node', args)
      const label = result.node.label || result.node.id
      return { graph, tool: 'get_node', args, result, title: label, question: 'What does my graph record about ' + label + '?' }
    }
    return { graph, tool: 'list_graphs', args: {}, result: catalog, title: graph.name, question: 'Which graphs can I query?' }
  } finally {
    await Promise.allSettled([client.close(), server.close()])
  }
}
