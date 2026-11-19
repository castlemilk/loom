'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { compileTaxonomies, parseTaxonomy, scopeTaxonomies } from '../../dist/taxonomy.js'
import { connectedComponents } from '../../dist/clusters.js'
import { knowledgeConsole } from '../../dist/index.js'
import { kindOrder, marker, patterns } from './appearance'
import { Check, InspectorSection, Range, Select } from './fields'

const typeNames = { study: 'Study', concept: 'Concept', tag: 'Tag', blog: 'Article', lab: 'Lab', category: 'Category' }
const types = { id: 'kind', label: 'Node type', by: 'kind', terms: Object.fromEntries(kindOrder.map((kind) =>
  [kind, { label: typeNames[kind], color: knowledgeConsole.kind[kind] }])) }
const category = { id: 'category', label: 'Category', by: { relation: 'category', groupEnd: 'target' } }
const section = { id: 'section', label: 'Section', by: 'section', terms: {
  Optics: { label: 'Optics', color: '#bc9de0' }, Acoustics: { label: 'Acoustics', color: '#70c7b4' },
  Materials: { label: 'Materials', color: '#dfb16b' }, Tides: { label: 'Tides', color: '#87afe1' },
} }
const example = { id: 'family', label: 'Content family', by: 'kind',
  remap: { study: 'work', lab: 'work', blog: 'work', tag: 'subject', concept: 'subject', category: 'subject' },
  terms: { work: { label: 'Published work', color: '#63b6a0' }, subject: { label: 'Subjects', color: '#cfa35c' } } }
const storageKey = 'loom.taxonomies.v1'

const defaultWords = { singular: 'link', plural: 'links', ungrouped: 'Ungrouped' }

export function useGrouping(source, data, theme, packed) {
  const [custom, setCustom] = useState([])
  const [activeId, setActive] = useState('kind')
  const [bubbles, setBubbles] = useState({})
  const [bubblesVisible, setBubblesVisible] = useState(true)
  const [tooltips, setTooltips] = useState(true)
  const [boundary, setBoundary] = useState({ shape: 'hull', padding: 12, pattern: 'solid', fillOpacity: 0.09 })
  const [words, setWords] = useState(defaultWords)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      if (Array.isArray(saved)) setCustom(saved.map((rule) => parseTaxonomy(JSON.stringify(rule))))
      const stored = JSON.parse(localStorage.getItem(storageKey + '.language') ?? 'null')
      if (stored && Object.keys(defaultWords).every((key) => typeof stored[key] === 'string' && stored[key].trim())) setWords(stored)
    } catch { /* An unavailable or older browser store can start with the built-in definitions. */ }
  }, [])
  const needComponents = activeId === 'component' || bubbles.component === true || !!bubbles.component?.length
  const definitions = useMemo(() => {
    const component = { id: 'component', label: 'Connected component', by: needComponents ? connectedComponents(source) : () => undefined }
    const rules = new Map([types, category, section, component].map((d) => [d.id, d]))
    for (const d of custom) rules.set(d.id, d)
    return [...rules.values()]
  }, [custom, source, needComponents])
  const root = useMemo(() => compileTaxonomies(source, { taxonomies: definitions,
    language: { ungrouped: words.ungrouped, connections: (n) => n + ' ' + (n === 1 ? words.singular : words.plural) } }), [source, definitions, words])
  const index = useMemo(() => data.nodes === source.nodes ? root : scopeTaxonomies(root, data.nodes), [root, data.nodes, source.nodes])
  const active = definitions.find((rule) => rule.id === activeId) ?? types
  const groups = index.legend(active.id)
  const laneBy = useMemo(() => index.laneBy(active.id), [active.id, index])
  const laneOrder = useMemo(() => groups.map((group) => group.id), [groups])
  const kindStyles = !custom.some((rule) => rule.id === 'kind')
  const displayStyle = useCallback((term) => term.taxonomy === 'kind' && kindStyles ? marker(theme, term.id) : term, [kindStyles, theme])
  const annotations = useMemo(() => ({
    bubbles: packed && !Object.hasOwn(bubbles, active.id) ? { ...bubbles, [active.id]: groups.length <= 12 ? true : groups.slice(0, 8).map((g) => g.id) } : bubbles,
    bubblesVisible, boundary, tooltips, laneTaxonomy: active.id, colorFor: (group) => displayStyle(group).color,
  }), [bubbles, bubblesVisible, packed, groups, boundary, tooltips, active.id, displayStyle])
  function save(next) {
    setCustom(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Edits still apply in this tab. */ }
  }
  function apply(rule) {
    save([...custom.filter((r) => r.id !== rule.id), rule])
    setActive(rule.id)
  }
  function remove() {
    save(custom.filter((r) => r.id !== active.id))
    setActive(active.id === 'category' ? 'category' : 'kind')
    setBubbles((old) => ({ ...old, [active.id]: [] }))
  }
  function language(next) {
    setWords(next)
    try { localStorage.setItem(storageKey + '.language', JSON.stringify(next)) } catch { /* In-memory settings are still active. */ }
  }
  return { definitions, custom, root, index, active, groups, laneBy, laneOrder, annotations, setActive, apply, remove,
    words, language, displayStyle, nativeMarkers: kindStyles && active.id === 'kind',
    setTooltips, setBubblesVisible, setBoundary: (patch) => setBoundary((old) => ({ ...old, ...patch })),
    setVisible: (visible, taxonomy = active.id) => setBubbles((old) => ({ ...old, [taxonomy]: visible })) }
}

