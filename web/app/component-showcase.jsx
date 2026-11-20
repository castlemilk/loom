'use client'

import { useEffect, useRef, useState } from 'react'
import { docsURL, homeURL, mcpURL, studioURL } from '../site'
import './feature-tour.css'

const parts = [
  { id: 'studio', title: 'Graph Studio', heading: 'Open the Music cluster', href: studioURL + 'wikispeedia/?topic=music', action: 'Open Music in Studio',
    alt: 'The Music topic expanded into a map of 96 articles, with Jazz selected.' },
  { id: 'sdk', title: 'TypeScript SDK', heading: 'Query the same graph', href: docsURL + 'navigation/#inspect-a-connection', action: 'Read the SDK example',
    alt: 'An outgoing-neighbor query on Music returns 24 articles. Sound appears in the Science topic.' },
  { id: 'mcp', title: 'Graph MCP', heading: 'Trace a link to its source', href: mcpURL, action: 'Explore Graph MCP',
    alt: 'The get_connection tool returns the passage where Music links to Sound and identifies the archived source.' },
]

// Match the two-column walkthrough section as well as the single-column phone layout.
const compactMedia = '(max-width: 600px), (min-width: 901px) and (max-width: 1100px)'
const mediaURL = (id, layout, extension) => homeURL + 'showcase/' + id + '-' + layout + '.' + extension
const sdkExample = `const index = createGraphIndex(graph)
const [music] = index.search("Music")
index.neighbors(music.id, "outgoing")`

function TourPlayer({ part, passage, source }) {
  const video = useRef(null), control = useRef(null)
  const [status, setStatus] = useState('idle'), [showFrame, setShowFrame] = useState(false)

  useEffect(() => {
    const el = video.current
    const compact = matchMedia(compactMedia), reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const connection = navigator.connection
    let intent = 'auto', inView = false, active = true, attempt = 0
    const canAutoplay = () => !reduced.matches && !connection?.saveData
    let automatic = canAutoplay()

    function update() {
      if (!active) return
      const token = ++attempt
      if (!inView || document.hidden || intent === 'paused' || intent === 'ended' || (intent === 'auto' && !automatic)) {
        el.pause()
        return
      }
      const url = mediaURL(part.id, compact.matches ? 'compact' : 'wide', 'mp4')
      if (el.getAttribute('src') !== url) {
        setShowFrame(false)
        el.setAttribute('src', url)
      }
      el.play().catch(error => {
        if (!active || token !== attempt || error.name === 'AbortError') return
        intent = 'paused'
        setStatus(error.name === 'NotAllowedError' ? 'paused' : 'error')
      })
    }
    function reset() {
      ++attempt
      el.pause()
      el.removeAttribute('src')
      el.load()
      setStatus('idle')
      setShowFrame(false)
    }
    function preferenceChanged() {
      if (automatic === canAutoplay()) return
      automatic = canAutoplay()
      intent = 'auto'
      reset()
      update()
    }
    function sizeChanged() {
      if (intent === 'ended') { reset(); setStatus('ended') }
      else { reset(); update() }
    }
    function ended() { intent = 'ended'; setStatus('ended') }
    function failed() { intent = 'paused'; setStatus('error'); setShowFrame(false) }

    control.current = () => {
      if (intent !== 'ended' && !el.paused && !el.ended) {
        intent = 'paused'
      } else {
        if (el.error) reset()
        if (el.ended) el.currentTime = 0
        intent = 'play'
        // A pressed control is visible even before the first intersection notification.
        inView = true
      }
      update()
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.15
      update()
    }, { threshold: 0.15 })
    observer.observe(el)
    el.addEventListener('ended', ended)
    el.addEventListener('error', failed)
    document.addEventListener('visibilitychange', update)
    compact.addEventListener('change', sizeChanged)
    reduced.addEventListener('change', preferenceChanged)
    connection?.addEventListener('change', preferenceChanged)
    return () => {
      active = false
      observer.disconnect()
      el.removeEventListener('ended', ended)
      el.removeEventListener('error', failed)
      document.removeEventListener('visibilitychange', update)
      compact.removeEventListener('change', sizeChanged)
      reduced.removeEventListener('change', preferenceChanged)
      connection?.removeEventListener('change', preferenceChanged)
      el.pause()
      el.removeAttribute('src')
      el.load()
      control.current = null
    }
  }, [part.id])

  const action = { playing: 'Pause', paused: 'Play', ended: 'Replay', idle: 'Play', error: 'Retry' }[status]
  return <>
    <div className="tour-viewport">
      <picture><source media={compactMedia} srcSet={mediaURL(part.id, 'compact', 'webp')} />
        <img src={mediaURL(part.id, 'wide', 'webp')} alt={part.alt} width="704" height="392" loading="lazy" /></picture>
      <video ref={video} muted playsInline preload="none" aria-hidden="true" data-visible={showFrame}
        onPlaying={() => { setStatus('playing'); setShowFrame(true) }} onPause={event => {
          if (event.currentTarget.currentSrc && !event.currentTarget.ended && !event.currentTarget.error) setStatus('paused')
        }} />
    </div>
    <div className="tour-caption">
      <div><h2>{part.heading}</h2><a href={part.href}>{part.action} <span aria-hidden="true">↗</span></a></div>
      <button type="button" onClick={() => control.current?.()} aria-label={action + ' ' + part.title + ' walkthrough'}>
        <span className="tour-glyph" aria-hidden="true">{{ Play: '▶', Pause: 'Ⅱ', Replay: '↻', Retry: '↻' }[action]}</span>{action}
      </button>
    </div>
    <details className="tour-transcript"><summary>Read the walkthrough</summary><div>
      {part.id === 'studio' ? <p>Open Music in the Wikispeedia atlas. Its 96 articles spread around the topic while Art and Science stay in place. Select Jazz to inspect the article.</p> :
        part.id === 'sdk' ? <><p>Search for Music and follow its 24 outgoing links. Scroll through the results to Sound, an article in the Science topic.</p><pre><code>{sdkExample}</code></pre></> :
        <><p>Ask how Music connects to Sound. The <code>get_connection</code> tool returns the link with this passage from the introduction to Music.</p>
          <blockquote>{passage}</blockquote><a href={source}>Read the 2007 Schools Wikipedia source <span aria-hidden="true">↗</span></a></>}
    </div></details>
  </>
}

export function ComponentShowcase({ passage, source }) {
  const [selected, select] = useState(0)
  const tabs = useRef([])
  function navigate(event, i) {
    const count = parts.length
    const next = { ArrowRight: (i + 1) % count, ArrowLeft: (i + count - 1) % count, Home: 0, End: count - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next)
    tabs.current[next].focus()
  }
  return <section id="components" className="landing-tour" aria-label="Loom component walkthroughs">
    <div role="tablist" aria-label="Loom components" className="tour-tabs">{parts.map((part, i) =>
      <button key={part.id} id={'part-' + part.id} type="button" role="tab" aria-selected={i === selected}
        aria-controls={'panel-' + part.id} tabIndex={i === selected ? 0 : -1}
        ref={el => { tabs.current[i] = el }} onKeyDown={event => navigate(event, i)} onClick={() => select(i)}>{part.title}</button>)}</div>
    {parts.map((part, i) => <div key={part.id} id={'panel-' + part.id} role="tabpanel" aria-labelledby={'part-' + part.id} hidden={selected !== i} tabIndex={0}>
      {selected === i && <TourPlayer part={part} passage={passage} source={source} />}
    </div>)}
  </section>
}
