'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { evaluateGraph, makeNotebookCompiler, showEditedRecord } from './notebook-runtime'
import { downloadFile } from './download-file'

export function studioModule(data) {
  return "import type { StudioGraph } from './notebook-types.js'\n\nexport const graph: StudioGraph = " +
    JSON.stringify(data, null, 2).replace(/"__proto__":/g, '["__proto__"]:') + '\n'
}

export function studioWriteOperations(operations, data) {
  // Fix the editor-assigned IDs in source before any deletion can change legacy array indices.
  const stable = operations.some(op => op.op === 'node.remove' || op.op === 'link.remove' || op.op === 'link.update')
    && data.links.some(link => /^@link:\d+$/.test(link.id))
  const result = stable ? [{ op:'link.identify', ids:data.links.map(link => link.id) }] : []
  for (const op of operations) {
    if (op.op === 'node.remove' && op.cascade) result.push({ op:'link.detach', id:op.id })
    result.push(op)
  }
  return result
}

// Cache source against immutable editor snapshots. Undo restores the author's original module.
export function useStudioSource(data, seed, open, commit) {
  const texts = useRef(new WeakMap()), drafts = useRef(new WeakMap())
  const lastEdit = useRef(null)
  const compiler = useMemo(makeNotebookCompiler, []), active = useRef(null), owner = useRef(data)
  const latestCommit = useRef(commit)
  owner.current = data; latestCommit.current = commit
  const [, refresh] = useState(0)
  const update = () => refresh(v => v + 1)
  const authored = texts.current.get(data) ?? seed
  const draft = drafts.current.get(data)
  const text = useMemo(() => draft?.text ?? authored ?? (open ? studioModule(data) : ''), [draft, authored, open, data])
  function abort() { active.current?.abort(); active.current = null }
  useEffect(() => () => { abort(); compiler.dispose() }, [compiler])
  useEffect(() => () => abort(), [data])
  function remember(snapshot, value) { if (value != null) texts.current.set(snapshot, value) }
  function saved() { drafts.current.delete(data); update() }
  function edit(value) {
    abort()
    lastEdit.current = null
    drafts.current.set(data, { text:value, status:'editing' }); update()
  }
  function discard() { abort(); saved() }
  useEffect(() => {
    if (draft?.status !== 'editing') return
    const stop = new AbortController()
    active.current = stop
    const timer = setTimeout(async () => {
      try {
        const result = await evaluateGraph(compiler, draft.text, stop.signal, { profile:'studio' })
        if (stop.signal.aborted || owner.current !== data) return
        latestCommit.current(result)
        saved()
      } catch (cause) {
        if (stop.signal.aborted || owner.current !== data) return
        drafts.current.set(data, { ...draft, status:'error', message:cause.message }); update()
      }
    }, 300)
    return () => { clearTimeout(timer); stop.abort() }
  }, [draft, compiler, data])
  async function rewrite(operations, apply) {
    const stop = new AbortController()
    active.current = stop
    drafts.current.set(data, { text:authored, status:'syncing' }); update()
    try {
      const result = await evaluateGraph(compiler, authored, stop.signal, { profile:'studio', operations, previous:data })
      if (stop.signal.aborted || owner.current !== data) throw Error('The document changed before this edit finished.')
      return apply(result)
    } finally {
      if (drafts.current.get(data)?.status === 'syncing') saved()
    }
  }
  function markEdit(snapshot, op) { lastEdit.current = { snapshot, id:op?.id ?? op?.value?.id } }
  return { text, authored, draft, locked:!!draft, edit, discard, remember, rewrite, markEdit,
    editedId:lastEdit.current?.snapshot === data ? lastEdit.current.id : null,
    exportText:() => authored ?? studioModule(data) }
}

export function StudioSource({ code }) {
  const editor = useRef(null)
  useLayoutEffect(() => { showEditedRecord(editor.current, code.text, code.editedId) }, [code.text, code.editedId])
  return <section className="studio-source" aria-label="Live TypeScript">
    <div><label htmlFor="studio-source">data.ts</label>
      <button type="button" disabled={code.locked} onClick={() => downloadFile('data.ts', code.text, 'text/plain')}>Download TypeScript</button></div>
    <textarea ref={editor} id="studio-source" aria-label="Edit Studio TypeScript" aria-describedby="studio-source-status" value={code.text} spellCheck={false}
      autoCapitalize="off" autoComplete="off" wrap="off" onChange={e => code.edit(e.target.value)} />
    <footer><output id="studio-source-status" aria-live="polite">{code.draft?.message ?? ({ editing:'Checking TypeScript…', syncing:'Writing graph edit…' }[code.draft?.status] ?? 'TypeScript ready')}</output>
      {code.draft?.status === 'error' && <button type="button" onClick={code.discard}>Revert text</button>}</footer>
  </section>
}
