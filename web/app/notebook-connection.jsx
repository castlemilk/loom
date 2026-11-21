'use client'

import { useState } from 'react'
import { uniqueNodeId } from './record-fields'

export function NotebookConnection({ tool, graph, from, apply, close, disabled }) {
  const [source, setSource] = useState(from ?? graph.nodes[0]?.id ?? '')
  const [target, setTarget] = useState('')
  const [name, setName] = useState(''), [kind, setKind] = useState('Moon'), [relationship, setRelationship] = useState(''), [note, setNote] = useState('')
  const connecting = tool === 'connect', creating = !connecting || !target
  function submit(e) {
    e.preventDefault()
    const ops = [], id = creating ? uniqueNodeId(name, value => graph.nodes.some(n => n.id === value)) : target
    if (creating) {
      const origin = graph.nodes.find(n => n.id === source)
      const x = (origin?.x ?? 0) + (origin ? 36 : 0)
      let y = (origin?.y ?? 0) + (origin ? 130 : 0)
      while (graph.nodes.some(n => Math.abs(n.x - x) < 200 && Math.abs(n.y - y) < 85)) y += 108
      ops.push({ op:'node.add', value:{ id, label:name.trim(), kind:kind.trim(), x, y } })
    }
    if (connecting) ops.push({ op:'link.add', value:{ source, target:id, kind:relationship.trim(), ...(note.trim() && { note:note.trim() }) } })
    apply(ops, creating ? id : source)
  }
  return <form className="notebook-compose" aria-label={connecting ? 'Connect a node' : 'Create a node'} onSubmit={submit}>
    <fieldset disabled={disabled}><legend>{connecting ? 'Connect nodes' : 'New node'}</legend>
      {connecting && <div className="notebook-pair"><label>From<select value={source} onChange={e => setSource(e.target.value)}>
        {graph.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
        <label>To<select value={target} onChange={e => setTarget(e.target.value)}><option value="">New node…</option>
          {graph.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label></div>}
      {creating && <div className="notebook-pair"><label>Node name<input required autoFocus value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Node kind<input required value={kind} onChange={e => setKind(e.target.value)} /></label></div>}
      {connecting && <><label>Relationship<input required placeholder="e.g. hosts" value={relationship} onChange={e => setRelationship(e.target.value)} /></label>
        <label>Connection note <small>(optional)</small><input value={note} onChange={e => setNote(e.target.value)} /></label></>}
      <div className="record-actions"><button type="submit" className="record-submit" disabled={creating && (!name.trim() || !kind.trim()) || connecting && (!source || !relationship.trim())}>{connecting ? 'Create connection' : 'Create node'}</button>
        <button type="button" onClick={close}>Cancel</button></div>
    </fieldset>
  </form>
}
