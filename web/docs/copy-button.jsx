'use client'

import { useEffect, useRef, useState } from 'react'

export function CopyButton({ name }) {
  const [status, setStatus] = useState('Copy')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy(e) {
    const code = e.currentTarget.closest('figure').querySelector('pre code')
    try {
      await navigator.clipboard.writeText(code.textContent)
      setStatus('Copied')
    } catch {
      const range = document.createRange()
      range.selectNodeContents(code)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      setStatus('Text selected')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('Copy'), 2200)
  }
  return <button type="button" className="docs-copy" onClick={copy} aria-label={'Copy ' + name}>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.3" /><path d="M10 3H4a1 1 0 0 0-1 1v6" />
    </svg><span aria-live="polite">{status}</span>
  </button>
}
