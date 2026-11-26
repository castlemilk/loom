// Shared by the public HTML guide, its Markdown and the downloadable JSON index.
// URLs are relative to the deployed site; no credentials or write endpoints.
export const nodeGraphTitle = 'Node graph library for TypeScript'
export const nodeGraphIntro = 'Loom is an open-source node graph library for building interactive node-link diagrams in JavaScript or TypeScript. Use the WebGL2 renderer to explore relationships, or use the headless editor to preview and apply changes against a known graph revision.'
export const nodeGraphBoundary = 'Loom visualises and edits graph documents in your app. It is not a hosted graph database or an RDF query engine. The public examples are read-only data; the hosted MCP demo still requires guest consent.'
export const nodeGraphExamples = [
  {
    id: 'around-canva',
    label: 'Read the Canva relationship graph',
    description: 'Inspect the example’s founder and portfolio relationships without opening the canvas. Each row links to its recorded evidence.',
    html: 'studio/cards/', markdown: 'studio/cards/index.md', data: 'examples/around-canva.json',
  },
  {
    id: 'bauhaus',
    label: 'Follow a Bauhaus article into Studio',
    description: 'Open the HTML article index, follow a named article into Studio, or read the same nodes and links as JSON.',
    html: 'examples/bauhaus/', markdown: 'examples/bauhaus/index.md', data: 'examples/bauhaus.json',
  },
  {
    id: 'outer-solar-system',
    label: 'Explore the Outer Solar System graph',
    description: 'Browse the article index in HTML or read the JSON. Choose an article to open the surrounding graph.',
    html: 'examples/outer-solar-system/', markdown: 'examples/outer-solar-system/index.md', data: 'examples/outer-solar-system.json',
  },
  {
    id: 'wikispeedia',
    label: 'Trace Music to Sound',
    description: 'Follow the archived Music article’s hyperlink to Sound. The interactive permalink opens that exact connection.',
    html: 'studio/wikispeedia/?connections=music,science&edge=74%3A2863',
    markdown: 'studio/wikispeedia/index.md', data: 'examples/wikispeedia/evidence/1-9.json',
    source: 'https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm',
  },
]
export const nodeGraphReferences = [
  { label: 'Build your first graph', href: 'docs/' },
  { label: 'Layouts and styling for nodes and edges', href: 'docs/drawing/' },
  { label: 'Edit a graph document', href: 'docs/editing/' },
  { label: 'Read the TypeScript API index (JSON)', href: 'docs/api-index.json' },
  { label: 'Read the editor transaction schema (JSON)', href: 'editor.schema.json' },
  { label: 'Query a graph with Graph MCP', href: 'mcp/' },
]

export function graphAgentIndex(site) {
  const absolute = path => new URL(path, site).href
  return {
    version: 1, name: 'Loom Graph SDK', guide: absolute('node-graph/'),
    markdown: absolute('node-graph/index.md'), assistantIndex: absolute('llms.txt'),
    access: 'Public example files need no account. The hosted MCP demo uses guest consent. This index does not grant access or authorize writes.',
    examples: nodeGraphExamples.map(({ html, markdown, data, ...entry }) =>
      ({ ...entry, html: absolute(html), markdown: absolute(markdown), data: absolute(data) })),
    references: nodeGraphReferences.map(entry => ({ ...entry, href: absolute(entry.href) })),
  }
}
