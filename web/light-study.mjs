import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { loadBuiltinGraphs } from '../mcp/catalog.js'
import { indexGraph } from '../mcp/query.js'
import { topicSlug } from './wiki-connections.js'

const archive = 'https://dlab.epfl.ch/wikispeedia/wpcd/'
const evidenceDir = new URL('public/examples/wikispeedia/evidence/', import.meta.url)
const opening = { incoming: ['Architecture', 'Radio', 'Saffron'], outgoing: ['Rainbow', 'Microscope', 'Max Planck'] }
const alphabet = new Intl.Collator('en')

// Intersect the SDK's directed neighbors with the archived passages shown in Studio.
// Each subsequent focus needs just one static file, including all of its quotations.
export async function writeLightStudies(directory) {
  const [wiki] = await loadBuiltinGraphs()
  const { index } = indexGraph(wiki)
  const passages = new Map(), articlePages = new Map()
  for (const file of await readdir(evidenceDir)) {
    const { links, pages } = JSON.parse(await readFile(new URL(file, evidenceDir), 'utf8'))
    for (const [id, path] of Object.entries(pages)) articlePages.set(Number(id), new URL(path, archive).href)
    for (const [edge, [section, fragment, anchor, excerpt]] of Object.entries(links)) {
      if (!excerpt) continue
      const url = new URL(pages[edge.split(':')[0]], archive)
      url.hash = fragment
      passages.set(edge, { section, anchor, excerpt, sourceUrl: url.href })
    }
  }

  function neighbors(hub, side) {
    const branches = []
    for (const { node } of index.neighbors(hub.id, side)) {
      const pair = side === 'incoming' ? [node, hub] : [hub, node]
      const edge = pair.map(n => n.article).join(':')
      const passage = passages.get(edge)
      if (passage) branches.push({ id: node.article, name: node.label, edge,
        topics: pair.map(n => topicSlug({ label: n.section })), ...passage })
    }
    // Lead with complete sentences. Every other sourced link stays available.
    branches.sort((a, b) => Number(a.excerpt.includes('…')) - Number(b.excerpt.includes('…')) || alphabet.compare(a.name, b.name))
    if (hub.label !== 'Light') return branches
    const first = opening[side].map(name => {
      const branch = branches.find(item => item.name === name)
      if (!branch) throw new Error('Missing opening Wikipedia link for ' + name)
      return branch
    })
    return [...first, ...branches.filter(item => !first.includes(item))]
  }

  await mkdir(directory, { recursive: true })
  let initial
  const nodes = wiki.data.nodes
  for (let start = 0; start < nodes.length; start += 64) {
    await Promise.all(nodes.slice(start, start + 64).map(async node => {
      const incoming = neighbors(node, 'incoming'), outgoing = neighbors(node, 'outgoing')
      if (!incoming.length && !outgoing.length) return
      const study = { id: node.article, hub: node.label, sourceUrl: articlePages.get(node.article),
        totals: { incoming: incoming.length, outgoing: outgoing.length }, incoming, outgoing }
      await writeFile(new URL(node.article + '.json', directory), JSON.stringify(study))
      if (node.label === 'Light') initial = { ...study, incoming: incoming.slice(0, 3), outgoing: outgoing.slice(0, 3) }
    }))
  }
  if (!initial) throw new Error('Missing Light neighborhood')
  return initial
}
