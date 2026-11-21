'use client'

import { useEffect, useRef, useState } from 'react'
import { artURL, docsURL, homeURL, mcpURL, modelStudioURL, studioURL } from '../site'
import './guide-mast.css'

const sections = [
  { title: 'Components', href: homeURL + '#components', entries: [
    { name: 'Graph Studio', note: 'Draw, arrange and export a graph.', href: modelStudioURL,
      icon: 'groups.webp', thumbnail: 'wire-study-640.webp', image: 'wire-study-640.webp', caption: 'Shape the wire model' },
    { name: 'TypeScript SDK', note: 'Mount a graph in your own app.', href: docsURL,
      icon: 'layout.webp', image: 'layout.webp', caption: 'Build your first graph' },
    { name: 'Graph MCP', note: 'Give your knowledge graph an MCP server.', href: mcpURL,
      icon: 'graph-mcp.png', image: 'graph-mcp.png', caption: 'Query the Bauhaus graph' },
  ] },
  { title: 'Examples', href: homeURL + '#examples', entries: [
    { name: 'Light and Rainbow', note: 'Follow a ray to its Wikipedia passage.', href: homeURL + '#light-path',
      icon: 'light-prism.webp', image: 'light-prism.webp', caption: 'Look through the prism' },
    { name: 'Wikipedia atlas', note: 'Open a topic and trace links across it.', href: studioURL + 'wikispeedia/',
      icon: 'explore.webp', image: 'wikipedia-map.jpg', caption: 'Unfold the topic map' },
    { name: 'Around Canva', note: 'Meet the founders and investors.', href: studioURL + 'cards/',
      icon: 'groups.webp', image: 'canva-cards.jpg', caption: 'Inspect a relationship' },
  ] },
]

const wideScreen = '(min-width: 741px)'

function MastGroup({ section, onEnter, onLeave, onSummaryClick }) {
  const [active, setActive] = useState(0)
  const [showGallery, setShowGallery] = useState(false)
  const { title, entries } = section
  const selected = entries[active]
  function moveBetweenLinks(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const link = event.target.closest('a')
    const next = event.key === 'ArrowDown' ? link.nextElementSibling
      : link.previousElementSibling || event.currentTarget.closest('details').querySelector('summary')
    next?.focus()
  }
  return <details className="mast-group" name="guide-sections" onPointerEnter={onEnter} onPointerLeave={onLeave}
    onToggle={event => {
      const expanded = event.currentTarget.open
      setShowGallery(expanded && matchMedia(wideScreen).matches)
      if (!expanded) setActive(0)
    }}>
    <summary className="mast-link" onClick={onSummaryClick} onKeyDown={event => {
      if (event.key !== 'ArrowDown') return
      event.preventDefault()
      const group = event.currentTarget.parentElement
      group.open = true
      group.querySelector('.mast-row').focus()
    }}>{title}<i className="mast-chevron" aria-hidden="true" /></summary>
    <div className="mast-flyout"><div className="mast-panel">
      <div className="mast-index" onKeyDown={moveBetweenLinks}>{entries.map((entry, i) =>
        <a key={entry.name} href={entry.href} className="mast-row" data-preview={i === active}
          onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)}>
          <picture className="mast-thumb" data-art={entry.icon}>
            {entry.thumbnail && <source media="(max-width: 740px)" srcSet={artURL(entry.thumbnail)} />}
            <img src={artURL(entry.icon)} alt="" width="44" height="44" loading="lazy" />
          </picture>
          <span><strong>{entry.name}</strong><small>{entry.note}</small></span>
        </a>)}
        <a className="mast-overview" href={section.href}>All {title.toLowerCase()} <span aria-hidden="true">→</span></a>
      </div>
      <a className="mast-feature" href={selected.href} aria-label={selected.caption}>
        <span className="mast-gallery">{showGallery && entries.map((entry, i) =>
          <img key={entry.image} data-art={entry.image} data-visible={i === active} src={artURL(entry.image)} alt="" width="320" height="200" />)}
          <noscript><img data-art={entries[0].image} data-visible="true" src={artURL(entries[0].image)} alt="" width="320" height="200" loading="lazy" /></noscript>
        </span>
        <span className="mast-caption">{selected.caption}<span aria-hidden="true">↗</span></span>
      </a>
    </div></div>
  </details>
}

