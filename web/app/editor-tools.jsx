'use client'

import { useEffect, useRef, useState } from 'react'
import { homeURL } from '../site'
import { InspectorSection } from './fields'

const paths = {
  select: 'M5 3.5 20 13l-7 .8-3.1 6.4L5 3.5Z',
  node: 'M12 3v18M3 12h18',
  link: 'm9 15 6-6m-5-2 2-2a5 5 0 0 1 7 7l-2 2m-3 3-2 2a5 5 0 0 1-7-7l2-2',
  undo: 'm9 4-5 5 5 5M5 9h9a6 6 0 0 1 0 12',
  redo: 'm15 4 5 5-5 5m4-5h-9a6 6 0 0 0 0 12',
  json: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20',
}
function Icon({ name }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}
const editable = (target) => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')

export function EditorToolbar({ tool, choose, select, state, history, ready }) {
  useEffect(() => {
    function keyboard(event) {
      if (event.defaultPrevented || editable(event.target) || event.altKey || event.repeat) return
      const key = event.key.toLowerCase()
      if (!(event.ctrlKey || event.metaKey)) {
        if (!ready || !event.target.closest?.('#graph, .editor-dock')) return
        if (key === 'v' || key === 'escape' && tool) select()
        else if (key === 'n' || key === 'c') choose(key === 'n' ? 'node' : 'link')
        else return
        event.preventDefault()
        return
      }
      if (key !== 'z' && key !== 'y') return
      const undo = key === 'z' && !event.shiftKey
      if (undo ? state?.canUndo : state?.canRedo) { event.preventDefault(); history(undo ? 'undo' : 'redo') }
    }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  }, [history, state, choose, select, tool, ready])
  return <div className="editor-dock" role="group" aria-label="Document tools">
    <button type="button" id="tool-select" aria-label="Select and move" aria-pressed={!tool} title="Select and move (V)" onClick={select}><Icon name="select"/></button>
    {Object.entries({ node: ['Add node','Node'], link: ['Connect nodes','Connect'], json: ['JSON commands','JSON'] }).map(([id, [label, short]]) =>
      <button type="button" key={id} id={'tool-' + id} aria-label={label} title={label + ({ node:' (N)', link:' (C)', json:'' }[id])} aria-expanded={tool === id}
        aria-controls={tool === id ? 'document-composer' : undefined} disabled={!ready} onClick={() => choose(tool === id ? null : id)}>
        <Icon name={id} /><span>{short}</span></button>)}
    <i className="tool-divider" aria-hidden="true" />
    {['undo','redo'].map((id) => <button key={id} type="button" aria-label={id === 'undo' ? 'Undo document edit' : 'Redo document edit'}
      title={id === 'undo' ? 'Undo document edit (Ctrl/⌘ Z)' : 'Redo document edit (Ctrl/⌘ Shift Z)'}
      disabled={!(id === 'undo' ? state?.canUndo : state?.canRedo)} onClick={() => history(id)}><Icon name={id}/></button>)}
  </div>
}

function uniqueId(name, exists) {
  const base = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'node'
  let id = base, n = 1
  while (exists(id)) id = base + '-' + ++n
  return id
}
const guarded = (editor, operations) => ({ version: 1, documentId: editor.getSnapshot().documentId, expectedRevision: editor.getSnapshot().revision, operations })

function NodeForm({ model, run, point, clearPoint }) {
  const [label, setLabel] = useState(''), [kind, setKind] = useState('concept')
  return <form onSubmit={(event) => {
    event.preventDefault()
    const editor = model.editor(), id = uniqueId(label, editor.getNode)
    run(guarded(editor, [{ op: 'node.add', value: { id, label: label.trim(), kind: kind.trim(), ...(point && { ...point, pinned: true }) } }]), id)
  }}>
    <label>Name<input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Node name" /></label>
    <label>Kind<input value={kind} onChange={(e) => setKind(e.target.value)} /></label>
    <div className="placement">{point ? <><output>Pinned at {Math.round(point.x)}, {Math.round(point.y)}</output><button type="button" onClick={clearPoint}>Auto-place</button></> :
      <p>Click empty canvas to place the node, or let the layout position it.</p>}</div>
    <button className="commit-edit" disabled={!label.trim()}>Create node</button>
  </form>
}

