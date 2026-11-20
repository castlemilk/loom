'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createAtlas, createFullAtlasReader } from '../../../../dist/atlas.js'
import { createSQLiteAtlasReader } from '../../../../dist/atlas-sqlite.js'
import { mountAtlasMap } from '../../../../dist/atlas-map.js'
import { cardNeighborhood } from '../../../../dist/cards.js'
import manifest from '../../../public/examples/wikispeedia/manifest.json'
import { AtlasShell, ModeSwitch } from '../../atlas-shell'
import { CardView } from '../../card-view'
import { homeURL, studioURL } from '../../../site'

const base = homeURL + 'examples/wikispeedia/',
  runtime = homeURL + 'atlas-runtime/0.8.12/'
const fmt = new Intl.NumberFormat('en'),
  number = (n) => fmt.format(n)
const bytes = (n) =>
  n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KiB' : (n / 1048576).toFixed(2) + ' MiB'
const slug = (t) =>
  t.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '')
const articleUrl = (title) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replaceAll(' ', '_'))
const theme = {
  bg: '#f7f7f0',
  bezel: '#f7f7f0',
  ink: '#28382f',
  dim: '#7c8c80',
  accent: '#af553f',
  font: 'Georgia,serif',
  fontSize: 12,
  plateAlpha: 0.9,
  kind: { topic: '#678575', article: '#678575' },
  radii: { hub: 10, content: 2 },
  nodes: {
    fill: 0.88,
    artwork: false,
    resolve: (n) => ({
      radius:
        n.kind === 'topic'
          ? 6 + Math.log2(manifest.topics[n.topic].count) * 0.65
          : 1.25 + Math.min(1.8, Math.log2(1 + n.degree) * 0.15),
      shape: 'circle',
    }),
  },
  labels: { visibility: 'none' },
  wires: {
    routing: 'straight',
    color: '#708d80',
    width: 0.9,
    opacity: 0.18,
    byKind: { overview: { color: '#83958c', width: 1.1, opacity: 0.42 }, hyperlink: { width: 0.65, opacity: 0.16 } },
  },
}

function updateURL(mode, opened) {
  const url = new URL(location.href)
  if (mode === 'full') url.searchParams.set('loading', 'full')
  else url.searchParams.delete('loading')
  if (opened.length) url.searchParams.set('topic', opened.map((id) => slug(manifest.topics[id])).join(','))
  else url.searchParams.delete('topic')
  history.replaceState(history.state, '', url)
}

export default function Wikispeedia() {
  const [atlas, setAtlas] = useState(null)
  useEffect(() => {
    const p = new URLSearchParams(location.search),
      mode = p.get('loading') === 'full' ? 'full' : 'on-demand'
    const controller = createAtlas(
      manifest,
      {
        'on-demand': () =>
          createSQLiteAtlasReader({
            database: base + manifest.database,
            databaseBytes: manifest.databaseBytes,
            worker: runtime + 'sqlite.worker.js',
            wasm: runtime + 'sql-wasm.wasm',
            pageSize: manifest.pageSize,
          }),
        full: () => createFullAtlasReader(base + manifest.full),
      },
      mode,
    )
    const requested = (p.get('topic') ?? '').split(',')
    void controller.setExpanded(manifest.topics.filter((t) => requested.includes(slug(t))).map((t) => t.id))
    setAtlas(controller)
    return () => controller.close()
  }, [])
  return (
    <AtlasShell name="wikispeedia/">
      {atlas ? (
        <Explorer atlas={atlas} />
      ) : (
        <main className="atlas-start">
          <h1>Wikispeedia</h1>
          <p>Opening the topic map…</p>
        </main>
      )}
    </AtlasShell>
  )
}

