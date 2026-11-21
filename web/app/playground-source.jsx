'use client'

import { useRef } from 'react'

const tokens = /(\/\/[^\n]*|'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`[^`]*`|\b(?:function|const|return|export|import|from|type|satisfies|interface|true|false|null|ring|pattern|\d+)\b)/g

export function PlaygroundSource({ inputRef, source, edit, id, label, describedBy, invalid }) {
  const mirror = useRef(null)
  return <div className="thread-input">
    <pre aria-hidden="true" ref={mirror}>{source.split(tokens).map((part, i) => {
      if (i % 2 === 0) return part
      const kind = /^['"`\d]/.test(part) ? 'literal' : part.startsWith('//') ? 'comment' : ['ring', 'pattern'].includes(part) ? 'call' : 'keyword'
      return <span className={'thread-' + kind} key={i}>{part}</span>
    })}{'\n'}</pre>
    <textarea ref={inputRef} id={id} value={source} onChange={event => edit(event.target.value)}
      aria-label={label} aria-describedby={describedBy} aria-invalid={invalid}
      spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off" wrap="off"
      onScroll={event => {
        mirror.current.scrollTop = event.currentTarget.scrollTop
        mirror.current.scrollLeft = event.currentTarget.scrollLeft
      }} />
  </div>
}
