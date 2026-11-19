'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { createEditor } from '../../dist/editor.js'

const subscribeIdle = () => () => {}
const noSnapshot = () => null

// Presets remain addressable. The first committed edit gets a named working copy
// that retains its own history when the user visits another dataset.
export function useDocument(input, dataset, name, setDataset) {
  const [drafts, setDrafts] = useState([])
  const draft = drafts.find((item) => item.key === dataset)
  const cached = useRef(null)
  const count = useRef(0)
  const session = draft?.editor
  const state = useSyncExternalStore(session?.subscribe ?? subscribeIdle, session?.getSnapshot ?? noSnapshot, noSnapshot)
  function editor() {
    if (session) return session
    if (cached.current?.input !== input || cached.current?.dataset !== dataset) {
      cached.current = { input, dataset, editor: createEditor(input) }
    }
    return cached.current.editor
  }
  function apply(tx) {
    const document = editor()
    const receipt = document.apply(tx)
    if (!draft && receipt.ok && receipt.changes.length) {
      const serial = ++count.current, key = 'draft-' + serial
      setDrafts((all) => [...all, { key, origin: dataset, name: name + ' · edit ' + serial, editor: document }])
      cached.current = null
      setDataset(key)
    }
    return receipt
  }
  return { editor, apply, drafts, draft, state, data: state?.data ?? input }
}
