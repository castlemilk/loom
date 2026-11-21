'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createGraphIndex } from '../../dist/explore.js'
import { graph as saturn } from '../../docs/examples/saturn'
import { graph as cassini } from '../../docs/examples/cassini'
import { mountNotebook } from '../../docs/examples/mount-notebook'
import sources from '../.generated/notebook-sources.json'
import { docsURL, homeURL } from '../site'
import { PlaygroundSource } from './playground-source'
import { runPlayground } from './run-thread-pattern'
import { makeNotebookCompiler, notebookURL, readNotebook } from './notebook-runtime'
import './notebook.css'

const samples = { saturn: { title: 'Saturn system', graph: saturn }, cassini: { title: 'Cassini flybys', graph: cassini } }
const initial = name => ({
  graph: samples[name].graph, selected: samples[name].graph.nodes[0].id, source: sources[name + '.ts'],
  applied: sources[name + '.ts'], status: 'ready', error: '',
})

function NotebookMap({ graph, selected, onSelect, imageBase }) {
  const svg = useRef(null), view = useRef(null), current = useRef(graph), pick = useRef(onSelect)
  pick.current = onSelect
  useLayoutEffect(() => {
    view.current = mountNotebook(svg.current, current.current, imageBase, node => pick.current(node.id))
    return () => { view.current.destroy(); view.current = null }
  }, [imageBase])
  useLayoutEffect(() => {
    if (current.current !== graph) { view.current.update(graph); current.current = graph }
    view.current.select(selected)
  }, [graph, selected])
  return <figure className="notebook-map"><svg ref={svg} role="group" aria-label="Orbital relationship graph" />
    {!graph.nodes.length && <p>Add a node to start the map.</p>}
    <figcaption><span>{graph.nodes.length} nodes · {graph.links.length} links</span>
      <button type="button" onClick={() => view.current.fit()}>Fit view</button></figcaption>
  </figure>
}

function Plate({ image, imageBase, node, onEdit }) {
  const [failed, setFailed] = useState(false)
  return <figure className="notebook-photo">
    {image && !failed ? <img src={notebookURL(image.src, imageBase)} alt={image.alt} width="180" height="142"
      onError={() => setFailed(true)} /> : <div className="notebook-no-photo">{image ? 'Image unavailable' : 'No image attached'}</div>}
    {image && <figcaption>{image.sourceURL ? <a href={image.sourceURL}>{image.credit || 'Image source'} <span aria-hidden="true">↗</span></a> : image.credit}
      <button type="button" onClick={onEdit} aria-label={'Edit image key ' + node.art}>art → {node.art}</button></figcaption>}
  </figure>
}

function fieldText(value) {
  if (Array.isArray(value) && value.every(item => item === null || typeof item !== 'object')) return value.map(String).join(', ')
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function RecordDetails({ graph, node, imageBase, onSelect, onEdit }) {
  const index = useMemo(() => createGraphIndex(graph), [graph])
  if (!node) return <div className="notebook-record">Select a node to inspect its record.</div>
  const fields = Object.entries(node.metadata ?? {})
  const image = node.art && graph.images[node.art]
  const incoming = index.neighbors(node.id, 'incoming')
  const outgoing = index.neighbors(node.id, 'outgoing')
  const links = [...incoming.flatMap(other => other.links.map(link => ({ other: other.node, link }))),
    ...outgoing.flatMap(other => other.links.filter(link => link.target !== node.id).map(link => ({ other: other.node, link })))]
  return <article className="notebook-record" aria-label="Selected node">
    <div className="notebook-entry">
      <Plate key={image?.src} image={image} imageBase={imageBase} node={node} onEdit={() => onEdit('art')} />
      <div><div className="notebook-kind">{node.kind} <code>/{node.id}</code></div>
        <h3>{node.label}</h3>
        {fields.length > 0 && <dl>{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{fieldText(value)}</dd></div>)}</dl>}
        <button type="button" className="notebook-edit" onClick={() => onEdit('label')}>Edit this node <span aria-hidden="true">↗</span></button>
      </div>
    </div>
    <details className="notebook-edges" key={node.id}>
      <summary>{links.length} {links.length === 1 ? 'relationship' : 'relationships'}</summary>
      {links.length ? <ul>{links.map(({ link, other }, i) => <li key={i}>
        <span>{link.source === node.id ? node.label : other.label} <em>{link.kind}</em> {link.target === node.id ? node.label : other.label}</span>
        {link.note && <p>{link.note}</p>}
        <div><button type="button" onClick={() => onSelect(other.id)}>Follow {other.label} <span aria-hidden="true">→</span></button>
          {link.sourceURL && <a href={link.sourceURL}>Source <span aria-hidden="true">↗</span></a>}</div>
      </li>)}</ul> : <p>This node has no connections yet.</p>}
    </details>
  </article>
}

