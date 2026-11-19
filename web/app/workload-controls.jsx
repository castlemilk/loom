'use client'

import { useEffect, useRef, useState } from 'react'
import { downloadGraph } from './editor-tools'
import { presets, importWorkload, buildWorkload, mergeWorkload, maxNodes } from './workload.mjs'
import { Select } from './fields'

export function WorkloadControls({ data, active, draft, edit, onGenerate, onLoad }) {
  const [open, expand] = useState(active), [notice, setNotice] = useState(null)
  const preset = Object.keys(presets).find((key) => presets[key].label === draft.label)
  const report = (text) => setNotice({ draft, text })
  const file = useRef(null), read = useRef(0)
  useEffect(() => { if (active) expand(true) }, [active])
  useEffect(() => () => { read.current++ }, [data])
  const update = (key, value) => edit((old) => ({ ...old, [key]: value }))
  function apply(append) {
    read.current++
    try {
      const config = { ...draft }
      for (const key of ['nodes', 'degree', 'seed', 'variety', 'coverage']) config[key] = draft[key] === '' ? NaN : Number(draft[key])
      if (append) {
        const combined = mergeWorkload(data, config)
        onLoad(combined, 'Combined test graph')
        report('Added ' + config.nodes.toLocaleString() + ' nodes.')
      } else {
        const generated = buildWorkload(config)
        onGenerate(config, generated)
        report('Generated seed ' + config.seed + '.')
      }
    } catch (error) { report(error.message) }
  }
  async function loadFile(event) {
    const item = event.target.files[0], ticket = ++read.current
    event.target.value = ''
    if (!item) return
    try {
      const next = importWorkload(JSON.parse(await item.text()))
      if (ticket !== read.current) return
      onLoad(next, item.name)
      report('Loaded ' + item.name + '.')
    } catch (error) { if (ticket === read.current) report(error.message) }
  }
  return <details className="workload-panel" open={open} onToggle={(e) => expand(e.currentTarget.open)}>
    <summary>Test data</summary>
    <Select id="workload-preset" label="Preset" options={Object.entries(presets).map(([k, v]) => [k, v.label])}
      value={preset} onChange={(key) => { edit({ ...presets[key], seed: draft.seed }); report('') }} />
    <div className="workload-numbers">
      {Object.entries({ nodes: ['Nodes', 1, maxNodes], degree: ['Links per node', 0, 16],
        coverage: ['Images (%)', 0, 100], variety: ['Unique image pool', 1, 256] }).map(([key, [name, min, max]]) =>
        <label key={key}>{name}<input id={'workload-' + key} type="number" min={min} max={max} value={draft[key]} onChange={(e) => update(key, e.target.value)} /></label>)}
    </div>
    <Select id="workload-topology" label="Connections" value={draft.topology} onChange={(v) => update('topology', v)}
      options={[[ 'clusters', 'Local clusters'], ['hubs', 'Hub and spoke'], ['random', 'Random']]} />
    <Select id="workload-text" label="Content" value={draft.text} onChange={(v) => update('text', v)}
      options={[[ 'labels', 'Titles only'], ['notes', 'Field notes'], ['articles', 'Long-form articles']]} />
    <div className="seed-field"><label htmlFor="workload-seed">Seed</label>
      <input id="workload-seed" type="number" min={0} max={4294967295} value={draft.seed} onChange={(e) => update('seed', e.target.value)} />
      <button onClick={() => update('seed', crypto.getRandomValues(new Uint32Array(1))[0])}>New seed</button></div>
    <div className="workload-actions"><button className="generate" onClick={() => apply(false)}>Generate graph</button>
      <button onClick={() => apply(true)}>Append batch</button></div>
    <div className="workload-files"><button onClick={() => file.current?.click()}>Import JSON</button>
      <button onClick={() => downloadGraph(data)}>Export JSON</button><input ref={file} type="file" id="workload-file" accept=".json,application/json" hidden onChange={loadFile} /></div>
    <p role="status" className="workload-message">{notice?.draft === draft ? notice.text : ''}</p>
  </details>
}
