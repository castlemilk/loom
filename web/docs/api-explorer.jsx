'use client'

import { useState } from 'react'
import { chapterURL } from './catalog'

const modules = {
  'loom-core': ['Mount a WebGL2 graph, read its camera, and serialize graph data.', ''],
  wires: ['Draw separated connections, directional flow and sketch-style markers.', 'drawing'],
  cards: ['Render an SVG neighborhood with relationship labels and draggable cards.', 'navigation'],
  atlas: ['Manage topic blocks, layout choices, cached reads and cross-topic links.', 'atlas'],
  'atlas-map': ['Mount a topic map and control its camera, gravity and layout transitions.', 'atlas'],
  'atlas-sqlite': ['Read SQLite pages in a worker when a topic opens.', 'atlas'],
  'wikipedia-images': ['Look up lead images, canonical titles and file credits.', 'atlas'],
  explore: ['Index article titles, directed neighbors and group boundaries.', 'navigation'],
  drilldown: ['Navigate graph scopes and restore a breadcrumb trail.', 'navigation'],
  taxonomy: ['Classify nodes and attach legends, annotations and group outlines.', 'navigation'],
  clusters: ['Compute connected components and pack groups around stable anchors.', 'drawing'],
  metrics: ['Map numeric data to node radii and wire widths.', 'drawing'],
  editor: ['Preview, apply and undo revision-guarded document edits.', 'editing'],
  performance: ['Sample rendering work, layout ticks and GPU timing.', ''],
  console: ['Adapt a knowledge-console snapshot and read its host theme.', ''],
}
function groups(index, query) {
  const term = query.trim().toLowerCase()
  const has = value => value.toLowerCase().includes(term)
  return index.modules.flatMap(mod => {
    const [description, guide] = modules[mod.name.split('/').at(-1)] ?? ['', null]
    const all = has(mod.name) || has(description)
    const items = mod.exports.flatMap(item => {
      if (all || has(item.name)) return [item]
      const methods = item.methods?.filter(m => has(m.name))
      return methods?.length ? [{ ...item, methods }] : []
    })
    return items.length ? [{ ...mod, description, guide, items }] : []
  })
}
export function ApiExplorer({ index }) {
  const [query, setQuery] = useState('')
  const matches = groups(index, query), filtering = !!query.trim()
  return <div className="docs-api">
    <label htmlFor="docs-symbol">Find an API</label>
    <input id="docs-symbol" type="search" placeholder="Module, function, type or method" value={query} onChange={e => setQuery(e.target.value)} />
    <p role="status">{matches.length} {matches.length === 1 ? 'module' : 'modules'}{filtering ? ' matched' : ' in loom-core ' + index.version}</p>
    {!matches.length && <button type="button" onClick={() => setQuery('')}>Clear search</button>}
    {matches.map(mod => <details key={mod.name + (filtering ? ':search' : '')} open={filtering || undefined} className="docs-module">
      <summary><code>{mod.name}</code><span>{mod.description}</span></summary>
      <div className="docs-symbols">
        {mod.items.filter(item => item.kind !== 'type').map(item => <div key={item.name} className="docs-function">
          {(item.signatures ?? [item.name]).map(s => <code key={s}>{s}</code>)}
          {item.summary && <p>{item.summary}</p>}
          {item.methods?.length > 0 && <details open={filtering || undefined}>
            <summary>Returned methods <span>({item.methods.length})</span></summary>
            <ul>{item.methods.map(method => <li key={method.name}>{method.signatures.map(s => <code key={s}>{s}</code>)}</li>)}</ul>
          </details>}
        </div>)}
        {mod.items.some(item => item.kind === 'type') && <div className="docs-types"><h3>Types</h3>
          {mod.items.filter(item => item.kind === 'type').map(item =>
            <details key={item.name} open={filtering && query.trim().toLowerCase() === item.name.toLowerCase() || undefined}>
              <summary><code>{item.name}</code></summary>
              {item.summary && <p>{item.summary}</p>}
              <pre tabIndex={0} aria-label={item.name}><code>{item.declaration ?? item.name}</code></pre>
            </details>)}</div>}
        {mod.guide != null && <a href={chapterURL(mod.guide)}>Read the guide →</a>}
      </div>
    </details>)}
  </div>
}
