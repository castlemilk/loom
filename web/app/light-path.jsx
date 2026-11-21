'use client'

import { useLayoutEffect, useRef } from 'react'
import { artURL, docsURL, studioURL } from '../site'
import { connectionURL } from '../wiki-connections'
import { pageSize, pageStart, useLightTrail } from './use-light-trail'
import './light-path.css'

// Percent coordinates are shared by the optical rays and their HTML links.
const hub = [49, 48]
const ends = {
  incoming: [[18, 24], [9, 55], [25, 79]],
  outgoing: [[83, 19], [88, 49], [77, 78]],
}
const sides = ['incoming', 'outgoing']
const colours = ['#ffac85', '#a8dacb', '#aec5f8']
const position = ([x, y]) => ({ left: x + '%', top: y + '%' })
const point = ([x, y]) => [x * 10, y * 3.6]
function midpoint(element) {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

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

function ordinaryClick(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function History({ visits, returnTo }) {
  const list = useRef(null)
  useLayoutEffect(() => { if (list.current) list.current.scrollLeft = list.current.scrollWidth }, [visits.length])
  if (visits.length === 1) return null
  return <nav className="light-history" aria-label="Exploration path">
    <span>Your path</span><ol ref={list}>{visits.map(({ study }, i) => <li key={i}>
      {i > 0 && <span aria-hidden="true">›</span>}
      {i === visits.length - 1 ? <span aria-current="location">{study.hub}</span> :
        <button type="button" onClick={() => returnTo(i)} aria-label={'Return to ' + study.hub + ', step ' + (i + 1)}>{study.hub}</button>}
    </li>)}</ol>
  </nav>
}

export function LightPath({ study: initial }) {
  const bench = useRef(null), center = useRef(null), origin = useRef(null)
  const gesture = useRef(null), pointer = useRef(null)
  const { current: trail, visits, status, explore, inspect, turnPage, returnTo } = useLightTrail(initial, (id, edge) => {
    const selector = edge ? '[data-edge="' + edge + '"]' : '[data-article="' + id + '"]'
    const article = bench.current?.querySelector(selector)
    const name = article?.querySelector('.article-name')
    origin.current = article ? { pin: midpoint(article.querySelector('.article-pin')), label: midpoint(name),
      fontSize: parseFloat(getComputedStyle(name).fontSize) } : {}
    gesture.current = null
  })
  const { study } = trail
  const first = study.incoming[trail.incoming], last = study.outgoing[trail.outgoing]
  const reading = study[trail.reading][trail[trail.reading]]
  const href = branch => connectionURL(branch.topics, branch.edge)
  const names = (side, branch) => side === 'incoming' ? [branch.name, study.hub] : [study.hub, branch.name]
  const panes = sides.map(side => {
    const start = pageStart(trail[side])
    const branches = study[side].slice(start, start + pageSize)
    const slots = branches.length === 1 ? [1] : branches.length === 2 ? [0, 2] : [0, 1, 2]
    return { side, start, items: branches.map((branch, i) => ({ branch, index: start + i, slot: slots[i], end: ends[side][slots[i]] })) }
  })

  useLayoutEffect(() => {
    const from = origin.current
    if (!from) return
    origin.current = null
    center.current.focus({ preventScroll: true })
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const specimen = center.current.querySelector('.hub-specimen')
    const name = center.current.querySelector('.hub-name')
    const pin = midpoint(specimen), label = midpoint(name)
    const travel = from.pin ? `translate(${from.pin.x - pin.x}px, ${from.pin.y - pin.y}px) scale(.18)` : 'scale(.94)'
    const labelTravel = from.label ? `translate(calc(-50% + ${from.label.x - label.x}px), ${from.label.y - label.y}px) scale(${from.fontSize / parseFloat(getComputedStyle(name).fontSize)})` : 'translateX(-50%)'
    const timing = { duration: 420, easing: 'cubic-bezier(.22,.75,.18,1)' }
    const movement = specimen.animate([{ transform: travel, opacity: .45 }, { transform: 'none', opacity: 1 }],
      timing)
    const caption = name.animate([{ transform: labelTravel }, { transform: 'translateX(-50%)' }], timing)
    const wires = bench.current.querySelector('svg').animate([{ opacity: .2 }, { opacity: 1 }], { duration: 420 })
    return () => { movement.cancel(); caption.cancel(); wires.cancel() }
  }, [study.id, visits.length])

  function trace(event, side, i) {
    // Real permalinks also work with JavaScript disabled or Open in New Tab.
    if (!ordinaryClick(event)) return
    event.preventDefault()
    gesture.current = null
    inspect(side, i)
  }
  function clickArticle(event, side, index) {
    if (!ordinaryClick(event)) return
    event.preventDefault()
    const edge = study[side][index].edge
    const lastTap = gesture.current
    if (pointer.current === 'touch' && event.detail > 0 && lastTap?.edge === edge && event.timeStamp - lastTap.time < 420) {
      gesture.current = null
      explore(side, index, lastTap.before)
      return
    }
    if (event.detail > 1) return
    gesture.current = { edge, time: event.timeStamp, before: trail }
    inspect(side, index)
  }
  function doubleClick(event, side, index) {
    if (!ordinaryClick(event) || pointer.current === 'touch') return
    event.preventDefault()
    const prior = gesture.current
    gesture.current = null
    explore(side, index, prior?.edge === study[side][index].edge ? prior.before : trail)
  }

  return <section id="light-path" className="light-study" aria-labelledby="guide-title">
    <noscript><style>{'.light-study .path-js { display: none }'}</style></noscript>
    <div className="guide-width light-spread">
      <div className="light-intro">
        <h1 id="guide-title"><span className="light-product">Interactive graphs in TypeScript</span>
          {study.id === initial.id && trail.incoming < pageSize && trail.outgoing < pageSize ?
            <span className="light-title"><span className="light-name" data-long={first.name.length > 8}>{first.name}</span>{' '}
              <span className="light-destination" data-long={last.name.length > 8}>to <em>{last.name}.</em></span></span> :
            <span className="focused-title">Through <em data-long={study.hub.length > 15}>{study.hub}.</em></span>}
        </h1>
        <p>Choose a ray to read its Wikipedia passage. <span className="path-js mouse-instruction">Double-click an article to explore its links.</span><span className="path-js touch-instruction">Tap an article, then choose Explore to follow its links.</span></p>
        <History visits={visits} returnTo={returnTo} />
      </div>
      <div className="light-map" role="group" aria-label={'Wikipedia paths through ' + study.hub} aria-busy={Boolean(status && !status.retry)}>
        <div className="map-directions">{panes.map(({ side, start, items }) => <div key={side}>
          <span>{side === 'incoming' ? 'Links into ' : 'Links out of '}{study.hub}</span>
          {study.totals[side] > pageSize && <button type="button" className="path-js" onClick={() => turnPage(side)}
            aria-label={`Show next ${side} links for ${study.hub}, showing ${start + 1} to ${start + items.length} of ${study.totals[side]}`}>
            {start + 1}–{start + items.length}/{study.totals[side]} <span aria-hidden="true">→</span></button>}
        </div>)}</div>
        <div className="optical-bench" ref={bench} onPointerDownCapture={event => { pointer.current = event.pointerType }}>
          <svg viewBox="0 0 1000 360" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs><linearGradient id="refracted-light" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="-11" y2="11">
              <stop stopColor="#f38470"/><stop offset=".25" stopColor="#ffbb74"/><stop offset=".49" stopColor="#ede8aa"/>
              <stop offset=".64" stopColor="#9edac5"/><stop offset=".82" stopColor="#86c2e8"/><stop offset="1" stopColor="#ad9dce"/>
            </linearGradient>{['lit', 'unlit'].map(state => <marker key={state} id={state + '-arrow'} viewBox="0 0 12 10" refX="6" refY="5" markerWidth="12" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M2 1L9 5L2 9" fill="none" stroke={state === 'lit' ? '#f9f6df' : '#82918c'} strokeWidth="1.7" />
            </marker>)}</defs>
            {panes.map(({ side, items }) => items.map(({ branch, index, end, slot }) => <Ray key={branch.edge} end={end} incoming={side === 'incoming'}
              selected={trail[side] === index} colour={side === 'incoming' ? '#f4f2db' : colours[slot]} href={href(branch)} onTrace={event => trace(event, side, index)} />))}
          </svg>
          {panes.map(({ side, items }) => <div key={side} role="group" aria-label={side === 'incoming' ? 'Choose a starting article' : 'Choose a destination article'}>
            {items.map(({ branch, index, end, slot }) => <a key={branch.edge} className="path-article" data-article={branch.id} data-edge={branch.edge} data-upper={slot === 0}
              style={{ ...position(end), '--ray': side === 'incoming' ? '#f4f2db' : colours[slot], '--pin-left': end[0] + 'cqw', '--pin-right': (100 - end[0]) + 'cqw' }}
              href={href(branch)} title={'Double-click to explore ' + branch.name} aria-label={'Trace ' + names(side, branch).join(' to ')} aria-current={trail[side] === index ? 'true' : undefined}
              onClick={event => clickArticle(event, side, index)} onDoubleClick={event => doubleClick(event, side, index)}>
              <span className="article-pin" aria-hidden="true" /><span className="article-name" data-long={branch.name.length > 14}>{branch.name}</span></a>)}
            {!items.length && <span className={'path-empty ' + side}>No {side} passages</span>}
          </div>)}
          <a ref={center} className="light-hub" style={position(hub)} href={study.sourceUrl} aria-label={'Read the archived ' + study.hub + ' article'}>
            <span className="hub-specimen"><img src={artURL('light-prism.webp')} width="560" height="418" alt="" fetchPriority="high" /></span>
            <span className="hub-name" data-long={study.hub.length > 10}>{study.hub}</span>
          </a>
        </div>
      </div>
      <div className="light-reader">
        <div className="passage-tools"><nav className="passage-steps" aria-label="Read a link in this path">
          {sides.filter(side => study[side].length).map(side => {
            const branch = study[side][trail[side]]
            return <a key={side} href={href(branch)} aria-current={trail.reading === side ? 'step' : undefined} onClick={event => trace(event, side, trail[side])}>
              {names(side, branch).join(' → ')}</a>
          })}
        </nav><button className="explore-article path-js" type="button" onClick={() => explore(trail.reading, trail[trail.reading])}>
          {reading.edge === trail.arrivalEdge ? 'Back to ' : 'Explore '}{reading.name} <span aria-hidden="true">{reading.edge === trail.arrivalEdge ? '↶' : '→'}</span></button></div>
        <div role="status" className="path-status">{status && <>{status.message} {status.retry && <button type="button" onClick={status.retry}>Retry</button>}</>}</div>
        <div className="light-evidence" aria-live="polite" aria-atomic="true">
          <blockquote cite={reading.sourceUrl}>“<Passage branch={reading} />”</blockquote>
          <div className="passage-source"><a href={reading.sourceUrl}>2007 Schools Wikipedia · {reading.section} <span aria-hidden="true">↗</span></a>
            <a href={href(reading)}>Inspect in Studio <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>
      <div className="light-actions guide-actions">
        <a className="guide-primary" href={docsURL}>Build your first graph <span aria-hidden="true">→</span></a>
        <a className="guide-text-link" href={studioURL}>Open graph studio <span aria-hidden="true">↗</span></a>
        <a className="guide-text-link" href="#live-code">Try live code <span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </section>
}