function Language({ group }) {
  return <details><summary>Display language</summary>
    <form onSubmit={(event) => {
      event.preventDefault()
      const entries = new FormData(event.currentTarget)
      group.language(Object.fromEntries(Object.keys(defaultWords).map((key) => [key, entries.get(key).trim() || defaultWords[key]])))
    }}>
      {Object.entries({ singular: 'One connection', plural: 'Many connections', ungrouped: 'Unassigned lane' }).map(([key, label]) =>
        <label className="field" key={key}>{label}<input name={key} required defaultValue={group.words[key]} /></label>)}
      <button>Apply language</button>
    </form>
  </details>
}

function DefinitionEditor({ group }) {
  const [draft, setDraft] = useState(() => JSON.stringify(group.active, null, 2))
  const [message, report] = useState('')
  function apply() {
    try {
      group.apply(parseTaxonomy(draft))
      report('Definition applied.')
    } catch (error) { report(error.message) }
  }
  return <details className="definition"><summary>Define a taxonomy</summary>
    <label htmlFor="taxonomy-json">JSON definition</label>
    <textarea id="taxonomy-json" spellCheck={false} rows={8} value={draft} onChange={(e) => { setDraft(e.target.value); report('') }} />
    <div className="flex flex-wrap gap-1.5">
      <button onClick={apply}>Apply definition</button>
      <button onClick={() => { setDraft(JSON.stringify(example, null, 2)); report('') }}>New from example</button>
      {group.custom.some((r) => r.id === group.active.id) && <button onClick={group.remove}>Remove override</button>}
    </div>
    <p role="status" className="text-xs">{message}</p>
  </details>
}

