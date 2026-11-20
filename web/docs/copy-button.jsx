'use client'

import { useEffect, useRef, useState } from 'react'

export function CopyButton({ name, sourceURL }) {
  const label = sourceURL ? 'Copy for AI' : 'Copy'
  const [status, setStatus] = useState(null)
  const timer = useRef(null)
  useEffect(() => {
    setStatus(label)
    return () => clearTimeout(timer.current)
  }, [label])
  async function copy(e) {
    const code = sourceURL ? null : e.currentTarget.closest('figure').querySelector('pre code')
    async function markdown() {
      const response = await fetch(sourceURL)
      if (!response.ok) throw new Error('Markdown unavailable')
      return response.text()
    }
    clearTimeout(timer.current)
    setStatus('Copying…')
    try {
      if (sourceURL && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Start the clipboard write during the click, including on browsers with short-lived user activation.
        const content = markdown().then(value => new Blob([value], { type: 'text/plain' }))
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': content })])
      } else {
        await navigator.clipboard.writeText(sourceURL ? await markdown() : code.textContent)
      }
      setStatus('Copied')
    } catch {
      if (code) {
        const range = document.createRange()
        range.selectNodeContents(code)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        setStatus('Text selected')
      } else setStatus('Use View Markdown')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus(label), 2200)
  }
  return <button type="button" className="docs-copy" onClick={copy} disabled={!status || status === 'Copying…'}
    aria-label={sourceURL ? 'Copy page for AI' : 'Copy ' + name}>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.3" /><path d="M10 3H4a1 1 0 0 0-1 1v6" />
    </svg><span aria-live="polite">{status ?? label}</span>
  </button>
}
