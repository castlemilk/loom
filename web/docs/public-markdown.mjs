import { readFile } from 'node:fs/promises'
import { collectionSlugs, publicPagePaths } from '../public-pages.js'

const readJSON = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const namedLink = (label, url) => '[' + label + '](' + url + ')'
const paragraph = lines => lines.join('\n\n')

export async function publicMarkdown(site) {
  const link = (label, path) => namedLink(label, new URL(path, site))
  const docs = (label, chapter = '') => link(label, 'docs/' + (chapter ? chapter + '/' : ''))
  const pages = {
    'mcp/live/': ['Try a live OAuth graph query', paragraph([
      'Choose Connect over HTTP, review the requested graph:read permission, and continue as a guest. Loom Guest asks for consent and returns to GitHub Pages. The browser exchanges its authorization code using PKCE for five minutes of read access.',
      'Choose List graph tools, then Run get_connection. The result shows the archived passage linking Music to Sound. Open graph browser to explore other public graphs with the same grant. Cancel returns to the walkthrough without granting access.',
      link('MCP setup, providers and tools', 'mcp/'),
    ])],
    '': ['Loom: interactive graph visualization in TypeScript', paragraph([
      'Loom is an MIT-licensed TypeScript SDK for interactive network diagrams and knowledge graphs. Use its WebGL2 renderer to draw and explore nodes and links or its headless editor to preview and apply revision-checked commands.',
      'Graph Studio is the visual editor. The live OAuth demo on GitHub Pages connects to the hosted Graph MCP server to search public graph data, trace paths and retrieve indexed source evidence.',
      docs('Build your first graph') + ' · ' + link('Open Graph Studio', 'studio/') + ' · ' + link('Connect Graph MCP', 'mcp/') + ' · ' + namedLink('Source and license', 'https://github.com/castlemilk/loom'),
    ])],
    'artwork/': ['Loom artwork', paragraph([
      'The artwork archive includes graphite illustrations for Explore, Layout, Groups and Style, the Loom mark, its social preview and Graph MCP icon.',
      'The wire study is a still illustration; its separate graph JSON records the joints and rods. Instrument Serif is used for display type. Studio controls use sans-serif text and measurements use monospaced type.',
      link('Wire study image', 'illustrations/wire-study-1280.webp') + ' · ' + link('Wire model JSON', 'examples/wire-model.json') + ' · ' + link('Font license', 'licenses/instrument-serif.txt'),
    ])],
    'studio/': ['Loom Graph Studio', paragraph([
      'Loom Graph Studio is a browser editor for interactive WebGL2 graphs. Add nodes, link them, style the drawing and choose a layout. Select a graph example or import node and link data from JSON.',
      'Export a scene and runnable JavaScript or TypeScript starter, or download the full document for later editing. The interactive canvas and editing controls require JavaScript and WebGL2. Studio URLs with an example or selected article represent a view of the same Studio, not a different installation.',
      docs('Graph editing and export', 'editing') + ' · ' + docs('Layouts and styling', 'drawing') + ' · ' + docs('Performance measurement', 'performance'),
    ])],
    'studio/cards/': ['Around Canva: relationship cards', paragraph([
      'This Loom Studio example lays out Canva, its founders and investors as relationship cards. Select a card to see nearby connections. A relationship can link to its source evidence.',
      'It is an example of exploring and citing relationships, not a comprehensive or current company directory.',
      docs('Build relationship cards', 'navigation') + ' · ' + link('Open Graph Studio', 'studio/'),
    ])],
    'studio/wikispeedia/': ['Wikispeedia: Wikipedia topic map', paragraph([
      'Explore the historical Wikispeedia dataset of 4,604 articles and 119,882 directed hyperlinks. Open a topic to expand its articles; inspect selected cross-topic links to reach an archived source. Not every link has a retained excerpt.',
      'The on-demand version reads clusters through SQLite/WASM over HTTP byte ranges. The all-at-once option loads the equivalent data from JSON.',
      docs('Build a streaming atlas', 'atlas') + ' · ' + link('Query it with Graph MCP', 'mcp/') + ' · ' + namedLink('Stanford dataset citation', 'https://snap.stanford.edu/data/wikispeedia.html'),
    ])],
  }
  const catalog = await readJSON('../../demo/atlases/catalog.json')
  for (const slug of collectionSlugs) {
    const graph = await readJSON('../../demo/atlases/' + slug + '.json')
    const counts = new Map()
    for (const edge of graph.links) counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1)
    const groups = Object.keys(catalog[slug].sections).map(section => [
      '## ' + section, '',
      ...graph.nodes.filter(node => node.section === section).map(node => '- ' +
        link(node.label, 'studio/?' + new URLSearchParams({ example: slug, article: node.id })) +
        ' (' + (counts.get(node.id) ?? 0) + ' outgoing links)'),
    ].join('\n'))
    pages['examples/' + slug + '/'] = [graph.name + ' Wikipedia graph', paragraph([
      catalog[slug].description + ' This collection contains ' + graph.nodes.length + ' articles and ' + graph.links.length + ' directed links.',
      link('Explore the graph in Studio', 'studio/?example=' + slug) + ' · ' + namedLink('Wikipedia content license', graph.licenseUrl),
      ...groups,
    ])]
  }
  return publicPagePaths.filter(path => path !== 'mcp/').map(path => {
    const [title, body] = pages[path]
    return { path, title, body: paragraph(['# ' + title, link('Open the canonical Loom page', path), body]) + '\n' }
  })
}