export function Grouping({ level, group, packed, setPacked, gap, setGap, openTerm }) {
  const [filter, setFilter] = useState('')
  const groupVerb = (term) => level.kind === 'group' && level.id === term.id && level.taxonomy === term.taxonomy ? 'Close' : 'Open'
  const list = group.groups
  const visible = Object.hasOwn(group.annotations.bubbles, group.active.id) ? group.annotations.bubbles[group.active.id] : []
  const checked = (id) => visible === true || visible.includes(id)
  const all = list.length > 0 && list.every((term) => checked(term.id))
  const filtered = list.filter((term) => term.label.toLowerCase().includes(filter.toLowerCase()))
  function toggle(id, enabled) {
    const ids = new Set(visible === true ? list.map((g) => g.id) : visible)
    if (enabled) ids.add(id)
    else ids.delete(id)
    group.setVisible([...ids])
  }
  return <section className="grouping"><h2 id="settings-groups" tabIndex={-1}>Taxonomies</h2>
    <label className="bubble-master" htmlFor="group-bubbles">
      <span>Show group bubbles<small>Boundaries around the chosen groups</small></span>
      <input id="group-bubbles" type="checkbox" role="switch" aria-label="Show group bubbles"
        checked={group.annotations.bubblesVisible} onChange={(e) => group.setBubblesVisible(e.target.checked)} />
    </label>
    <Select id="taxonomy" label="Group by" options={group.definitions.map((d) => [d.id, d.label])}
      value={group.active.id} onChange={(id) => { setFilter(''); group.setActive(id) }} />
    <Check id="cluster-layout" label="Cluster groups together" checked={packed} onChange={setPacked} />
    {packed && !list.length && <p className="encoding-note">This graph has no matching groups. Choose another taxonomy or the Section atlas example.</p>}
    {packed && <Range id="cluster-gap" label="Cluster spacing" min={0} max={240} step={5} value={gap}
      format={(v) => v + ' units'} onChange={setGap} />}
    <Check id="tooltips" label="Node tooltips" checked={group.annotations.tooltips} onChange={group.setTooltips} />
    <InspectorSection title="Group bubbles" value={group.annotations.bubblesVisible ? list.filter((term) => checked(term.id)).length + '/' + list.length : 'Off'}
      reveal={group.annotations.bubblesVisible && group.active.id}>
      <Select id="boundary-shape" label="Boundary" options={[[ 'hull','Enclosing hull'],['cloud','Cloud contour']]}
        value={group.annotations.boundary.shape} onChange={(shape) => group.setBoundary({ shape })} />
      <Select id="boundary-pattern" label="Outline stroke" options={patterns} value={group.annotations.boundary.pattern}
        onChange={(pattern) => group.setBoundary({ pattern })} />
      <Range id="boundary-padding" label="Boundary padding" min={0} max={60} value={group.annotations.boundary.padding}
        format={(v) => v + ' px'} onChange={(padding) => group.setBoundary({ padding })} />
      <Range id="boundary-fill" label="Boundary fill" min={0} max={40} value={Math.round(group.annotations.boundary.fillOpacity * 100)}
        format={(v) => v + '%'} onChange={(v) => group.setBoundary({ fillOpacity: v / 100 })} />
      {list.length > 0 ? <>
        <Check id="all-bubbles" label={'All groups in ' + group.active.label} checked={all} onChange={(on) => group.setVisible(on ? true : [])} />
        {list.length > 12 && <input aria-label="Filter groups" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        <div className="bubble-choices">{filtered.slice(0, 50).map((term) =>
          <div className="bubble-choice" key={term.key}><label className="check"><input type="checkbox" data-bubble-term={term.id}
            checked={checked(term.id)} onChange={(e) => toggle(term.id, e.target.checked)} />
            <i style={{ backgroundColor: group.displayStyle(term).color }} />{term.label}<small>{term.members.length}</small></label>
            {openTerm && <button type="button" aria-label={groupVerb(term) + ' group ' + term.label} onClick={() => openTerm(term)}>{groupVerb(term)}</button>}</div>
        )}</div>
        {filtered.length > 50 && <small>Filter to see the other {filtered.length - 50} groups.</small>}
      </> : <p>No matching groups in this dataset.</p>}
    </InspectorSection>
    {typeof group.active.by !== 'function' && <DefinitionEditor key={JSON.stringify(group.active)} group={group} />}
    <Language key={JSON.stringify(group.words)} group={group} />
  </section>
}
