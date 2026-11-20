'use client'

import { useMemo, useState } from 'react'
import { InspectorSection, Range, Select } from './fields'
import { GroupLinks } from './explore-links'
import { opticsURL } from '../site'

export const navigationDefaults = {
  selectAction: 'inspect', openAction: 'focus', groupAction: 'expand', groupGesture: 'click',
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

const pageSize = 8

function GroupMembers({ level, members, filtered, selected, term, inspect, setView }) {
  const [page, setPage] = useState(0)
  const last = Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
  const current = Math.min(last, page)
  const start = current * pageSize
  return <div className="member-browser">
    <div className="member-heading"><h3>{level.label}</h3><span>{members.length.toLocaleString()} {members.length === 1 ? 'member' : 'members'}</span></div>
    <div className="member-views" role="group" aria-label="Group view">
      <button type="button" aria-pressed={level.action === 'expand'} onClick={() => setView('expand')}>
        <svg aria-hidden="true" viewBox="0 0 20 18"><path d="m2 4 7 5 8-6m-8 6 6 6"/><circle cx="9" cy="9" r="3"/><circle cx="2" cy="4" r="1"/><circle cx="17" cy="3" r="1"/><circle cx="15" cy="15" r="1"/></svg>In context</button>
      <button type="button" aria-pressed={level.action === 'isolate'} onClick={() => setView('isolate')}>
        <svg aria-hidden="true" viewBox="0 0 20 18"><path d="M6 2H2v4m12-4h4v4M2 12v4h4m12-4v4h-4m-9-6 4-5 5 5"/><circle cx="5" cy="10" r="1.5"/><circle cx="9" cy="5" r="1.5"/><circle cx="14" cy="10" r="1.5"/></svg>Members only</button>
    </div>
    <ul aria-label={level.label + ' members'} className="member-list">{filtered.slice(start, start + pageSize).map((node) =>
      <li key={node.id}><button type="button" data-member={node.id} data-result={term ? node.id : undefined} title={node.id}
        aria-pressed={selected === node.id} onClick={() => inspect(node.id)}>
        <i aria-hidden="true" data-kind={node.kind}/><span>{node.label || node.id}</span><small>{node.kind}</small>
      </button></li>)}</ul>
    {!filtered.length && <p role="status">No matching members.</p>}
    {last > 0 && <div className="member-pages">
      <button type="button" aria-label="Previous members" disabled={!current} onClick={() => setPage(current - 1)}>←</button>
      <output aria-live="polite">{start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length.toLocaleString()}</output>
      <button type="button" aria-label="Next members" disabled={current === last} onClick={() => setPage(current + 1)}>→</button>
    </div>}
  </div>
}

function NodeBrowser({ snapshot, select, inspect, setView, index, follow, atlas, group, openTerm }) {
  const [query, setQuery] = useState('')
  const { data, groupMembers, selected } = snapshot
  const level = snapshot.path.at(-1)
  const inGroup = level.kind === 'group'
  const term = query.trim().toLowerCase()
  const within = useMemo(() => level.kind === 'overview' ? undefined : new Set(data.nodes.map((n) => n.id)), [level.kind, data.nodes])
  const found = useMemo(() => index.search(term, { within, limit: inGroup ? data.nodes.length : 12 }), [index, term, within, inGroup, data.nodes.length])
  const memberIds = useMemo(() => new Set(groupMembers.map((n) => n.id)), [groupMembers])
  const results = inGroup ? found.filter((n) => !memberIds.has(n.id)).slice(0, 12) : found
  const matchingMembers = inGroup && term ? found.filter((n) => memberIds.has(n.id)) : groupMembers
  function chooseResult(node) {
    if (memberIds.has(node.id)) inspect(node.id, true)
    else select(node.id)
    setQuery('')
  }
  return <><div className="explore-heading"><h2 id="settings-explore" tabIndex={-1}>Explore</h2>
    {level.kind === 'overview' && !atlas && <a className="example-link" href={opticsURL}>Try Optics <span aria-hidden="true">↗</span></a>}
    </div>
    <label className="sr-only" htmlFor="find-node">Find a node in this view</label>
    <input id="find-node" type="search" autoComplete="off" placeholder={inGroup ? 'Filter group members…' : atlas ? 'Search articles or topics…' : 'Search nodes…'} value={query}
      aria-keyshortcuts="/" onChange={(e) => setQuery(e.target.value)} onKeyDown={(event) => {
        const first = matchingMembers[0] ?? results[0]
        if (event.key === 'Enter' && term && first && !event.nativeEvent.isComposing) { event.preventDefault(); chooseResult(first) }
      }} />
    {inGroup && <><GroupMembers key={term} level={level} members={groupMembers}
      filtered={matchingMembers} selected={selected} term={term}
      setView={setView} inspect={(id) => { inspect(id, !!term); if (term) setQuery('') }} />
      {!term && <GroupLinks members={groupMembers} index={index} follow={follow}/>}</>}
    {term && (!inGroup || results.length > 0) && <div className="node-results" aria-label="Matching nodes">
      {inGroup && <p>Elsewhere in this view</p>}
      {results.map((node) => <button type="button" data-result={node.id} key={node.id}
        onClick={() => chooseResult(node)}>{node.label || node.id}<small>{node.kind}</small></button>)}
      {!results.length && <p role="status">No matching nodes in this view.</p>}
    </div>}
    {atlas && !term && level.kind === 'overview' && <div className="atlas-directory">
      <p>{atlas.description}</p>
      {openTerm && group.groups.length > 0 && <><h3>Browse {group.active.id === 'section' ? 'topics' : 'groups'}</h3>
        <ul>{group.groups.slice(0, 12).map((entry) => <li key={entry.key}><button type="button" onClick={() => openTerm(entry)}>
          <i aria-hidden="true" data-shape={entry.shape} style={{ '--tone': group.displayStyle(entry).color }}/>
          <span>{entry.label}</span><small>{entry.members.length}</small><b aria-hidden="true">›</b>
        </button></li>)}</ul></>}
      <details className="atlas-credit"><summary>How the links were indexed</summary>
        <p>Each article points to up to four other articles in this atlas, ranked by links in its paragraphs. First mention breaks ties. Link weight counts those mentions.</p>
        <p>Article descriptions and links come from English Wikipedia contributors. Each article opens its recorded revision. <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0 ↗</a></p>
      </details>
    </div>}
  </>
}

export function DrillControls({ dataset, snapshot, config, change, select, inspect, setView, index, follow, atlas, group, openTerm }) {
  const level = snapshot.path.at(-1)
  return <section className="drill-controls">
    <NodeBrowser key={JSON.stringify([dataset, level.kind, level.taxonomy, level.id])}
      snapshot={snapshot} select={select} inspect={inspect} setView={setView} index={index} follow={follow} atlas={atlas} group={group} openTerm={openTerm} />
    <Select id="group-action" label="Open a group" options={groupActions} value={config.groupAction} onChange={(v) => change('groupAction', v)} />
    <InspectorSection title="Drilldown settings" value={groupActions.find(([key]) => key === config.groupAction)?.[1]} reveal={config.groupAction}>
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
    </InspectorSection>
  </section>
}

export function DrillTrail({ snapshot, drill }) {
  if (snapshot.path.length === 1) return null
  const level = snapshot.path.at(-1)
  return <nav className="drill-trail" aria-label="Graph drilldown">
    <button type="button" className="drill-back" aria-label="Back one level" onClick={drill.back}><i aria-hidden="true" />Back</button>
    <ol id="drill-location">{snapshot.path.map((level, i) => <li key={i}>{i === snapshot.path.length - 1 ?
      <span aria-current="page">{level.label}</span> : <button onClick={() => drill.goTo(i)}>{level.label}</button>}</li>)}</ol>
    {level.kind === 'group' && (level.action === 'expand' ?
      <button type="button" className="trail-members" aria-label={'Show only ' + level.memberCount + ' members'}
        onClick={() => drill.setGroupView('isolate')}>{level.memberCount} {level.memberCount === 1 ? 'member' : 'members'} <span aria-hidden="true">↗</span></button> :
      <small>{level.memberCount} {level.memberCount === 1 ? 'member' : 'members'}</small>)}
  </nav>
}
