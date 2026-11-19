'use client'

import { useEffect, useRef, useState } from 'react'

export function Splitter() {
  const ref = useRef(null), drag = useRef(null)
  const saved = useRef({ panel: 300, height: null })
  const bounds = useRef(null)
  const [aria, setAria] = useState({ mobile: false, min: 220, max: 980, value: 680 })
  function place(value, remember = true) {
    const b = bounds.current
    if (!b) return
    value = Math.round(Math.max(b.min, Math.min(b.max, value)))
    const panel = b.width - 12 - value
    if (remember) {
      if (b.mobile) saved.current.height = value
      else saved.current.panel = panel
    }
    const style = ref.current.parentElement.style
    style.setProperty(b.mobile ? '--stage-height' : '--panel-width', (b.mobile ? value : panel) + 'px')
    setAria((old) => old.mobile === b.mobile && old.value === value && old.min === b.min && old.max === b.max
      ? old : { mobile: b.mobile, min: b.min, max: b.max, value })
  }
  function reset() {
    const b = bounds.current
    if (b) place(b.mobile ? innerHeight * 0.58 : b.width - 312)
  }
  useEffect(() => {
    const parent = ref.current.parentElement
    const media = matchMedia('(max-width: 700px)')
    function resize() {
      const mobile = media.matches, width = parent.clientWidth
      const max = mobile ? Math.max(160, Math.round(innerHeight * 0.85)) : Math.max(220, width - 232)
      bounds.current = { mobile, width, max, min: Math.min(max, mobile ? 180 : 220) }
      place(mobile ? saved.current.height ?? innerHeight * 0.58 : width - 12 - saved.current.panel, false)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)
    window.addEventListener('resize', resize)
    return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
  }, [])
  function down(e) {
    if (e.button !== 0 || drag.current) return
    e.currentTarget.focus()
    e.currentTarget.setPointerCapture(e.pointerId)
    const box = ref.current.parentElement.querySelector('.stage').getBoundingClientRect()
    drag.current = { id: e.pointerId, start: aria.mobile ? e.clientY : e.clientX, size: aria.mobile ? box.height : box.width }
  }
  function move(e) {
    const d = drag.current
    if (d?.id === e.pointerId) place(d.size + (aria.mobile ? e.clientY : e.clientX) - d.start)
  }
  function end(e) { if (drag.current?.id === e.pointerId) drag.current = null }
  function key(e) {
    const step = e.shiftKey ? 64 : 16
    const keys = { Home: aria.min, End: aria.max, [aria.mobile ? 'ArrowUp' : 'ArrowLeft']: aria.value - step,
      [aria.mobile ? 'ArrowDown' : 'ArrowRight']: aria.value + step }
    if (Object.hasOwn(keys, e.key)) { e.preventDefault(); place(keys[e.key]) }
    else if (e.key === 'Enter') { e.preventDefault(); reset() }
  }
  return <div ref={ref} className="splitter" role="separator" tabIndex={0} aria-label={aria.mobile ? 'Graph height' : 'Graph width'}
    aria-orientation={aria.mobile ? 'horizontal' : 'vertical'} aria-controls="studio-stage studio-controls"
    aria-valuemin={aria.min} aria-valuemax={aria.max} aria-valuenow={aria.value} aria-valuetext={aria.value + ' pixels'}
    title="Drag to resize. Use arrow keys to adjust or double-click to reset." onDoubleClick={reset} onKeyDown={key}
    onPointerDown={down} onPointerMove={move} onLostPointerCapture={end} onPointerUp={end} onPointerCancel={end}><i /></div>
}
