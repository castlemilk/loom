'use client'

import { useState } from 'react'
import graph from '../../../demo/atlases/bauhaus.json'
import { getNeighbors, indexGraph, searchNodes } from '../../../mcp/query.js'

const atlas = indexGraph({ id: 'bauhaus', name: graph.name, data: graph })
const first = 'Anni_Albers'

export function GraphExplorer() {
  const [query, setQuery] = useState(''), [history, setHistory] = useState([first])
  const [direction, setDirection] = useState('outgoing')
  const id = history.at(-1), node = atlas.node(id)
  const hits = query.trim() ? searchNodes(atlas, { query, offset: 0, limit: 15 }).items : graph.nodes.slice(0, 5).map(atlas.reference)
  const result = getNeighbors(atlas, { id, direction, offset: 0, limit: 50 })
  function inspect(next) {
    if (next !== id) setHistory(list => [...list, next])
    setQuery('')
  }
  return <div className="graph-explorer">
    <div className="explorer-index">
      <label htmlFor="graph-node-search">Find an article</label>
      <input id="graph-node-search" type="search" placeholder="Name, subject or artist" value={query} onChange={e => setQuery(e.target.value)} />
      <ul aria-label="Article search results">{hits.map(hit => <li key={hit.id}><button type="button" aria-pressed={id === hit.id}
        onClick={() => inspect(hit.id)}>{hit.label}<span aria-hidden="true">↗</span></button></li>)}</ul>
      {hits.length === 0 && <p role="status">No matching articles. Try a name such as Albers.</p>}
    </div>
    <div className="explorer-node"><div className="node-kicker"><span>{node.section}</span>
      <button type="button" disabled={history.length < 2} onClick={() => setHistory(h => h.slice(0, -1))}>← Back</button></div>
      <h3 aria-live="polite">{node.label}</h3><p>{node.summary}</p>
      <a className="node-citation" href={graph.revisionUrlTemplate.replace('{wikipediaRevision}', node.wikipediaRevision)}>Wikipedia source ↗</a>
      <div className="edge-direction" role="group" aria-label="Link direction">{['outgoing', 'incoming'].map(d =>
        <button key={d} type="button" aria-pressed={d === direction} onClick={() => setDirection(d)}>{d === 'outgoing' ? 'Links to' : 'Linked from'}</button>)}</div>
      <ul className="neighbor-list" aria-label="Connected articles">{result.items.map(({ node: n }) =>
        <li key={n.id}><button type="button" onClick={() => inspect(n.id)}>{n.label}<span aria-hidden="true">→</span></button></li>)}</ul>
      {result.total === 0 && <p>No links in this direction.</p>}
      <details className="tool-response"><summary>View the tool response <code>get_neighbors</code></summary><pre tabIndex={0}>{JSON.stringify(result, null, 2)}</pre></details>
    </div>
  </div>
}