function Endpoint({ name, value, onChange, nodes }) {
  const matches = []
  const query = value.toLowerCase()
  for (const n of nodes) {
    if (n.id.toLowerCase().includes(query) || n.label?.toLowerCase().includes(query)) matches.push(n)
    if (matches.length === 8) break
  }
  return <label>{name}<input list={'ends-' + name} value={value} onChange={(e) => onChange(e.target.value)} required placeholder="Node ID" />
    <datalist id={'ends-' + name}>{matches.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</datalist></label>
}

function LinkForm({ model, selectedId, link, run }) {
  const [source, setSource] = useState(link?.source ?? selectedId ?? ''), [target, setTarget] = useState(link?.target ?? '')
  const [kind, setKind] = useState(link?.kind ?? ''), [weight, setWeight] = useState(link?.weight?.toString() ?? '')
  const previous = useRef(selectedId)
  useEffect(() => {
    if (!link && selectedId && selectedId !== previous.current) {
      if (!source) setSource(selectedId)
      else setTarget(selectedId)
    }
    previous.current = selectedId
  }, [selectedId, source, link])
  return <form onSubmit={(event) => {
    event.preventDefault()
    const editor = model.editor(), fields = { source, target, kind: kind.trim(), ...(weight !== '' && { weight: Number(weight) }) }
    const id = link?.id ?? uniqueId(source + '-' + target, editor.getLink)
    const op = link ? { op: 'link.update', id, changes: fields, ...(weight === '' && link.weight !== undefined && { unset: ['weight'] }) } :
      { op: 'link.add', value: { id, ...fields } }
    run(guarded(editor, [op]), source)
  }}>
    {!link && <p>Pick nodes on the canvas or enter their IDs. <b>{Number(!!source) + Number(!!target)}/2</b></p>}
    <Endpoint name="From" value={source} onChange={setSource} nodes={model.data.nodes}/>
    <Endpoint name="To" value={target} onChange={setTarget} nodes={model.data.nodes}/>
    <div className="editor-pair"><label>Relationship<input value={kind} onChange={(e) => setKind(e.target.value)} /></label>
      <label>Weight<input type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} /></label></div>
    <div className="edit-actions"><button className="commit-edit" disabled={!source || !target}>{link ? 'Save connection' : 'Create connection'}</button>
      {link && <button type="button" onClick={() => run(guarded(model.editor(), [{ op: 'link.remove', id: link.id }]), source)}>Remove connection</button>}</div>
  </form>
}

function JsonForm({ model, run }) {
  const editor = model.editor()
  const [text, write] = useState(() => JSON.stringify(guarded(editor, [{ op: 'node.add', value: { id: uniqueId('new-node', editor.getNode), label: 'New node' } }]), null, 2))
  const [review, setReview] = useState(null), [notice, report] = useState('')
  const current = editor.getSnapshot()
  const fresh = review?.ok && review.editor === editor && review.revision === current.revision && review.text === text
  function preview() {
    try {
      const body = JSON.parse(text), result = editor.preview(body)
      setReview({ ...result, editor, text, body })
      report(result.ok ? result.changes.length + ' changes · revision ' + result.revision : result.error.path + ' ' + result.error.message)
    } catch (e) { setReview(null); report(e.message) }
  }
  return <div className="transaction-form">
    <div className="editor-meta"><span>Revision {current.revision}</span><a href={homeURL + 'editor.schema.json'} target="_blank" rel="noreferrer">JSON Schema ↗</a></div>
    <label>Transaction<textarea value={text} spellCheck={false} rows={8} onChange={(e) => { write(e.target.value); setReview(null); report('') }} /></label>
    <div className="edit-actions"><button type="button" onClick={preview}>Preview</button><button type="button" className="commit-edit" disabled={!fresh || !review.changes.length}
      onClick={() => { const result = run({ ...review.body, expectedRevision: review.revision }); if (result.ok) { setReview(null); report('Applied at revision ' + result.revision) } }}>Apply changes</button></div>
    {notice && <output aria-live="polite">{notice}</output>}
    {!!review?.changes?.length && <ul className="edit-preview">{review.changes.slice(0,8).map((c,i) => <li key={i}><code>{c.op}</code> {c.id}</li>)}</ul>}
    <div className="edit-actions file-actions"><button onClick={() => document.getElementById('workload-file')?.click()}>Import graph</button>
      <button onClick={() => downloadGraph(current.data)}>Download graph</button></div>
  </div>
}

