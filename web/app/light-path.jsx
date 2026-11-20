'use client'

import { useState } from 'react'
import { artURL, docsURL, studioURL } from '../site'
import { connectionURL } from '../wiki-connections'
import './light-path.css'

// Percent coordinates are shared by the optical rays and their HTML links.
const hub = [49, 48]
const ends = {
  incoming: [[18, 24], [9, 55], [25, 82]],
  outgoing: [[83, 19], [88, 49], [77, 81]],
}
const sides = ['incoming', 'outgoing']
const colours = ['#ffac85', '#a8dacb', '#aec5f8']
const position = ([x, y]) => ({ left: x + '%', top: y + '%' })
const point = ([x, y]) => [x * 10, y * 3.6]

function Ray({ end, incoming, selected, colour, href, onTrace }) {
  const [a, b] = (incoming ? [end, hub] : [hub, end]).map(point)
  const middle = a.map((n, axis) => n + (b[axis] - n) * (incoming ? .45 : .66))
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const reach = Math.hypot(dx, dy)
  const points = [a, middle, b].map(p => p.join(',')).join(' ')
  return <a className="path-ray" data-lit={selected} style={{ '--ray': colour }} href={href} onClick={onTrace} tabIndex={-1}>
    {selected && !incoming && <path d={`M0 -11 L${reach} 0 L0 11 Z`}
      transform={`translate(${a}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`} fill="url(#refracted-light)" />}
    <polyline className="ray-line" points={points} markerMid={'url(#' + (selected ? 'lit-arrow' : 'unlit-arrow') + ')'} />
    <polyline className="ray-hit" points={points} />
  </a>
}

function Passage({ branch }) {
  const { excerpt, anchor } = branch
  const start = excerpt.toLowerCase().indexOf(anchor.toLowerCase())
  if (start < 0) return excerpt
  return <>{excerpt.slice(0, start)}<mark>{excerpt.slice(start, start + anchor.length)}</mark>{excerpt.slice(start + anchor.length)}</>
}

export function LightPath({ study }) {
  const [trail, setTrail] = useState({ incoming: 1, outgoing: 0, reading: 'outgoing' })
  const first = study.incoming[trail.incoming], last = study.outgoing[trail.outgoing]
  const reading = study[trail.reading][trail[trail.reading]]
  const href = branch => connectionURL(branch.topics, branch.edge)
  const names = (side, branch) => side === 'incoming' ? [branch.name, study.hub] : [study.hub, branch.name]

  function trace(event, side, i) {
    // Real permalinks also work with JavaScript disabled or Open in New Tab.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setTrail(current => ({ ...current, [side]: i, reading: side }))
  }

  return <section id="light-path" className="light-study" aria-labelledby="guide-title">
    <div className="guide-width light-spread">
      <div className="light-intro">
        <h1 id="guide-title"><span className="light-product">Interactive graphs in TypeScript</span>
          <span className="light-title"><span className="light-name" data-long={first.name.length > 8}>{first.name}</span>{' '}
            <span className="light-destination" data-long={last.name.length > 8}>to <em>{last.name}.</em></span></span>
        </h1>
        <p>Follow two Wikipedia links through <strong>Light</strong>. Choose an article or a ray to read the passage behind the link.</p>
      </div>
      <div className="light-map" role="group" aria-label="Wikipedia paths through Light">
        <div className="map-directions" aria-hidden="true"><span>Links into {study.hub}</span><span>Links out of {study.hub}</span></div>
        <div className="optical-bench">
          <svg viewBox="0 0 1000 360" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs><linearGradient id="refracted-light" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="-11" y2="11">
              <stop stopColor="#f38470"/><stop offset=".25" stopColor="#ffbb74"/><stop offset=".49" stopColor="#ede8aa"/>
              <stop offset=".64" stopColor="#9edac5"/><stop offset=".82" stopColor="#86c2e8"/><stop offset="1" stopColor="#ad9dce"/>
            </linearGradient>{['lit', 'unlit'].map(state => <marker key={state} id={state + '-arrow'} viewBox="0 0 12 10" refX="6" refY="5" markerWidth="12" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M2 1L9 5L2 9" fill="none" stroke={state === 'lit' ? '#f9f6df' : '#82918c'} strokeWidth="1.7" />
            </marker>)}</defs>
            {sides.map(side => study[side].map((branch, i) => <Ray key={branch.edge} end={ends[side][i]} incoming={side === 'incoming'}
              selected={trail[side] === i} colour={side === 'incoming' ? '#f4f2db' : colours[i]} href={href(branch)} onTrace={event => trace(event, side, i)} />))}
          </svg>
          {sides.map(side => <div key={side} role="group" aria-label={side === 'incoming' ? 'Choose a starting article' : 'Choose a destination article'}>
            {study[side].map((branch, i) => <a key={branch.edge} className="path-article" data-upper={i === 0} style={{ ...position(ends[side][i]), '--ray': side === 'incoming' ? '#f4f2db' : colours[i] }}
              href={href(branch)} aria-label={'Trace ' + names(side, branch).join(' to ')} aria-current={trail[side] === i ? 'true' : undefined}
              onClick={event => trace(event, side, i)}><span className="article-pin" aria-hidden="true" /><span>{branch.name}</span></a>)}
          </div>)}
          <a className="light-hub" style={position(hub)} href={last.sourceUrl.split('#')[0]} aria-label="Read the archived Light article">
            <img src={artURL('light-prism.webp')} width="560" height="418" alt="" fetchPriority="high" /><span>{study.hub}</span>
          </a>
        </div>
      </div>
      <div className="light-reader">
        <nav className="passage-steps" aria-label="Read a link in this path">
          {sides.map(side => {
            const branch = study[side][trail[side]]
            return <a key={side} href={href(branch)} aria-current={trail.reading === side ? 'step' : undefined} onClick={event => trace(event, side, trail[side])}>
              {names(side, branch).join(' → ')}</a>
          })}
        </nav>
        <div className="light-evidence" aria-live="polite" aria-atomic="true">
          <blockquote cite={reading.sourceUrl}>“<Passage branch={reading} />”</blockquote>
          <div className="passage-source"><a href={reading.sourceUrl}>2007 Schools Wikipedia · {reading.section} <span aria-hidden="true">↗</span></a>
            <a href={href(reading)}>Inspect in Studio <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>
      <div className="light-actions guide-actions">
        <a className="guide-primary" href={docsURL}>Build your first graph <span aria-hidden="true">→</span></a>
        <a className="guide-text-link" href={studioURL}>Open graph studio <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>
}
