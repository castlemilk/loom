'use client'

import { useRef, useState } from 'react'

export function uniqueNodeId(label, exists) {
  const stem = label.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'node'
  let id = stem
  for (let suffix = 2; exists(id); suffix++) id = stem + '-' + suffix
  return id
}

function initialRows(record) {
  return Object.entries(record ?? {}).map(([name, value], id) => {
    const type = typeof value === 'string' ? 'text' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'json'
    return { id, name, type, input: type === 'text' ? value : JSON.stringify(value) }
  })
}

export function MetadataForm({ metadata, save, cancel, disabled }) {
  const [rows, setRows] = useState(() => initialRows(metadata)), [error, setError] = useState('')
  const nextId = useRef(rows.length)
  function change(id, field) { setRows(all => all.map(row => row.id === id ? { ...row, ...field } : row)); setError('') }
  function submit(event) {
    event.preventDefault()
    try {
      const entries = new Map()
      for (const { name, type, input } of rows) {
        if (!name.trim() || entries.has(name)) throw Error('Give each field a distinct name.')
        let value = input
        if (type !== 'text') {
          try { value = JSON.parse(input) } catch { throw Error('Enter a valid ' + (type === 'json' ? 'JSON value' : type) + ' for ' + name + '.') }
          if (type === 'number' && !Number.isFinite(value) || type === 'boolean' && typeof value !== 'boolean') throw Error('Check the ' + type + ' value for ' + name + '.')
        }
        entries.set(name, value)
      }
      save(Object.fromEntries(entries))
    } catch (cause) { setError(cause.message) }
  }
  return <form className="record-fields" aria-label="Edit metadata" onSubmit={submit}>
    <fieldset disabled={disabled}><legend>Metadata</legend>
      {rows.map(({ id, name, type, input }, i) => <div className="record-field" key={id}>
        <label>Field name<input aria-label={'Field name ' + (i + 1)} value={name} onChange={e => change(id, { name: e.target.value })} required /></label>
        <label>Type<select aria-label={'Type for ' + (name || 'new field')} value={type} onChange={e => change(id, { type: e.target.value, ...(e.target.value === 'boolean' && {input:'true'}) })}>
          <option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="json">JSON</option>
        </select></label>
        <label className="record-value">Value{type === 'boolean' ? <select aria-label={'Value for ' + name} value={input} onChange={e => change(id, { input:e.target.value })}><option>true</option><option>false</option></select> :
          <textarea rows={type === 'json' ? 2 : 1} aria-label={'Value for ' + (name || 'new field')} value={input} onChange={e => change(id, { input:e.target.value })} />}</label>
        <button type="button" aria-label={'Remove field ' + (name || (i + 1))} onClick={() => setRows(all => all.filter(row => row.id !== id))}>×</button>
      </div>)}
      <button type="button" onClick={() => setRows([...rows, { id:nextId.current++, name:'', type:'text', input:'' }])}>+ Add field</button>
      <div className="record-actions"><button type="submit" className="record-submit">Save metadata</button><button type="button" onClick={cancel}>Cancel</button></div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>
}
