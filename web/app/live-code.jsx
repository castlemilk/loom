'use client'

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { patterns, patternSource, startingPattern } from './thread-pattern'
import { runPattern } from './run-thread-pattern'
import { ThreadPlot } from './thread-plot'
import { PlaygroundSource } from './playground-source'
import './live-code.css'

const originals = patterns.map(patternSource)
const firstDraft = { source: originals[0], preset: 0 }
const NotebookPlayground = lazy(() => import('./notebook-playground'))

export function LiveCode() {
  const [notebook, setNotebook] = useState(false), [opened, setOpened] = useState(false)
  useEffect(() => {
    function route() {
      if (location.hash === '#node-playground') { setNotebook(true); setOpened(true) }
      else if (location.hash === '#live-code' || !location.hash) setNotebook(false)
    }
    route()
    window.addEventListener('hashchange', route)
    return () => window.removeEventListener('hashchange', route)
  }, [])
  return <section className="thread-study" id="live-code" aria-label="Live code playgrounds">
    <div id="node-playground" className="playground-anchor" />
    <div className="guide-width">
      <nav className="playground-switch" aria-label="Live code examples">
        <a href="#live-code" aria-current={!notebook ? 'page' : undefined}>String patterns <small>JS</small></a>
        <a href="#node-playground" aria-current={notebook ? 'page' : undefined}>Nodes &amp; images <small>TS</small></a>
      </nav>
      <div hidden={notebook}><StringPatterns /></div>
      {opened && <div hidden={!notebook}><Suspense fallback={<p role="status">Opening the orbital atlas…</p>}><NotebookPlayground /></Suspense></div>}
    </div>
  </section>
}

function StringPatterns() {
  const [draft, setDraft] = useState(firstDraft)
  const { source, preset } = draft
  const [model, setModel] = useState(startingPattern)
  const [status, setStatus] = useState('ready')
  const [error, setError] = useState('')
  const editor = useRef(null)
  const skip = /(\bconst[ \t]+skip[ \t]*=[ \t]*)(-?\d+)(?=[ \t]*(?:;|\/\/|$))/m.exec(source)
  const suggestion = Number(skip?.[2]) === patterns[preset].trySkip ? patterns[preset].skip : patterns[preset].trySkip
  useEffect(() => {
    if (draft === firstDraft) return
    const controller = new AbortController()
    if (draft.restore) {
      editor.current.setSelectionRange(0, 0)
      editor.current.scrollTo(0, 0)
    }
    const timer = setTimeout(async () => {
      try {
        const result = await runPattern(draft.source, controller.signal)
        if (controller.signal.aborted) return
        setModel(result)
        setStatus('ready')
      } catch (cause) {
        if (!controller.signal.aborted) { setError(cause.message); setStatus('error') }
      }
    }, 220)
    return () => { clearTimeout(timer); controller.abort() }
  }, [draft])
  function edit(text, starting) {
    setError('')
    setStatus('editing')
    setDraft({ source: text, preset: starting ?? preset, restore: starting !== undefined })
  }
  function selectSkip() {
    const start = skip.index + skip[1].length
    editor.current.focus()
    editor.current.setSelectionRange(start, start + skip[2].length)
  }
  return <>
      <header className="thread-heading">
        <h2 id="thread-title">Weave a <em>graph.</em></h2>
        <p id="thread-hint">Edit the JavaScript and watch the threads move. {skip ? <>Try changing <button type="button"
          aria-label="Select the skip value in the code" onClick={selectSkip}>skip</button> from <code>{skip[2]}</code> to <code>{suggestion}</code>.</>
          : <>Use <code>ring(n)</code> to place pins in a circle, or return your own nodes and links.</>}</p>
      </header>
      <div className="thread-bench">
        <div className="thread-bar">
          <span className="thread-bar-title">String patterns</span>
          <div role="group" aria-label="Starting patterns" className="thread-presets">{patterns.map((pattern, i) =>
            <button key={pattern.name} type="button" aria-pressed={preset === i} onClick={() => edit(originals[i], i)}>{pattern.name}</button>
          )}</div>
        </div>
        <div className="thread-editor">
          <div className="thread-file"><label htmlFor="thread-source">pattern.js</label>
            <button type="button" title={'Restore the ' + patterns[preset].name + ' code and pins'} onClick={() => edit(originals[preset], preset)}>Reset</button></div>
          <PlaygroundSource inputRef={editor} id="thread-source" source={source} edit={edit} label="Edit pattern JavaScript"
            describedBy="thread-hint thread-status" invalid={status === 'error'} />
          <div className="thread-status" id="thread-status" role="status" data-state={status}>
            <i aria-hidden="true" /><span>{error ? error + ' Showing the last drawing.' : status === 'editing' ? 'Updating…' : 'Live preview'}</span>
          </div>
        </div>
        <ThreadPlot model={model} />
      </div>
      <noscript><p>Enable JavaScript to edit the pattern and redraw its threads.</p></noscript>
  </>
}
