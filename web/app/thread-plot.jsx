'use client'

import { useEffect, useRef, useState } from 'react'

function PaperPlot({ model }) {
  const { nodes, links, color } = model
  const pins = new Map(nodes.map(pin => [pin.id, pin]))
  const xs = nodes.map(pin => pin.x), ys = nodes.map(pin => pin.y)
  const left = nodes.length ? Math.min(...xs) : 0, top = nodes.length ? Math.min(...ys) : 0
  const width = nodes.length ? Math.max(...xs) - left : 0, height = nodes.length ? Math.max(...ys) - top : 0
  const pad = Math.max(width, height, 24) * 0.09
  return <svg viewBox={[left - pad, top - pad, width + 2 * pad, height + 2 * pad].join(' ')}
    role="img" aria-label={`Thread graph with ${nodes.length} nodes and ${links.length} links`}>
    <g stroke={color} strokeWidth="1.5">{links.map(({ source, target }, i) => {
      const a = pins.get(source), b = pins.get(target)
      return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
    })}</g>
    <g fill="#f7efdc" stroke="#614d39">{nodes.map(pin => <circle key={pin.id} cx={pin.x} cy={pin.y} r={pad * .14}
      strokeWidth="1.5" vectorEffect="non-scaling-stroke"><title>{pin.label}</title></circle>)}</g>
  </svg>
}

export function ThreadPlot({ model }) {
  const plate = useRef(null), canvas = useRef(null), unavailable = useRef(false)
  const [active, setActive] = useState(false)
  const [live, setLive] = useState(false)
  const [selected, setSelected] = useState('')
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setActive(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setActive(true); observer.disconnect() }
    })
    observer.observe(plate.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!active || unavailable.current) return
    let disposed = false, graph
    async function draw() {
      try {
        const { createGraph, parchment } = await import('../../dist/index.js')
        if (disposed) return
        graph = createGraph(canvas.current, {
          nodes: model.nodes, links: model.links, sim: 'main', transparentBackground: true, layout: { pinOnDrag: true },
          theme: { ...parchment, accent: '#614d39', bg: '#f7efdc', radii: { hub: 1.6, content: 1.6 },
            nodes: { fill: 0.25, ringWidth: 1.25 }, labels: { visibility: 'focus' },
            wires: { routing: 'straight', color: model.color, opacity: 0.87, width: 1.5 } },
        })
        graph.on('select', id => setSelected(model.nodes.find(pin => pin.id === id)?.label ?? ''))
        setSelected('')
        setLive(true)
      } catch (error) {
        if (disposed) return
        if (error.name === 'WebGL2UnavailableError') unavailable.current = true
        setSelected('')
        setLive(false)
      }
    }
    draw()
    return () => { disposed = true; graph?.destroy() }
  }, [active, model])

  return <figure className="thread-plot" ref={plate} data-renderer={live ? 'loom' : 'paper'}>
    <div className="thread-surface">
      {!live && <PaperPlot model={model} />}
      {active && <canvas ref={canvas} aria-hidden={!live} tabIndex={0}
        aria-label="Thread graph. Select a pin to read its name, or drag a pin to pull its threads." />}
      {!model.nodes.length && <span className="thread-empty">Add a node to place the first pin.</span>}
    </div>
    <figcaption><span className="thread-counts">{model.nodes.length} {model.nodes.length === 1 ? 'pin' : 'pins'} · {model.links.length} {model.links.length === 1 ? 'link' : 'links'}</span>
      {live && model.nodes.length > 0 && <span className="thread-selection" title={selected || undefined}>{selected || 'Drag a pin'}</span>}
      <span className="thread-pigment"><i style={{ backgroundColor: model.color }} aria-hidden="true" />{model.color}</span></figcaption>
  </figure>
}
