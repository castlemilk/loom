'use client'

import { useRef, useState } from 'react'
import { artURL, docsURL, mcpURL, studioURL } from '../site'

const parts = [
  { id: 'studio', title: 'Graph Studio', job: 'Draw and inspect', mark: 'style.webp', href: studioURL + '?example=bauhaus', action: 'Open the Bauhaus graph' },
  { id: 'sdk', title: 'TypeScript SDK', job: 'Build into your app', mark: 'layout.webp', href: docsURL, action: 'Read the SDK guide' },
  { id: 'mcp', title: 'Graph MCP', job: 'Connect an assistant', mark: 'graph-mcp.png', href: mcpURL, action: 'Explore Graph MCP' },
]

export function ComponentShowcase({ passage }) {
  const [selected, select] = useState(0)
  const tabs = useRef([])
  function navigate(event, i) {
    const count = parts.length
    const next = { ArrowDown: (i + 1) % count, ArrowUp: (i + count - 1) % count, Home: 0, End: count - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next)
    tabs.current[next].focus()
  }
  return <section id="components" className="guide-width component-section" aria-labelledby="component-title">
    <div className="component-selector"><h2 id="component-title">Loom components</h2>
      <div role="tablist" aria-label="Loom components" aria-orientation="vertical" className="component-tabs">{parts.map((part, i) =>
        <button key={part.id} type="button" id={'part-' + part.id} role="tab" aria-selected={i === selected}
          aria-controls={'panel-' + part.id} tabIndex={i === selected ? 0 : -1}
          ref={el => { tabs.current[i] = el }} onKeyDown={event => navigate(event, i)} onClick={() => select(i)}>
          <img src={artURL(part.mark)} alt="" width="40" height="40" /><span><strong>{part.title}</strong><small>{part.job}</small></span><i aria-hidden="true">→</i>
        </button>)}</div>
    </div>
    {parts.map((part, i) => <div key={part.id} className={'component-panel panel-' + part.id} role="tabpanel" id={'panel-' + part.id}
      aria-labelledby={'part-' + part.id} hidden={selected !== i} tabIndex={0}>
      <div className="panel-work">{part.id === 'studio' ? <>
        <div className="panel-title"><strong>Bauhaus</strong><span>15 articles · 52 links</span></div>
        <img className="studio-specimen" width="804" height="500" src={artURL('bauhaus-studio.webp')} alt="The Bauhaus graph in Studio, with artists, schools and workshops connected by Wikipedia links." />
      </> : part.id === 'sdk' ? <>
        <div className="panel-title"><strong>Search the same graph</strong><span>TypeScript</span></div>
        <pre className="feature-source"><code><b>import</b> {'{ createGraphIndex }'} <b>from</b> <i>'loom-core/explore'</i>{'\n\n'}<b>const</b> index = createGraphIndex(bauhaus){'\n'}<b>const</b> [artist] = index.search(<i>'Anni Albers'</i>){'\n'}index.neighbors(artist.id, <i>'outgoing'</i>)</code></pre>
      </> : <>
        <div className="panel-title"><strong>Follow a Wikipedia link</strong><span>get_connection</span></div>
        <div className="connection-specimen"><div className="connection-pair"><b>Music</b><span aria-label="links to">→</span><b>Sound</b></div>
          <blockquote>{passage}</blockquote><small>2007 Schools Wikipedia Selection</small></div>
      </>}</div>
      <div className="panel-caption"><p>{['Select an article on the canvas to follow its connections.', 'Use the graph index in your own interface, with or without a canvas.', 'Ask for a connection and receive its original source passage.'][i]}</p>
        <a href={part.href}>{part.action} <span aria-hidden="true">↗</span></a></div>
    </div>)}
  </section>
}