export function downloadGraph(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'loom-graph.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DocumentComposer({ tool, model, selectedId, link, run, close, point, clearPoint }) {
  const ref = useRef(null)
  useEffect(() => {
    if (tool) ref.current?.querySelector('input, textarea')?.focus()
  }, [tool, link?.id])
  if (!tool) return null
  return <section id="document-composer" className="document-composer" ref={ref} aria-label="Document editor"
    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); close() } }}>
    <div className="composer-heading"><h2>{{ node: 'New node', link: link ? 'Connection properties' : 'New connection', json: 'JSON commands' }[tool]}</h2>
      <button type="button" aria-label="Close document editor" onClick={close}>×</button></div>
    {tool === 'node' ? <NodeForm model={model} run={run} point={point} clearPoint={clearPoint}/> : tool === 'link' ? <LinkForm key={link?.id ?? 'new'} model={model} selectedId={selectedId} link={link} run={run}/> : <JsonForm model={model} run={run}/>}
  </section>
}

export function NodeProperties({ node, model, run, editLink }) {
  const [name, setName] = useState(node.label ?? node.id), [kind, setKind] = useState(node.kind ?? '')
  const [connections, list] = useState(false), [offset, setOffset] = useState(0)
  const page = connections ? model.editor().query({ entity:'link', incidentTo:node.id, offset, limit:6 }) : null
  return <>
    <InspectorSection title="Node properties" value={node.kind || 'Node'} initialOpen>
      <form onSubmit={(e) => {
        e.preventDefault()
        run(guarded(model.editor(), [{ op:'node.update', id:node.id, changes:{ label:name.trim(), kind:kind.trim() } }]), node.id)
      }}>
        <label>Name<input value={name} required onChange={(e) => setName(e.target.value)}/></label>
        <label>Kind<input value={kind} onChange={(e) => setKind(e.target.value)}/></label>
        <div className="edit-actions"><button className="commit-edit" disabled={!name.trim() || (name.trim() === (node.label ?? node.id) && kind.trim() === (node.kind ?? ''))}>Save node</button>
          <button type="button" onClick={() => run(guarded(model.editor(), [{ op:'node.remove', id:node.id, cascade:true }]), null)}>Remove node</button></div>
      </form>
    </InspectorSection>
    <details className="inspector-section" onToggle={(e) => list(e.currentTarget.open)}>
      <summary><span>Connections</span>{page && <small>{page.total}</small>}<i aria-hidden="true"/></summary>
      {page && <div className="incident-list">{page.items.map((edge) => <button type="button" key={edge.id} title={edge.id}
        onClick={() => editLink(model.editor().getLink(edge.id))}><span>{edge.source === node.id ? '→ ' + edge.target : '← ' + edge.source}</span><small>{edge.kind || 'Link'}</small></button>)}
        {!page.total && <p>No incident connections.</p>}
        {(offset > 0 || page.nextOffset !== null) && <div className="edit-actions"><button disabled={!offset} onClick={() => setOffset(offset - 6)}>Previous</button>
          <button disabled={page.nextOffset === null} onClick={() => setOffset(page.nextOffset)}>Next</button></div>}</div>}
    </details>
  </>
}