export function GuideMast({ docs, mcp }) {
  const header = useRef(null), menu = useRef(null)
  const hovered = useRef(null), leaveTimer = useRef(null)

  function closeGroups() {
    clearTimeout(leaveTimer.current)
    hovered.current = null
    header.current.querySelectorAll('.mast-group[open]').forEach(group => { group.open = false })
  }
  function dismiss() {
    closeGroups()
    if (!matchMedia(wideScreen).matches) menu.current.open = false
  }
  useEffect(() => {
    const wide = matchMedia(wideScreen)
    function resize() {
      closeGroups()
      menu.current.open = wide.matches
    }
    function outside(event) {
      if (!header.current.contains(event.target)) dismiss()
    }
    function escape(event) {
      if (event.key !== 'Escape') return
      const group = header.current.querySelector('.mast-group[open]')
      if (group) {
        if (group.contains(document.activeElement)) group.querySelector('summary').focus({ preventScroll: true })
        closeGroups()
      } else if (!wide.matches && menu.current.open) {
        menu.current.open = false
        menu.current.querySelector('summary').focus({ preventScroll: true })
      } else return
      event.preventDefault()
    }
    if (wide.matches) menu.current.open = true
    wide.addEventListener('change', resize)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('pagehide', dismiss)
    return () => {
      clearTimeout(leaveTimer.current)
      wide.removeEventListener('change', resize)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('pagehide', dismiss)
    }
  }, [])

  function enter(event) {
    if (event.pointerType !== 'mouse' || !matchMedia(wideScreen).matches) return
    clearTimeout(leaveTimer.current)
    const group = event.currentTarget
    if (!group.open) {
      closeGroups()
      group.open = true
      hovered.current = group
    }
  }
  function leave(event) {
    const group = event.currentTarget
    if (hovered.current !== group) return
    leaveTimer.current = setTimeout(() => {
      if (!group.matches(':focus-within')) closeGroups()
    }, 180)
  }
  function clickSummary(event) {
    // A first click on an already hovered section pins it. A second click closes it.
    if (event.detail > 0 && hovered.current === event.currentTarget.parentElement) event.preventDefault()
    clearTimeout(leaveTimer.current)
    hovered.current = null
  }
  function enterLink(event) {
    if (event.pointerType === 'mouse' && matchMedia(wideScreen).matches) closeGroups()
  }
  return <header className="guide-mast" ref={header} onClick={event => {
    if (event.target.closest('a')) dismiss()
  }} onBlur={event => {
    const group = event.target.closest('.mast-group')
    // Compact disclosures share the page flow. Let the next tap land before its
    // native disclosure or link closes the previous section.
    if (group && matchMedia(wideScreen).matches && event.relatedTarget && !group.contains(event.relatedTarget)) group.open = false
  }}>
    <div className="mast-inner">
      <a className="guide-brand" href={homeURL} aria-label="Loom home">
        <img src={artURL('loom-logo.png')} width="34" height="34" alt="" />Loom
      </a>
      <nav className="guide-nav" aria-label="Field guide"><details className="mast-menu" ref={menu}
        onToggle={event => { if (event.target === menu.current && !menu.current.open) closeGroups() }}>
        <summary className="mast-link mast-menu-trigger">Menu<i className="mast-chevron" aria-hidden="true" /></summary>
        <div className="mast-links">
          {sections.map(section => <MastGroup key={section.title} section={section} onEnter={enter} onLeave={leave} onSummaryClick={clickSummary} />)}
          <a className="mast-link" href={docsURL} aria-current={docs ? 'location' : undefined} onPointerEnter={enterLink}>SDK docs</a>
          <a className="mast-link" href={mcpURL} aria-current={mcp ? 'page' : undefined} onPointerEnter={enterLink}>
            <img src={artURL('graph-mcp.png')} width="18" height="18" alt="" />Graph MCP
          </a>
        </div>
      </details></nav>
      <a className="mast-launch" href={studioURL}>Open Studio <span aria-hidden="true">↗</span></a>
    </div>
  </header>
}
