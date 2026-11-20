import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { graphDocument } from './query.js'

const assets = new URL('./data/', import.meta.url)
const readJSON = async (url) => JSON.parse(await readFile(url, 'utf8'))

export async function loadGraphFile(path) {
  const doc = await readJSON(path)
  const data = graphDocument(doc)
  const name = [doc.data?.title, doc.title, doc.name, doc.data?.name].find(value => typeof value === 'string' && value.trim())
  return { id: 'local', name: name ?? basename(path), data }
}

async function wikispeedia() {
  const [manifest, blocks] = await Promise.all(['wikispeedia-manifest.json', 'wikispeedia.json'].map(name => readJSON(new URL(name, assets))))
  const nodes = [], links = [], cache = new Map()
  for (const { topic, articles, edges } of blocks) {
    for (const [article, label] of articles) {
      nodes.push({ id: 'article:' + article, label, section: manifest.topics[topic].label, kind: 'article', topic, article })
    }
    for (const [a, b] of edges) links.push({ source: 'article:' + a, target: 'article:' + b, kind: 'wikilink' })
  }
  async function evidence(from, to) {
    if (from.topic === to.topic) return null
    const pair = [from.topic, to.topic].sort((a, b) => a - b).join('-')
    if (!cache.has(pair)) cache.set(pair, readJSON(new URL('evidence/' + pair + '.json', assets)).catch(error => { cache.delete(pair); throw error }))
    const { pages, links } = await cache.get(pair)
    const record = links[from.article + ':' + to.article]
    if (!record) return null
    const [section, fragment, anchor, excerpt] = record
    const page = new URL(pages[from.article], 'https://dlab.epfl.ch/wikispeedia/wpcd/')
    if (fragment) page.hash = fragment
    return { section, anchor, excerpt: excerpt || null, sourceUrl: page.href }
  }
  return { id: 'wikispeedia', name: 'Wikispeedia', data: { nodes, links }, source: manifest.source,
    attribution: 'Wikispeedia navigation network and 2007 Schools Wikipedia Selection contributors',
    licenseUrl: 'https://dlab.epfl.ch/wikispeedia/wpcd/wp/w/Wikipedia_Text_of_the_GNU_Free_Documentation_License.htm', evidence }
}

export async function loadBuiltinGraphs() {
  const [wiki, knowledge, ...collections] = await Promise.all([
    wikispeedia(), readJSON(new URL('knowledge.json', assets)),
    ...['bauhaus', 'outer-solar-system'].map(async id => {
      const doc = await readJSON(new URL(id + '.json', assets))
      const nodes = doc.nodes.map(n => ({ ...n, sourceUrl: doc.revisionUrlTemplate.replace('{wikipediaRevision}', n.wikipediaRevision) }))
      return { id, name: doc.name, data: { nodes, links: doc.links }, attribution: doc.attribution, licenseUrl: doc.licenseUrl }
    }),
  ])
  return [wiki, { id: 'knowledge', name: 'Knowledge console', data: knowledge, source: 'https://benebsworth.com/' }, ...collections]
}
