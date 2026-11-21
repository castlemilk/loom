'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { docsURL, homeURL } from '../site'
import { InspectorSection, InspectorSummary } from './fields'
import { shapes } from './appearance'
import { downloadFile } from './download-file'
import { MetadataForm, uniqueNodeId } from './record-fields'

const paths = {
  new: 'M5 3h9l5 5v13H5zM14 3v6h5M9 14h6m-3-3v6',
  export: 'M12 15V3m-4.5 4.5L12 3l4.5 4.5M5 13v7h14v-7',
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

export function EditorToolbar({ tool, choose, select, state, history, ready, onNew, onExport, codeOpen, onCode }) {
  useEffect(() => {
    function keyboard(event) {
      if (event.defaultPrevented || editable(event.target) || event.target.closest?.('dialog[open]') || event.altKey || event.repeat) return
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
    <button type="button" aria-label="New graph" title="New graph" aria-haspopup="dialog" onClick={onNew}><Icon name="new" /><span>New</span></button>
    <button type="button" id="tool-select" aria-label="Select and move" aria-pressed={!tool} title="Select and move (V)" onClick={select}><Icon name="select"/><span className="mobile-tool-label">Select</span></button>
    {Object.entries({ node: ['Add node','Node'], link: ['Connect nodes','Connect'], json: ['JSON commands','JSON'] }).map(([id, [label, short]]) =>
      <button type="button" key={id} id={'tool-' + id} aria-label={label} title={label + ({ node:' (N)', link:' (C)', json:'' }[id])} aria-expanded={tool === id}
        aria-controls={tool === id ? 'document-composer' : undefined} disabled={!ready} onClick={() => choose(tool === id ? null : id)}>
        <Icon name={id} /><span>{short}</span></button>)}
    <i className="tool-divider" aria-hidden="true" />
    <button type="button" aria-label="Live TypeScript" title="Edit graph and TypeScript together" aria-pressed={codeOpen} onClick={onCode}>TS<span className="mobile-tool-label">Code</span></button>
    {['undo','redo'].map((id) => <button key={id} type="button" aria-label={id === 'undo' ? 'Undo document edit' : 'Redo document edit'}
      title={id === 'undo' ? 'Undo document edit (Ctrl/⌘ Z)' : 'Redo document edit (Ctrl/⌘ Shift Z)'}
      disabled={!(id === 'undo' ? state?.canUndo : state?.canRedo)} onClick={() => history(id)}><Icon name={id}/><span className="mobile-tool-label">{id === 'undo' ? 'Undo' : 'Redo'}</span></button>)}
    <button type="button" className="export-trigger" aria-label="Export graph" aria-haspopup="dialog" disabled={!ready} onClick={onExport}>
      <Icon name="export" /><span>Export</span></button>
  </div>
}

const guarded = (editor, operations) => ({ version: 1, documentId: editor.getSnapshot().documentId, expectedRevision: editor.getSnapshot().revision, operations })

function NodeForm({ model, run, point, clearPoint }) {
  const [label, setLabel] = useState(''), [kind, setKind] = useState('concept')
  return <form onSubmit={(event) => {
    event.preventDefault()
    const editor = model.editor(), id = uniqueNodeId(label, editor.getNode)
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
  return <>
    <label htmlFor={'endpoint-' + name}>{name}<input id={'endpoint-' + name} list={'ends-' + name} value={value}
      onChange={(e) => onChange(e.target.value)} required placeholder="Node ID" /></label>
    <datalist id={'ends-' + name}>{matches.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</datalist>
  </>
}

function LinkForm({ model, selectedId, graph, link, run, onEndpoints }) {
  const [source, setSource] = useState(link?.source ?? selectedId ?? ''), [target, setTarget] = useState(link?.target ?? '')
  const [kind, setKind] = useState(link?.kind ?? ''), [weight, setWeight] = useState(link?.weight?.toString() ?? '')
  const previous = useRef(selectedId)
  useEffect(() => { onEndpoints({ source, target }) }, [source, target, onEndpoints])
  const pick = useEffectEvent((id) => { if (source) setTarget(id); else setSource(id) })
  useEffect(() => {
    if (!link && graph) return graph.on('nodeclick', (id) => { previous.current = id; pick(id) })
  }, [link, graph])
  useEffect(() => {
    if (!link && selectedId && selectedId !== previous.current) pick(selectedId)
    previous.current = selectedId
  }, [selectedId, link])
  return <form onSubmit={(event) => {
    event.preventDefault()
    const editor = model.editor(), fields = { source, target, kind: kind.trim(), ...(weight !== '' && { weight: Number(weight) }) }
    const id = link?.id ?? uniqueNodeId(source + '-' + target, editor.getLink)
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
  const [text, write] = useState(() => JSON.stringify(guarded(editor, [{ op: 'node.add', value: { id: uniqueNodeId('new-node', editor.getNode), label: 'New node' } }]), null, 2))
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
    <div className="editor-meta"><span>Revision {current.revision}</span>
      <a href={docsURL + 'ai-tooling/'} target="_blank" rel="noreferrer">AI tooling guide ↗</a>
      <a href={homeURL + 'editor.schema.json'} target="_blank" rel="noreferrer">JSON Schema ↗</a></div>
    <label>Transaction<textarea value={text} spellCheck={false} rows={8} onChange={(e) => { write(e.target.value); setReview(null); report('') }} /></label>
    <div className="edit-actions"><button type="button" onClick={preview}>Preview</button><button type="button" className="commit-edit" disabled={!fresh || !review.changes.length}
      onClick={async () => { const result = await run({ ...review.body, expectedRevision: review.revision }); if (result.ok) { setReview(null); report('Applied at revision ' + result.revision) } }}>Apply changes</button></div>
    {notice && <output aria-live="polite">{notice}</output>}
    {!!review?.changes?.length && <ul className="edit-preview">{review.changes.slice(0,8).map((c,i) => <li key={i}><code>{c.op}</code> {c.id}</li>)}</ul>}
    <div className="edit-actions file-actions"><button onClick={() => document.getElementById('workload-file')?.click()}>Import graph</button>
      <button onClick={() => downloadGraph(current.data)}>Download graph</button></div>
  </div>
}

export function downloadGraph(data) {
  downloadFile('loom-graph.json', JSON.stringify(data), 'application/json')
}

export function DocumentComposer({ tool, model, selectedId, graph, link, run, close, point, clearPoint, onEndpoints }) {
  const ref = useRef(null)
  useEffect(() => {
    if (tool) ref.current?.querySelector('input, textarea')?.focus()
  }, [tool, link?.id])
  if (!tool) return null
  return <section id="document-composer" className="document-composer" ref={ref} aria-label="Document editor"
    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); close() } }}>
    <div className="composer-heading"><h2>{{ node: 'New node', link: link ? 'Connection properties' : 'New connection', json: 'JSON commands' }[tool]}</h2>
      <button type="button" aria-label="Close document editor" onClick={close}>×</button></div>
    {tool === 'node' ? <NodeForm model={model} run={run} point={point} clearPoint={clearPoint}/> : tool === 'link' ? <LinkForm key={link?.id ?? 'new'} model={model} selectedId={selectedId} graph={graph} link={link} run={run} onEndpoints={onEndpoints}/> : <JsonForm model={model} run={run}/>}
  </section>
}

const inks = [['', 'Inherit'], ['#384038','Graphite'], ['#a95036','Copper'], ['#39796e','Teal'], ['#6b609a','Violet']]

export function MarkerProperties({ node, ink, model, run }) {
  const [color, setColor] = useState(node.markerColor ?? ''), [shape, setShape] = useState(node.markerShape ?? '')
  const custom = color || ink
  const dirty = color !== (node.markerColor ?? '') || shape !== (node.markerShape ?? '')
  function apply(event) {
    event.preventDefault()
    const changes = {}, unset = []
    for (const [key, value] of [['markerColor', color], ['markerShape', shape]]) {
      if (value) changes[key] = value
      else if (node[key] !== undefined) unset.push(key)
    }
    run(guarded(model.editor(), [{ op: 'node.update', id: node.id,
      ...(Object.keys(changes).length > 0 && { changes }), ...(unset.length > 0 && { unset }) }]), node.id)
  }
  return <InspectorSection title="Marker style" value={node.markerColor || node.markerShape ? 'Custom' : 'Inherited'}>
    <form onSubmit={apply} className="marker-form">
      <fieldset className="marker-inks"><legend>Marker ink</legend>
        <div>{inks.map(([hex, label]) => <button type="button" key={label} aria-label={label + ' ink'} title={label}
          aria-pressed={hex === color} onClick={() => setColor(hex)}><i aria-hidden="true" style={hex ? { backgroundColor: hex } : undefined}/></button>)}
          <label className="custom-ink" title="Custom ink"><span className="sr-only">Custom ink</span>
            <input type="color" value={custom.length === 4 ? '#' + [...custom.slice(1)].map(c => c+c).join('') : custom}
              onChange={(e) => setColor(e.target.value)}/></label></div>
      </fieldset>
      <label>Shape for this node<select value={shape} onChange={(e) => setShape(e.target.value)}>
        <option value="">Inherit shape</option>{shapes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button className="commit-edit" disabled={!dirty}>Apply marker</button>
    </form>
  </InspectorSection>
}

export function NodeProperties({ node, connectionsLabel, model, run, editLink, initialOpen = true }) {
  const [name, setName] = useState(node.label ?? node.id), [kind, setKind] = useState(node.kind ?? '')
  const [connections, list] = useState(false), [offset, setOffset] = useState(0)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const page = connections ? model.editor().query({ entity:'link', incidentTo:node.id, offset, limit:6 }) : null
  return <>
    <InspectorSection title="Node properties" value={node.kind || 'Node'} initialOpen={initialOpen}>
      <form onSubmit={(e) => {
        e.preventDefault()
        run(guarded(model.editor(), [{ op:'node.update', id:node.id, changes:{ label:name.trim(), kind:kind.trim() } }]), node.id)
      }}>
        <label>Name<input value={name} required onChange={(e) => setName(e.target.value)}/></label>
        <label>Kind<input value={kind} onChange={(e) => setKind(e.target.value)}/></label>
        <div className="edit-actions"><button className="commit-edit" disabled={!name.trim() || (name.trim() === (node.label ?? node.id) && kind.trim() === (node.kind ?? ''))}>Save node</button>
          <button type="button" onClick={() => run(guarded(model.editor(), [{ op:'node.remove', id:node.id, cascade:true }]), null)}>Remove node</button></div>
      </form>
      {metadataOpen ? <MetadataForm metadata={node.metadata} cancel={() => setMetadataOpen(false)} save={async metadata => {
        const receipt = await run(guarded(model.editor(), [{ op:'node.update', id:node.id, changes:{ metadata } }]), node.id)
        if (receipt.ok) setMetadataOpen(false)
      }}/> : <button type="button" onClick={() => setMetadataOpen(true)}>Edit metadata</button>}
      {model.data.images && typeof model.data.images === 'object' && <label>Image reference<select value={node.art ?? ''} onChange={e => {
        const art = e.target.value
        run(guarded(model.editor(), [{ op:'node.update', id:node.id, ...(art ? {changes:{art}} : {unset:['art']}) }]), node.id)
      }}><option value="">No image</option>{Object.keys(model.data.images).map(key => <option key={key} value={key}>{key}</option>)}</select></label>}
    </InspectorSection>
    <details className="inspector-section" onToggle={(e) => list(e.currentTarget.open)}>
      <InspectorSummary title="Connections" value={page?.total ?? connectionsLabel}/>
      {page && <div className="incident-list">{page.items.map((edge) => <button type="button" key={edge.id} title={edge.id}
        onClick={() => editLink(model.editor().getLink(edge.id))}><span>{edge.source === node.id ? '→ ' + edge.target : '← ' + edge.source}</span><small>{edge.kind || 'Link'}</small></button>)}
        {!page.total && <p>No incident connections.</p>}
        {(offset > 0 || page.nextOffset !== null) && <div className="edit-actions"><button disabled={!offset} onClick={() => setOffset(offset - 6)}>Previous</button>
          <button disabled={page.nextOffset === null} onClick={() => setOffset(page.nextOffset)}>Next</button></div>}</div>}
    </details>
  </>
}