function TopicMap({ atlas, snap, api, onPick, keep, selected, hidden }) {
  const canvas = useRef(null),
    labels = useRef(new Map()),
    pick = useRef(onPick),
    [error, setError] = useState('')
  pick.current = onPick
  useLayoutEffect(() => {
    try {
      const map = mountAtlasMap(canvas.current, atlas, {
        theme,
        keepView: keep,
        onPick: (n) => pick.current(n),
        onFrame: (frame) => {
          for (const [i, t] of manifest.topics.entries()) {
            const label = labels.current.get(t.id)
            if (!label) continue
            const x = frame.points[i * 4],
              y = frame.points[i * 4 + 1],
              r = frame.points[i * 4 + 2]
            const margin = frame.width < 550 ? 42 : 67
            label.style.left = Math.min(frame.width - margin, Math.max(margin, x)) + 'px'
            label.style.top = y + r + 3 + 'px'
            label.hidden = x < 0 || y < 0 || x > frame.width || y > frame.height
          }
        },
      })
      api.current = map
      return () => {
        map.destroy()
        api.current = null
      }
    } catch (cause) {
      setError(cause.message)
    }
  }, [atlas, api])
  useEffect(() => {
    api.current?.setKeepView(keep)
  }, [keep, api])
  useEffect(() => {
    api.current?.select(selected)
  }, [selected, snap.scene, api])
  return (
    <div className="atlas-map-surface" style={{ visibility: hidden ? 'hidden' : undefined }} aria-hidden={hidden}>
      <canvas ref={canvas} aria-label="Wikipedia topic map. Pan with arrow keys and zoom with plus or minus." />
      {error ? (
        <p className="atlas-graph-error" role="alert">
          {error} Use the topics list to explore.
        </p>
      ) : (
        manifest.topics.map((t) => {
          const opened = snap.expanded.includes(t.id)
          return (
            <button
              type="button"
              key={t.id}
              ref={(el) => {
                if (el) labels.current.set(t.id, el)
                else labels.current.delete(t.id)
              }}
              className="atlas-map-label"
              data-map-topic={t.id}
              aria-pressed={opened}
              aria-label={(opened ? 'Close ' : 'Open ') + t.label + ' on map'}
              onClick={() => onPick({ kind: 'topic', topic: t.id })}
            >
              <span>{t.label}</span>
              <small>
                {number(t.count)} <b aria-hidden="true">{opened ? '−' : '+'}</b>
              </small>
            </button>
          )
        })
      )}
    </div>
  )
}

function neighborhood(scene, article) {
  if (!article) return null
  const group = cardNeighborhood(scene, article.id)
  return { nodes: group.nodes, links: group.links.map((edge) => ({ ...edge, label: 'Links to' })) }
}

