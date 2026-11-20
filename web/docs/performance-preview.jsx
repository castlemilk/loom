'use client'

import { useCallback, useState } from 'react'
import { showFrameTimes } from '../../docs/examples/frame-times'
import { SignalPreview } from './signal-preview'

export function PerformancePreview() {
  const [readings, setReadings] = useState(null)
  const observe = useCallback(graph => showFrameTimes(graph, setReadings), [])
  return <div className="docs-measure">
    <SignalPreview observe={observe} />
    {readings && <dl aria-label="Measurements on this device">{Object.entries(readings).map(([label, value]) =>
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  </div>
}
