'use client'

import { useEffect, useRef, useState } from 'react'
import { artURL, fetchGraphFile, modelStudioURL, modelURL } from '../site'

export function ModelPlate({ nodes, links }) {
  const canvas = useRef(null)
  const button = useRef(null)
  const [running, setRunning] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')

  useEffect(() => {
    if (!running) return
    const abort = new AbortController()
    let graph
    async function start() {
      try {
        const [engine, data] = await Promise.all([import('./wire-study'), fetchGraphFile(modelURL, abort.signal)])
        if (abort.signal.aborted) return
        graph = engine.mountWireStudy(canvas.current, data)
        const names = new Map(data.nodes.map((node) => [node.id, node.label]))
        graph.on('hover', (id) => canvas.current?.toggleAttribute('data-joint', id !== null))
        graph.on('select', (id) => setSelected(names.get(id) ?? ''))
        setReady(true)
        if (document.activeElement === button.current) canvas.current.focus({ preventScroll: true })
      } catch (cause) {
        if (abort.signal.aborted) return
        setError(cause.name === 'WebGL2UnavailableError' ? 'The live model requires WebGL2.' : 'The model could not load. Try again.')
        setRunning(false)
      }
    }
    start()
    return () => { abort.abort(); graph?.destroy() }
  }, [running])

  function toggle() {
    setError('')
    setReady(false)
    setSelected('')
    setRunning(!running)
  }
  return <figure className="model-plate" data-preview={ready ? 'live' : running ? 'loading' : 'still'}>
    <div className="plate-viewport">
      <img className="plate-photo" src={artURL('wire-study-1280.webp')}
        srcSet={artURL('wire-study-640.webp') + ' 640w, ' + artURL('wire-study-1280.webp') + ' 1280w'}
        sizes="(max-width: 740px) 94vw, (max-width: 1320px) 54vw, 710px" width="1280" height="853" fetchPriority="high"
        hidden={ready} alt="An open network of copper and nickel rods joins ivory, charcoal and terracotta beads on a dark workbench." />
      {running && <canvas ref={canvas} tabIndex={0} aria-label="Wire model. Drag a joint to pull its links. Drag the background or use arrow keys to orbit. Plus and minus zoom. Escape returns to the still."
        aria-describedby="plate-status" onKeyDown={(event) => {
          if (event.key === 'Escape') { setRunning(false); setReady(false); setSelected(''); button.current?.focus({ preventScroll: true }) }
        }} />}
    </div>
    <figcaption>
      <div className="plate-readout"><a className="plate-name" href={modelStudioURL} aria-label="Open wire model in the studio">Wire model <span aria-hidden="true">↗</span></a>
        <span id="plate-status" role="status">{error || (ready ? selected || 'Drag a joint or orbit the model.' : running ? 'Loading model…' : nodes + ' joints · ' + links + ' connections')}</span>
      </div>
      <button type="button" onClick={toggle} ref={button} aria-pressed={running}>
        <span className={running ? 'stop-symbol' : 'play-symbol'} aria-hidden="true" />{running ? 'Show still' : error ? 'Try again' : 'Run live model'}
      </button>
    </figcaption>
  </figure>
}
