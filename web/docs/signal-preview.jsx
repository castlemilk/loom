'use client'

import { useEffect, useRef, useState } from 'react'
import { mountSignalPath, signalPath } from '../../docs/examples/signal-path'

const layouts = ['lanes', 'orbit', 'cloud']
export function SignalPreview({ observe }) {
  const canvas = useRef(null), [graph, setGraph] = useState(null)
  const [mode, setMode] = useState('lanes'), [picked, setPicked] = useState(null), [error, setError] = useState('')
  useEffect(() => {
    try {
      const instance = mountSignalPath(canvas.current)
      setGraph(instance)
      instance.on('modechange', setMode)
      instance.on('select', id => setPicked(signalPath.nodes.find(n => n.id === id)?.label))
      const stop = observe?.(instance)
      return () => { stop?.(); instance.destroy() }
    } catch (cause) {
      setError(cause.name === 'WebGL2UnavailableError' ? 'The live example requires WebGL2.' : 'The graph could not be opened.')
    }
  }, [observe])
  function choose(layout) {
    if (!graph) return
    graph.setMode(layout)
    graph.fit(true)
  }
  return <figure className="docs-preview" aria-label="Signal path example">
    <div className="docs-preview-bar"><figcaption>Signal path</figcaption>
      <div className="docs-layouts" role="group" aria-label="Preview layout">{layouts.map(layout =>
        <button key={layout} type="button" aria-pressed={mode === layout} disabled={!graph} onClick={() => choose(layout)}>
          {layout[0].toUpperCase() + layout.slice(1)}</button>)}</div>
    </div>
    <div className="docs-graph-host">{error ? <p role="status">{error}</p> :
      <canvas ref={canvas} aria-label="Audio signal path. Drag a node, or use the arrow keys to navigate." />}</div>
    <div className="docs-preview-foot"><span role="status">{picked ? 'Selected · ' + picked : '5 nodes · 4 connections'}</span>
      <button type="button" disabled={!graph} onClick={() => graph?.fit()}>Fit view</button></div>
  </figure>
}
