'use client'

import { useEffect, useMemo, useState } from 'react'
import { atlasConnections } from '../../../../dist/atlas.js'
import manifest from '../../../public/examples/wikispeedia/manifest.json'
import { homeURL } from '../../../site'
import { connectionURL, topicSlug } from '../../../wiki-connections'

const archive = 'https://dlab.epfl.ch/wikispeedia/wpcd/',
  cache = new Map()
const number = (n) => n.toLocaleString('en'),
  key = (e) => e.source + ':' + e.target
const label = (id) => manifest.topics.find((t) => t.id === id)?.label
const pageSize = 5
function useEvidence(a, b) {
  const name = [a, b].sort((x, y) => x - y).join('-')
  const [result, setResult] = useState(null),
    [attempt, retry] = useState(0)
  useEffect(() => {
    if (cache.has(name)) {
      setResult({ name, data: cache.get(name) })
      return
    }
    const abort = new AbortController()
    fetch(homeURL + 'examples/wikispeedia/evidence/' + name + '.json?edition=2007-prose-v2', { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error('Evidence returned HTTP ' + r.status)
        return r.json()
      })
      .then((data) => {
        cache.set(name, data)
        setResult({ name, data })
      })
      .catch((e) => {
        if (!abort.signal.aborted) setResult({ name, error: e.message })
      })
    return () => abort.abort()
  }, [name, attempt])
  return {
    result: result?.name === name ? result : null,
    retry: () => {
      setResult(null)
      retry((n) => n + 1)
    },
  }
}
function Evidence({ row, pair, evidence, retry, onFocus }) {
  const record = evidence?.data?.links[key(row)],
    path = evidence?.data?.pages[row.source]
  const [section, fragment, anchor, context] = record ?? []
  const href =
    path &&
    archive +
      path +
      (record
        ? '#' +
          encodeURIComponent(fragment) +
          ':~:text=' +
          encodeURIComponent((context || anchor).replace(/^…|…$/g, ''))
        : '')
  return (
    <section className="wiki-evidence" aria-label="Connection details">
      <h3>
        {row.sourceTitle} <span aria-label="links to">→</span> {row.targetTitle}
      </h3>
      <p className="wiki-edge-location">
        {label(row.sourceTopic)} → {label(row.targetTopic)}
      </p>
      {record ? (
        <>
          <p>
            The source links <strong>{anchor}</strong> in{' '}
            {section === 'Introduction' ? (
              'its introduction'
            ) : (
              <>
                the section <strong>{section}</strong>
              </>
            )}
            .
          </p>
          {context && <blockquote>{context}</blockquote>}
        </>
      ) : (
        <p>
          {evidence?.error
            ? 'The source excerpt could not load.'
            : evidence
              ? 'Wikispeedia lists this link. Its original anchor could not be located in the archived page.'
              : 'Finding the original passage…'}
          {evidence?.error && <button onClick={retry}>Retry evidence</button>}
        </p>
      )}
      {href && (
        <a href={href} target="_blank" rel="noreferrer">
          Read the archived source ↗
        </a>
      )}
      <button type="button" onClick={() => onFocus(row)}>
        Show link on map
      </button>
      <a href={connectionURL(pair.map(id => topicSlug(manifest.topics[id])), key(row))}>
        Permalink to this connection
      </a>
    </section>
  )
}
export function ConnectionInspector({ atlas, snap, pair, onPair, edge, onEdge, onClose, onFocus }) {
  const [a, b] = pair
  const partners = useMemo(() => atlasConnections(manifest, a), [a])
  const counts = partners.find((p) => p.topic === b)
  const left = atlas.block(a),
    right = atlas.block(b)
  const rows = useMemo(
    () =>
      atlas
        .crossings(a, b)
        .sort((x, y) => x.sourceTitle.localeCompare(y.sourceTitle) || x.targetTitle.localeCompare(y.targetTitle)),
    [atlas, a, b, left, right],
  )
  const [initialEdge] = useState(edge)
  const [direction, setDirection] = useState('both'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(null)
  const results = useMemo(
    () =>
      rows.filter(
        (row) =>
          (direction === 'both' || row.sourceTopic === (direction === 'out' ? a : b)) &&
          (row.sourceTitle + ' ' + row.targetTitle).toLowerCase().includes(query.toLowerCase().trim()),
      ),
    [rows, direction, query, a, b],
  )
  // The bookmarked article can be on a later page in a topic block that is still loading.
  const initialIndex = page === null && initialEdge ? results.findIndex(row => key(row) === key(initialEdge)) : 0
  const pageIndex = Math.min(page ?? Math.floor(Math.max(0, initialIndex) / pageSize), Math.max(0, Math.ceil(results.length / pageSize) - 1))
  const start = pageIndex * pageSize
  const shown = useMemo(() => results.slice(start, start + pageSize), [start, results])
  const current = shown.find((row) => edge && key(edge) === key(row)) ?? shown[0]
  useEffect(() => {
    if (left && right) onEdge(current ?? null)
  }, [left, right, current, onEdge])
  const { result: evidence, retry } = useEvidence(a, b)
  return (
    <section className="wiki-connections" aria-label="Topic connections">
      <div className="atlas-subhead">
        <h2>Topic connections</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="wiki-pair">
        <label>
          From topic
          <select
            value={a}
            onChange={(e) => {
              const next = Number(e.target.value),
                partners = atlasConnections(manifest, next)
              onPair(next, partners.some((p) => p.topic === b) ? b : partners[0].topic)
            }}
          >
            {manifest.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Connected topic
          <select value={b} onChange={(e) => onPair(a, Number(e.target.value))}>
            {partners.map((p) => (
              <option key={p.topic} value={p.topic}>
                {label(p.topic)} · {number(p.total)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="wiki-pair-count">
        <strong>{number(counts?.total ?? 0)}</strong> hyperlinks between these topics
      </p>
      <label className="wiki-dir">
        Direction
        <select
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value)
            setPage(0)
          }}
        >
          <option value="both">Both directions</option>
          <option value="out">
            {label(a)} → {label(b)} ({number(counts?.outgoing ?? 0)})
          </option>
          <option value="in">
            {label(b)} → {label(a)} ({number(counts?.incoming ?? 0)})
          </option>
        </select>
      </label>
      <label className="atlas-search">
        Find an article pair
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Source or destination"
        />
      </label>
      {(!left || !right) && snap.pending.length > 0 ? (
        <p role="status">Opening both topics…</p>
      ) : (
        <div role="group" className="wiki-crossings" aria-label="Cross-topic article links">
          {shown.map((row) => (
            <button
              type="button"
              key={key(row)}
              aria-label={row.sourceTitle + ' links to ' + row.targetTitle}
              aria-pressed={current === row}
              onClick={() => onEdge(row)}
            >
              <span>{row.sourceTitle}</span>
              <i aria-hidden="true">→</i>
              <span>{row.targetTitle}</span>
            </button>
          ))}
          {!shown.length && <p>No matching links.</p>}
        </div>
      )}
      {results.length > pageSize && (
        <div className="wiki-pages">
          <button disabled={start === 0} onClick={() => setPage(pageIndex - 1)}>
            Previous
          </button>
          <span>
            {number(start + 1)}–{number(start + shown.length)} of {number(results.length)}
          </span>
          <button disabled={start + pageSize >= results.length} onClick={() => setPage(pageIndex + 1)}>
            Next
          </button>
        </div>
      )}
      {current && <Evidence row={current} pair={pair} evidence={evidence} retry={retry} onFocus={onFocus} />}
    </section>
  )
}