export default function NotebookPlayground() {
  const [name, setName] = useState('saturn')
  const [sessions, setSessions] = useState(() => ({ saturn: initial('saturn'), cassini: initial('cassini') }))
  const [pane, setPane] = useState('details'), [downloading, setDownloading] = useState(false), [downloadError, setDownloadError] = useState('')
  const editor = useRef(null)
  const compiler = useMemo(makeNotebookCompiler, [])
  const imageBase = useMemo(() => new URL(homeURL + 'examples/orbit-art/', location.href), [])
  const { graph, source, applied, status, error, selected } = sessions[name]
  const node = graph.nodes.find(n => n.id === selected)
  useEffect(() => () => compiler.dispose(), [compiler])
  useEffect(() => {
    if (source === applied) return
    const stop = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const js = await compiler.compile(source, stop.signal)
        const next = readNotebook(await runPlayground({ source: js, entry: 'graph' }, stop.signal), imageBase)
        if (stop.signal.aborted) return
        setSessions(all => {
          const previous = all[name]
          if (previous.source !== source) return all
          const selected = next.nodes.some(n => n.id === previous.selected) ? previous.selected : next.nodes[0]?.id ?? null
          return { ...all, [name]: { ...previous, graph: next, applied: source, status: 'ready', selected, error: '' } }
        })
      } catch (cause) {
        if (!stop.signal.aborted) setSessions(all => all[name].source === source ?
          { ...all, [name]: { ...all[name], status: 'error', error: cause.message } } : all)
      }
    }, 260)
    return () => { clearTimeout(timer); stop.abort() }
  }, [name, source, applied, compiler, imageBase])
  function edit(value) {
    setSessions(all => ({ ...all, [name]: { ...all[name], source: value, status: value === all[name].applied ? 'ready' : 'editing', error: '' } }))
    setDownloadError('')
  }
  function select(id) {
    setSessions(all => ({ ...all, [name]: { ...all[name], selected: id } }))
    setPane('details')
  }
  function choose(next) {
    setName(next); setPane('details'); setDownloadError('')
    editor.current.scrollTo(0, 0)
  }
  function reset() {
    setSessions(all => ({ ...all, [name]: initial(name) }))
    editor.current.scrollTo(0, 0)
    setDownloadError('')
  }
  function jump(part) {
    setPane('code')
    const id = node?.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const nodeField = part === 'label' || part === 'art'
    const hit = nodeField ? new RegExp('\\bid\\s*:\\s*([\'"])' + id + '\\1').exec(source) : new RegExp('\\b' + part + '\\s*:').exec(source)
    let from = hit?.index ?? 0, length = hit?.[0].length ?? 0
    if (nodeField && hit) {
      const afterId = from + length
      const record = source.slice(afterId).split(/\bid\s*:/, 1)[0]
      const field = new RegExp('\\b' + part + '\\s*:\\s*').exec(record)
      const offset = field && field.index + field[0].length
      const literal = field && /^(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/.exec(record.slice(offset))
      if (literal) {
        from = afterId + offset + 1
        length = (literal[1] ?? literal[2]).length
      }
    }
    requestAnimationFrame(() => {
      const el = editor.current
      if (!el) return
      el.focus()
      el.setSelectionRange(from, from + length)
      el.scrollTop = Math.max(0, (source.slice(0, from).split('\n').length - 2) * parseFloat(getComputedStyle(el).lineHeight))
    })
  }
  async function download() {
    setDownloading(true); setDownloadError('')
    try {
      const { downloadNotebook } = await import('./notebook-export')
      await downloadNotebook(name, source, imageBase)
    } catch (cause) { setDownloadError(cause.message) }
    finally { setDownloading(false) }
  }
  return <>
    <header className="thread-heading notebook-heading"><h2>The orbital <em>atlas.</em></h2>
      <p id="notebook-hint">Select a card to see its image and field notes. Edit the TypeScript to change the record or draw a new connection.</p></header>
    <div className="thread-bench notebook-bench" data-pane={pane}>
      <div className="thread-bar"><span className="thread-bar-title">Flight notebooks</span>
        <div className="thread-presets" role="group" aria-label="TypeScript examples">
          {Object.entries(samples).map(([key, item]) => <button type="button" key={key} aria-pressed={name === key} onClick={() => choose(key)}>{item.title}</button>)}
        </div>
      </div>
      <NotebookMap key={name} graph={graph} selected={selected} onSelect={select} imageBase={imageBase} />
      <div className="notebook-panes" role="group" aria-label="Notebook panel">
        <button type="button" aria-pressed={pane === 'details'} onClick={() => setPane('details')}>Node details</button>
        <button type="button" aria-pressed={pane === 'code'} onClick={() => setPane('code')}>Edit TypeScript</button>
      </div>
      <div className="thread-editor"><div className="thread-file"><label htmlFor="notebook-source">{name}.ts</label>
        <button type="button" onClick={reset}>Reset</button></div>
        <div className="notebook-jumps" role="group" aria-label="Find code in the editor">
          {['nodes', 'links', 'images'].map(part => <button type="button" key={part} onClick={() => jump(part)}>{part}</button>)}
        </div>
        <PlaygroundSource inputRef={editor} id="notebook-source" source={source} edit={edit} label="Edit notebook TypeScript"
          describedBy="notebook-hint notebook-status" invalid={status === 'error'} />
        <div className="thread-status" id="notebook-status" role="status" data-state={status}><i aria-hidden="true" />
          <span>{error ? error + ' Showing the last valid graph.' : status === 'editing' ? 'Checking TypeScript…' : 'TypeScript ready'}</span></div>
      </div>
      <RecordDetails graph={graph} node={node} imageBase={imageBase} onSelect={select} onEdit={jump} />
      <div className="notebook-footer"><a href={docsURL + 'navigation/#model-nodes-with-metadata-and-images'}>TypeScript examples <span aria-hidden="true">↗</span></a>
        <button type="button" disabled={downloading || status !== 'ready'} onClick={download}>{downloading ? 'Preparing project…' : 'Download project'} <span aria-hidden="true">↓</span></button>
        {downloadError && <span role="status">{downloadError}</span>}
      </div>
    </div>
  </>
}
