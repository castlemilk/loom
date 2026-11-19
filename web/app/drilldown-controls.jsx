'use client'

import { useMemo, useState } from 'react'
import { Range, Select } from './fields'

export const navigationDefaults = {
  selectAction: 'inspect', openAction: 'neighbors', groupAction: 'expand', groupGesture: 'click',
  boundary: 'outline', detail: 'force', direction: 'both', hops: 1, spread: 2, expansionBlend: 0.7,
  arrangement: 'rings', spacing: 28,
}
const actions = [['inspect','Inspect node'], ['focus','Focus camera'], ['neighbors','Open neighbors'], ['group','Open its group']]
const groupActions = [['expand','Expand in place'], ['isolate','Isolate members'], ['none','Disabled']]
const detailLayouts = [['force','Free force layout'], ['inherit','Use overview layout'], ['orbit','Orbit selected node'], ['cloud','3D force cloud']]
export function detailOptions(value) {
  if (value === 'inherit') return {}
  return { mode: value === 'force' ? 'drift' : value, layout: { anchor: null, blend: 0, guides: false } }
}

export function DrillControls({ data, config, change, select }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    const hits = []
    for (const node of data.nodes) {
      if ((node.label ?? '').toLowerCase().includes(term) || node.id.toLowerCase().includes(term)) hits.push(node)
      if (hits.length === 12) break
    }
    return hits
  }, [query, data.nodes])
  return <section className="drill-controls"><h2>Explore</h2>
    <label className="sr-only" htmlFor="find-node">Find a node in this view</label>
    <input id="find-node" type="search" autoComplete="off" placeholder="Find a node by name or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
    {query.trim() && <div className="node-results" aria-label="Matching nodes">
      {results.map((node) => <button type="button" data-result={node.id} key={node.id}
        onClick={() => { select(node.id); setQuery('') }}>{node.label || node.id}<small>{node.kind}</small></button>)}
      {!results.length && <p role="status">No matching nodes in this view.</p>}
    </div>}
    <Select id="group-action" label="Open a group" options={groupActions} value={config.groupAction} onChange={(v) => change('groupAction', v)} />
    <details><summary>Drilldown settings</summary>
      <Select id="select-action" label="Select a node" options={actions} value={config.selectAction} onChange={(v) => change('selectAction', v)} />
      <Select id="open-action" label="Double-click / Enter" options={actions} value={config.openAction} onChange={(v) => change('openAction', v)} />
      {config.groupAction !== 'none' && <>
        <Select id="group-gesture" label="Inside a bubble" options={[[ 'click','Single click'],['double-click','Double-click'],['controls','Use group buttons']]}
          value={config.groupGesture} onChange={(v) => change('groupGesture', v)} />
        <Select id="opened-boundary" label="Opened boundary" options={[[ 'outline','Outline only'],['fade','Fade fill'],['hide','Hide boundary'],['keep','Keep styling']]}
          value={config.boundary} onChange={(v) => change('boundary', v)} />
      </>}
      {config.groupAction === 'expand' && <>
        <Select id="member-arrangement" label="Arrange members" options={[[ 'rings','Spaced rings'],['radial','Fan out from center']]}
          value={config.arrangement} onChange={(v) => change('arrangement', v)} />
        <Range id="member-spacing" label="Member spacing" min={8} max={120} value={config.spacing} format={(v) => v + ' units'} onChange={(v) => change('spacing', v)} />
        <Range id="group-spread" label="Member spread" min={1} max={4} step={0.1} value={config.spread} format={(v) => v + '×'} onChange={(v) => change('spread', v)} />
        <Range id="group-pull" label="Expansion attraction" min={0} max={100} value={Math.round(100 * config.expansionBlend)} format={(v) => v + '%'} onChange={(v) => change('expansionBlend', v / 100)} />
      </>}
      <Select id="detail-layout" label="Isolated detail layout" options={detailLayouts} value={config.detail} onChange={(v) => change('detail', v)} />
      <Select id="neighbor-direction" label="Follow links" options={[[ 'both','Both directions'], ['outgoing','Outgoing'], ['incoming','Incoming']]}
        value={config.direction} onChange={(v) => change('direction', v)} />
      <Range id="neighbor-hops" label="Neighbor hops" min={1} max={4} value={config.hops} onChange={(v) => change('hops', v)} />
    </details>
  </section>
}

export function DrillTrail({ snapshot, drill }) {
  if (snapshot.path.length === 1) return null
  const level = snapshot.path.at(-1)
  return <nav className="drill-trail" aria-label="Graph drilldown">
    <button type="button" className="drill-back" aria-label="Back one level" onClick={drill.back}><i aria-hidden="true" />Back</button>
    <ol id="drill-location">{snapshot.path.map((level, i) => <li key={i}>{i === snapshot.path.length - 1 ?
      <span aria-current="page">{level.label}</span> : <button onClick={() => drill.goTo(i)}>{level.label}</button>}</li>)}</ol>
    {level.kind === 'group' && <small>{level.memberCount} {level.memberCount === 1 ? 'member' : 'members'}</small>}
  </nav>
}
