import { createGraphIndex } from './data/explore.js'

/** Accept an SDK graph, a Studio scene, or the console's original edge-list format. */
export function graphDocument(value) {
  const graph = Array.isArray(value?.nodes) ? value : value?.data
  const links = graph?.links ?? graph?.edges
  if (!Array.isArray(graph?.nodes) || !Array.isArray(links)) throw new TypeError('Expected a graph with nodes and links, or a Studio scene containing data.')
  for (const node of graph.nodes) {
    if (typeof node?.id !== 'string' || !node.id.length) throw new TypeError('Every node needs a non-empty string ID.')
    for (const key of ['label', 'section', 'kind', 'summary']) {
      if (node[key] != null && typeof node[key] !== 'string') throw new TypeError('Expected a string for node ' + node.id + ' field ' + key)
    }
  }
  for (const link of links) {
    if (typeof link?.source !== 'string' || typeof link?.target !== 'string') throw new TypeError('Every link needs string source and target IDs.')
  }
  return { nodes: graph.nodes, links }
}

const nodeUri = (graph, id) => 'loom://graphs/node?graph=' + encodeURIComponent(graph) + '&id=' + encodeURIComponent(id)

function page(items, { offset, limit }) {
  const next = offset + limit
  return { items: items.slice(offset, next), total: items.length, nextOffset: next < items.length ? next : null }
}

export function indexGraph(source) {
  const data = graphDocument(source.data)
  const nodes = new Map(data.nodes.map(node => [node.id, node]))
  const index = createGraphIndex(data)
  function node(id) {
    const found = nodes.get(id)
    if (!found) throw new Error('Unknown node ID in ' + source.id + ': ' + id)
    return found
  }
  function reference(n) {
    return { id: n.id, label: n.label ?? n.id, kind: n.kind, section: n.section, uri: nodeUri(source.id, n.id) }
  }
  function details(id) {
    const card = node(id)
    return { node: card, uri: nodeUri(source.id, id),
      incoming: index.neighbors(id, 'incoming').reduce((n, row) => n + row.links.length, 0),
      outgoing: index.neighbors(id, 'outgoing').reduce((n, row) => n + row.links.length, 0) }
  }
  const info = { id: source.id, name: source.name, nodes: nodes.size, links: data.links.length,
    source: source.source, attribution: source.attribution, licenseUrl: source.licenseUrl }
  return { source, info, index, node, reference, details }
}

export function shortestPath(g, from, to, maxHops) {
  g.node(from)
  g.node(to)
  const previous = new Map([[from, null]])
  let frontier = [from]
  for (let depth = 0; depth < maxHops && frontier.length && !previous.has(to); depth++) {
    const next = []
    for (const id of frontier) {
      for (const { node } of g.index.neighbors(id, 'outgoing')) {
        if (previous.has(node.id)) continue
        previous.set(node.id, id)
        next.push(node.id)
      }
      if (previous.has(to)) break
    }
    frontier = next
  }
  if (!previous.has(to)) return { found: false, maxHops, path: [] }
  const path = []
  for (let id = to; id !== null; id = previous.get(id)) path.push(g.reference(g.node(id)))
  return { found: true, hops: path.length - 1, path: path.reverse() }
}

export function searchNodes(g, args) {
  const result = page(g.index.search(args.query), args)
  return { ...result, items: result.items.map(g.reference) }
}

export function getNeighbors(g, args) {
  const result = page(g.index.neighbors(args.id, args.direction), args)
  return { ...result, direction: args.direction, items: result.items.map(row => ({ node: g.reference(row.node), linkCount: row.links.length })) }
}

export async function getConnection(g, args) {
  const from = g.node(args.from), to = g.node(args.to)
  const links = g.index.neighbors(from.id, 'outgoing').find(row => row.node.id === to.id)?.links ?? []
  const evidence = links.length && g.source.evidence ? await g.source.evidence(from, to) : null
  return { from: g.reference(from), to: g.reference(to), ...page(links, args), evidence }
}