function Explorer({ atlas }) {
  const snap = useSyncExternalStore(atlas.subscribe, atlas.getSnapshot, atlas.getSnapshot)
  const api = useRef(null)
  const [keep, setKeep] = useState(true),
    [active, setActive] = useState(() => snap.expanded.at(-1) ?? null)
  const [selection, setSelection] = useState(null),
    [query, setQuery] = useState(''),
    [cardMode, setCardMode] = useState(false),
    [cardSelected, setCardSelected] = useState(null)
  const activeTopic = manifest.topics[active],
    block = atlas.block(active)
  const article = useMemo(
    () => (selection === null ? null : snap.scene.nodes.find((n) => n.id === selection)),
    [selection, snap.scene],
  )
  const cards = useMemo(() => (cardMode ? neighborhood(snap.scene, article) : null), [cardMode, snap.scene, article])
  const cardNode = cards?.nodes.find((n) => n.id === cardSelected)
  const ranked = useMemo(
    () => [...(block?.articles ?? [])].sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1])),
    [block],
  )
  const matches = useMemo(
    () => ranked.filter((n) => n[1].toLowerCase().includes(query.trim().toLowerCase())),
    [ranked, query],
  )
  const openGroup = (id) => {
    const closing = snap.expanded.includes(id)
    setActive(closing ? (snap.expanded.filter((n) => n !== id).at(-1) ?? null) : id)
    setSelection(null)
    setQuery('')
    setCardMode(false)
    void atlas.toggle(id)
    updateURL(snap.mode, atlas.getSnapshot().expanded)
  }
  function selectArticle(node) {
    setActive(node.topic)
    setSelection(node.id)
    setCardMode(false)
    setCardSelected(null)
  }
  function expandAll(on) {
    const ids = on ? manifest.topics.map((t) => t.id) : []
    setActive(on ? (active ?? 0) : null)
    setQuery('')
    setSelection(null)
    setCardMode(false)
    void atlas.setExpanded(ids)
    updateURL(snap.mode, ids)
  }
  const loaded = snap.loaded.reduce((sum, id) => sum + manifest.topics[id].count, 0),
    visible = snap.scene.nodes.length - manifest.topics.length
  const links = useMemo(
    () => snap.scene.links.reduce((sum, e) => sum + Number(e.kind === 'hyperlink'), 0),
    [snap.scene],
  )
  return (
    <main className="atlas-workarea">
      <section className="atlas-board">
        <div className="atlas-board-title">
          <div>
            <h1>{cards ? 'Around ' + article.label : 'Wikispeedia'}</h1>
            <p>
              {cards
                ? cards.nodes.length + ' visible articles · ' + cards.links.length + ' relationships'
                : number(manifest.articles) + ' Wikipedia articles · ' + number(manifest.links) + ' hyperlinks'}
            </p>
          </div>
          {cards && <button onClick={() => setCardMode(false)}>← Topic map</button>}
        </div>
        <div className="atlas-viewport">
          <TopicMap
            atlas={atlas}
            snap={snap}
            api={api}
            keep={keep}
            selected={article?.id ?? null}
            hidden={!!cards}
            onPick={(n) => (n.kind === 'topic' ? openGroup(n.topic) : selectArticle(n))}
          />
          {cards && (
            <CardView
              data={cards}
              root={article.id}
              selected={cardSelected ?? article.id}
              onSelect={(n) => setCardSelected(n.id)}
              useNodePositions={false}
              arrows
            />
          )}
        </div>
        <div className="atlas-status">
          <span data-visible-articles={visible}>{number(visible)} articles on map</span>
          <div className="atlas-map-tools" style={{ visibility: cards ? 'hidden' : 'visible' }}>
            <button aria-label="Zoom out" onClick={() => api.current?.zoom(0.8)}>
              −
            </button>
            <button aria-label="Zoom in" onClick={() => api.current?.zoom(1.25)}>
              +
            </button>
            <button onClick={() => api.current?.fit()}>Fit view</button>
          </div>
          <span data-visible-links={links}>{number(links)} article links</span>
        </div>
      </section>
      <aside className="atlas-side" aria-label="Wikipedia atlas controls">
        <ModeSwitch
          label="Graph loading"
          value={snap.mode}
          choices={[
            ['on-demand', 'On demand'],
            ['full', 'All at once'],
          ]}
          onChange={(mode) => {
            void atlas.setLoading(mode)
            updateURL(mode, snap.expanded)
          }}
        />
        <p className="atlas-help">
          {snap.mode === 'on-demand'
            ? 'Open a topic to read its SQLite pages. The first visit also loads a 1.26 MiB worker and runtime.'
            : 'The complete graph loads as one JSON file.'}
        </p>
        <dl className="atlas-metrics">
          <div>
            <dt>Graph data read</dt>
            <dd data-read-bytes={snap.reads.bytes}>{bytes(snap.reads.bytes)}</dd>
          </div>
          <div>
            <dt>Data requests</dt>
            <dd data-read-requests={snap.reads.requests}>{number(snap.reads.requests)}</dd>
          </div>
          <div>
            <dt>Articles loaded</dt>
            <dd data-loaded={loaded}>
              {number(loaded)} / {number(manifest.articles)}
            </dd>
          </div>
        </dl>
        <p className="atlas-load-state" role="status">
          {snap.pending.length
            ? snap.mode === 'full'
              ? 'Loading full graph…'
              : 'Reading topic pages…'
            : snap.error
              ? 'Could not load graph data'
              : snap.mode === 'full'
                ? 'Full graph ready'
                : snap.loaded.length
                  ? 'Opened topics are cached'
                  : 'Overview ready'}
        </p>
        {snap.error && (
          <div role="alert" className="atlas-graph-error">
            {snap.error} <button onClick={() => atlas.retry()}>Retry</button>
          </div>
        )}
        <label className="atlas-check">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep camera in place
        </label>
        {activeTopic && snap.expanded.includes(active) && (
          <section className="atlas-topic-detail">
            <div className="atlas-subhead">
              <h2>{activeTopic.label}</h2>
              <button onClick={() => api.current?.focus('topic:' + active)}>Focus</button>
            </div>
            {block && (
              <>
                <label className="atlas-search">
                  Find in {activeTopic.label}
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Article title"
                  />
                </label>
                <div className="atlas-results" role="group" aria-label="Articles in topic">
                  {matches.slice(0, 12).map(([id, title]) => (
                    <button
                      type="button"
                      key={id}
                      data-article-id={id}
                      aria-pressed={article?.article === id}
                      onClick={() => selectArticle({ id: 'article:' + id, topic: active })}
                    >
                      {title}
                    </button>
                  ))}
                  {!matches.length && <p>No matching articles.</p>}
                </div>
              </>
            )}
            {article && (
              <div className="atlas-article">
                <h3>{cardNode?.label ?? article.label}</h3>
                <a href={articleUrl(cardNode?.label ?? article.label)} target="_blank" rel="noreferrer">
                  Read on Wikipedia ↗
                </a>
                {cards && cardNode && cardNode.id !== article.id && (
                  <button
                    onClick={() => {
                      const next = snap.scene.nodes.find((n) => n.id === cardNode.id)
                      if (next) {
                        setSelection(next.id)
                        setActive(next.topic)
                        setCardSelected(null)
                        setQuery('')
                      }
                    }}
                  >
                    Explore this article
                  </button>
                )}
                <button
                  onClick={() => {
                    setCardSelected(null)
                    setCardMode((v) => !v)
                  }}
                >
                  {cards ? 'Return to topic map' : 'View article cards'}
                </button>
              </div>
            )}
          </section>
        )}
        <section className="atlas-directory-large">
          <div className="atlas-subhead">
            <h2>Topics</h2>
            <span>
              {snap.expanded.length} / {manifest.topics.length} open
            </span>
          </div>
          <div className="atlas-topic-actions">
            <button onClick={() => expandAll(true)} disabled={snap.expanded.length === manifest.topics.length}>
              Expand all
            </button>
            <button onClick={() => expandAll(false)} disabled={!snap.expanded.length}>
              Collapse all
            </button>
          </div>
          <ul>
            {manifest.topics.map((t) => {
              const on = snap.expanded.includes(t.id)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={(on ? 'Collapse ' : 'Expand ') + t.label}
                    onClick={() => openGroup(t.id)}
                  >
                    <i style={{ background: t.color }} />
                    <span>{t.label}</span>
                    <small>{number(t.count)}</small>
                    <b aria-hidden="true">{on ? '−' : '+'}</b>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
        <details className="atlas-provenance">
          <summary>About this graph</summary>
          <p>
            The Wikispeedia project recorded these hyperlinks in a historical Wikipedia selection. Each article uses its
            first listed subject. Six have no subject.
          </p>
          <p>
            West &amp; Leskovec (2012), West, Pineau &amp; Precup (2009).{' '}
            <a href={manifest.source} target="_blank" rel="noreferrer">
              Dataset and papers ↗
            </a>
          </p>
          <p>
            Data read counts uncompressed graph payloads per mode. The overview, file-size check and SQLite runtime are
            separate.
          </p>
        </details>
        <a className="atlas-text-link" href={studioURL + 'cards/'}>
          Around Canva · card example →
        </a>
      </aside>
    </main>
  )
}
