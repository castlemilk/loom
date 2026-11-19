'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { compileTaxonomies, parseTaxonomy } from '../../dist/taxonomy.js'
import { knowledgeConsole } from '../../dist/index.js'
import { kindOrder, marker } from './appearance'
import { Check, Select } from './fields'

const typeNames = { study: 'Study', concept: 'Concept', tag: 'Tag', blog: 'Article', lab: 'Lab', category: 'Category' }
const types = { id: 'kind', label: 'Node type', by: 'kind', terms: Object.fromEntries(kindOrder.map((kind) =>
  [kind, { label: typeNames[kind], color: knowledgeConsole.kind[kind] }])) }
const category = { id: 'category', label: 'Category', by: { relation: 'category', groupEnd: 'target' } }
const example = { id: 'family', label: 'Content family', by: 'kind',
  remap: { study: 'work', lab: 'work', blog: 'work', tag: 'subject', concept: 'subject', category: 'subject' },
  terms: { work: { label: 'Published work', color: '#63b6a0' }, subject: { label: 'Subjects', color: '#cfa35c' } } }
const storageKey = 'loom.taxonomies.v1'

const defaultWords = { singular: 'link', plural: 'links', ungrouped: 'Ungrouped' }

export function useGrouping(data, theme) {
  const [custom, setCustom] = useState([])
  const [activeId, setActive] = useState('kind')
  const [bubbles, setBubbles] = useState({})
  const [tooltips, setTooltips] = useState(true)
  const [words, setWords] = useState(defaultWords)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      if (Array.isArray(saved)) setCustom(saved.map((rule) => parseTaxonomy(JSON.stringify(rule))))
      const stored = JSON.parse(localStorage.getItem(storageKey + '.language') ?? 'null')
      if (stored && Object.keys(defaultWords).every((key) => typeof stored[key] === 'string' && stored[key].trim())) setWords(stored)
    } catch { /* An unavailable or older browser store can start with the built-in definitions. */ }
  }, [])
  const definitions = useMemo(() => {
    const rules = new Map([types, category].map((d) => [d.id, d]))
    for (const d of custom) rules.set(d.id, d)
    return [...rules.values()]
  }, [custom])
  const index = useMemo(() => compileTaxonomies(data, { taxonomies: definitions,
    language: { ungrouped: words.ungrouped, connections: (n) => n + ' ' + (n === 1 ? words.singular : words.plural) } }), [data, definitions, words])
  const active = definitions.find((rule) => rule.id === activeId) ?? types
  const groups = index.legend(active.id)
  const laneBy = useMemo(() => index.laneBy(active.id), [active.id, index])
  const laneOrder = useMemo(() => groups.map((group) => group.id), [groups])
  const kindStyles = !custom.some((rule) => rule.id === 'kind')
  const displayStyle = useCallback((term) => term.taxonomy === 'kind' && kindStyles ? marker(theme, term.id) : term, [kindStyles, theme])
  const annotations = useMemo(() => ({ bubbles, tooltips, laneTaxonomy: active.id, colorFor: (group) => displayStyle(group).color }),
    [bubbles, tooltips, active.id, displayStyle])
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
  return { definitions, custom, index, active, groups, laneBy, laneOrder, annotations, setActive, apply, remove,
    words, language, displayStyle, nativeMarkers: kindStyles && active.id === 'kind',
    setTooltips, setVisible: (visible) => setBubbles((old) => ({ ...old, [active.id]: visible })) }
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

export function Grouping({ group }) {
  const [filter, setFilter] = useState('')
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
  return <section className="grouping"><h2>Taxonomies</h2>
    <Select id="taxonomy" label="Group by" options={group.definitions.map((d) => [d.id, d.label])}
      value={group.active.id} onChange={(id) => { setFilter(''); group.setActive(id) }} />
    <Check id="tooltips" label="Node tooltips" checked={group.annotations.tooltips} onChange={group.setTooltips} />
    <details><summary>Group bubbles</summary>
      {list.length > 0 ? <>
        <Check id="all-bubbles" label={'All groups in ' + group.active.label} checked={all} onChange={(on) => group.setVisible(on ? true : [])} />
        {list.length > 12 && <input aria-label="Filter groups" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} />}
        <div className="bubble-choices">{filtered.slice(0, 50).map((term) =>
          <label className="check" key={term.key}><input type="checkbox" data-bubble-term={term.id}
            checked={checked(term.id)} onChange={(e) => toggle(term.id, e.target.checked)} />
            <i style={{ backgroundColor: group.displayStyle(term).color }} />{term.label}<small>{term.members.length}</small></label>
        )}</div>
        {filtered.length > 50 && <small>Filter to see the other {filtered.length - 50} groups.</small>}
      </> : <p>No matching groups in this dataset.</p>}
    </details>
    <DefinitionEditor key={JSON.stringify(group.active)} group={group} />
    <Language key={JSON.stringify(group.words)} group={group} />
  </section>
}
