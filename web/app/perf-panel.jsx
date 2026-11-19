'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { observePerformance } from '../../dist/performance.js'

const ms = (n) => n == null ? '—' : n.toFixed(2) + ' ms'
const mib = (n) => n == null ? 'Unavailable' : (n / 1048576).toFixed(1) + ' MiB'
const bytes = (n) => n == null ? '—' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KiB' : mib(n)

export function PerfPanel({ graph, data, paused, onClose }) {
  const [sample, setSample] = useState(null), title = useId()
  useEffect(() => {
    setSample(null)
    if (graph) return observePerformance(graph, setSample)
  }, [graph])
  const images = useMemo(() => new Set(data.nodes.filter((n) => n.art).map((n) =>
    Object.hasOwn(data.artwork ?? {}, n.art) ? data.artwork[n.art] : n.art)).size, [data])
  const state = paused ? 'Paused' : !sample ? 'Collecting' : sample.idle ? 'Idle' : 'Active'
  const intervals = sample?.frameIntervals ?? []
  const gpu = sample?.gpuStatus === 'measured' ? ms(sample.gpuMs) :
    ({ unavailable: 'Unavailable', disjoint: 'Interrupted', waiting: 'Awaiting sample' }[sample?.gpuStatus] ?? '—')
  return <section className="perf-panel" id="perf-panel" aria-labelledby={title} data-state={state}>
    <div className="perf-heading"><h2 id={title}>Performance</h2><span className="perf-state">{state}</span>
      <button type="button" aria-label="Close performance" onClick={onClose}>×</button></div>
    <div className="perf-rate"><strong id="perf-fps">{sample ? sample.fps.toFixed(0) : '—'}</strong><span>graph FPS</span>
      <span title="95th percentile interval between active graph paints">p95 <b>{ms(sample?.p95FrameMs)}</b></span></div>
    <div className="frame-chart" role="img" aria-label="Recent frame intervals, with a 16.7 millisecond reference line">
      {intervals.map((n, i) => <i key={i} style={{ height: Math.min(100, n / 50 * 100) + '%', opacity: n > 16.7 ? 1 : 0.55 }} />)}
    </div>
    <dl>{[
      ['Main thread', ms(sample?.mainThreadMs), 'Elapsed work in a Loom scheduler callback. Worker execution is separate.'],
      ['GPU draw', gpu, 'Asynchronous WebGL timer query, when the browser exposes it.'],
      ['JS heap', mib(sample?.heapBytes), 'Browser-reported JavaScript heap for this page.'],
      ['Positions + links', bytes(sample?.geometryBytes), 'Packed node coordinates, radii and edge endpoints.'],
      ['Draws / labels', sample ? sample.drawCalls + ' / ' + sample.labels : '—'],
      ['Atlas tiles', sample ? sample.imageTiles + ' / ' + images : '—', 'Decoded tiles / distinct artwork URLs in the dataset.'],
      ['Pixel ratio', sample ? sample.dpr.toFixed(2) + '×' : '—'],
      ['Frames drawn', sample?.frames.toLocaleString() ?? '—'],
    ].map(([label, value, hint]) => <div key={label} title={hint}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>
}

export function CloudCompass({ graph, ink }) {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!graph || !ctx) return
    return graph.onFrame(({ yaw, pitch }) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const axes = [['X', cy, sp * sy, -cp * sy], ['Y', 0, cp, sp], ['Z', sy, -sp * cy, cp * cy]].sort((a, b) => a[3] - b[3])
      ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 62, 60)
      ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      for (const [label, x, y, depth] of axes) {
        ctx.globalAlpha = 0.65 + 0.32 * depth
        ctx.strokeStyle = ctx.fillStyle = ink
        ctx.beginPath(); ctx.moveTo(31, 30); ctx.lineTo(31 + x * 16, 30 + y * 16); ctx.stroke()
        ctx.fillText(label, 31 + x * 23, 30 + y * 23)
      }
      ctx.globalAlpha = 1
    })
  }, [graph, ink])
  return <canvas className="cloud-compass" ref={ref} width="124" height="120" role="img" aria-label="Cloud orientation axes" />
}
