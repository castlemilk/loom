'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createGraphIndex } from '../../dist/explore.js'
import { mountNotebook } from '../../docs/examples/mount-notebook'
import { docsURL, homeURL, studioURL } from '../site'
import { notebookSamples as samples, storeNotebookDraft } from './notebook-samples'
import { MetadataForm } from './record-fields'
import { NotebookConnection } from './notebook-connection'
import { PlaygroundSource } from './playground-source'
import { evaluateGraph, makeNotebookCompiler, notebookURL, showEditedRecord } from './notebook-runtime'
import './notebook.css'
import './record-fields.css'

const initial = name => ({
  graph: samples[name].graph, selected: samples[name].graph.nodes[0].id, source: samples[name].source,
  applied: samples[name].source, status: 'ready', error: '', request: null, mapVersion: 0, fitChanges: true,
})

function NotebookMap({ graph, selected, onSelect, onMove, imageBase, movable, fitChanges, onTool }) {
  const svg = useRef(null), view = useRef(null), current = useRef(graph), pick = useRef(onSelect), move = useRef(onMove)
  pick.current = onSelect
  move.current = onMove
  useLayoutEffect(() => {
    view.current = mountNotebook(svg.current, current.current, imageBase, node => pick.current(node.id), (node, point) => move.current(node.id, point))
    return () => { view.current.destroy(); view.current = null }
  }, [imageBase])
  useLayoutEffect(() => {
    if (current.current !== graph) { view.current.update(graph, fitChanges); current.current = graph }
    view.current.select(selected)
  }, [graph, selected, fitChanges])
  useLayoutEffect(() => { view.current.setMovable(movable) }, [movable])
  return <figure className="notebook-map"><svg ref={svg} role="group" aria-label="Orbital relationship graph" />
    {!graph.nodes.length && <p>Add a node to start the map.</p>}
    <figcaption><span>{graph.nodes.length} nodes · {graph.links.length} links</span>
      <div className="notebook-tools"><button type="button" disabled={!movable} onClick={() => onTool('node')}>+ Add node</button>
        <button type="button" disabled={!movable || !graph.nodes.length} onClick={() => onTool('connect')}>Connect</button>
        <button type="button" onClick={() => view.current.fit()}>Fit view</button></div></figcaption>
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

function RecordDetails({ graph, node, imageBase, onSelect, onEdit, onMetadata, onImage, editable }) {
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
      <div><Plate key={image?.src} image={image} imageBase={imageBase} node={node} onEdit={() => onEdit('art')} />
        {!!Object.keys(graph.images).length && <label className="notebook-image-key">Image<select value={node.art ?? ''} disabled={!editable} aria-label="Node image reference" onChange={e => onImage(e.target.value)}>
          <option value="">No image</option>{Object.keys(graph.images).map(key => <option value={key} key={key}>{key}</option>)}</select></label>}</div>
      <div><div className="notebook-kind">{node.kind} <code>/{node.id}</code></div>
        <h3>{node.label}</h3>
        {fields.length > 0 && <dl>{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{fieldText(value)}</dd></div>)}</dl>}
        <div className="notebook-tools"><button type="button" className="notebook-edit" disabled={!editable} onClick={onMetadata}>Edit metadata</button>
          <button type="button" className="notebook-edit" onClick={() => onEdit('label')}>Edit this node <span aria-hidden="true">↗</span></button></div>
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
  const [form, setForm] = useState(null)
  const editor = useRef(null)
  const compiler = useMemo(makeNotebookCompiler, [])
  const draftToken = useMemo(() => crypto.randomUUID(), [name])
  const imageBase = useMemo(() => new URL(homeURL + 'examples/orbit-art/', location.href), [])
  const { graph, source, applied, status, error, selected, request, fitChanges, mapVersion } = sessions[name]
  const node = graph.nodes.find(n => n.id === selected)
  const reveal = sessions[name].reveal
  useLayoutEffect(() => { showEditedRecord(editor.current, applied, reveal?.id) }, [reveal, pane, applied])
  useEffect(() => () => compiler.dispose(), [compiler])
  useEffect(() => {
    if (source === applied && !request) return
    const stop = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const { source: text, graph: next } = await evaluateGraph(compiler, source, stop.signal, { operations:request?.ops, base:imageBase, previous:graph })
        if (stop.signal.aborted) return
        setSessions(all => {
          const previous = all[name]
          if (previous.source !== source || previous.request !== request) return all
          const pick = request?.select ?? previous.selected
          const selected = next.nodes.some(n => n.id === pick) ? pick : next.nodes[0]?.id ?? null
          return { ...all, [name]: { ...previous, graph:next, source:text, applied:text, status:'ready', selected, error:'', request:null,
            fitChanges: !request?.move, reveal:request && selected ? {id:selected} : null } }
        })
        if (request) setForm(null)
      } catch (cause) {
        if (!stop.signal.aborted) setSessions(all => all[name].source === source && all[name].request === request ?
          { ...all, [name]: { ...all[name], status:request ? 'ready' : 'error', request:null, error:cause.message, mapVersion:all[name].mapVersion + Number(!!request?.move) } } : all)
      }
    }, request ? 0 : 260)
    return () => { clearTimeout(timer); stop.abort() }
  }, [name, source, applied, request, compiler, imageBase, graph])
  function visual(ops, select = selected, move = false) {
    setSessions(all => all[name].status !== 'ready' ? all : { ...all, [name]: { ...all[name], request:{ ops, select, move }, status:'syncing', error:'' } })
    setDownloadError('')
  }
  function edit(value) {
    setSessions(all => ({ ...all, [name]: { ...all[name], source:value, request:null, mapVersion:all[name].mapVersion + Number(!!all[name].request?.move),
      status:value === all[name].applied ? 'ready' : 'editing', error:'' } }))
    setForm(null)
    setDownloadError('')
  }
  function select(id) {
    setForm(null)
    setSessions(all => ({ ...all, [name]: { ...all[name], selected: id } }))
    setPane('details')
  }
  function choose(next) {
    setName(next); setPane('details'); setDownloadError(''); setForm(null)
    editor.current.scrollTo(0, 0)
  }
  function reset() {
    setSessions(all => ({ ...all, [name]: { ...initial(name), mapVersion:all[name].mapVersion + 1 } }))
    setForm(null)
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
  function openStudio(event) {
    try {
      storeNotebookDraft(draftToken, { name, source:applied, graph, selected })
    } catch { event.preventDefault(); setDownloadError('The browser could not transfer this draft. Download the project to keep your edits.') }
  }
  function openForm(tool) { setForm(tool); setPane('details') }
  return <>
    <header className="thread-heading notebook-heading"><h2>The orbital <em>atlas.</em></h2>
      <p id="notebook-hint">Drag Titan, edit its field notes, or connect a new moon. The map and its TypeScript update together.</p></header>
    <div className="thread-bench notebook-bench" data-pane={pane}>
      <div className="thread-bar"><span className="thread-bar-title">Flight notebooks</span>
        <div className="thread-presets" role="group" aria-label="TypeScript examples">
          {Object.entries(samples).map(([key, item]) => <button type="button" key={key} aria-pressed={name === key} onClick={() => choose(key)}>{item.title}</button>)}
        </div>
      </div>
      <NotebookMap key={name + mapVersion} graph={graph} selected={selected} onSelect={select} imageBase={imageBase} movable={status === 'ready'}
        onTool={openForm} fitChanges={fitChanges} onMove={(id, position) => visual([{ op:'node.update', id, changes:position }], id, true)} />
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
          <span>{error ? error + ' Showing the last valid graph.' : status === 'syncing' ? 'Writing graph edit to TypeScript…' : status === 'editing' ? 'Checking TypeScript…' : 'TypeScript ready'}</span></div>
      </div>
      {form ? <div className="notebook-record notebook-form" key={name + form + selected}>{form === 'metadata' ?
        <MetadataForm metadata={node?.metadata} disabled={status !== 'ready'} cancel={() => setForm(null)} save={metadata => visual([{ op:'node.update', id:selected, changes:{ metadata } }])} /> :
        <NotebookConnection tool={form} graph={graph} from={selected} apply={visual} close={() => setForm(null)} disabled={status !== 'ready'} />}
        {error && <p role="alert">{error}</p>}</div> :
        <RecordDetails graph={graph} node={node} imageBase={imageBase} onSelect={select} onEdit={jump} onMetadata={() => openForm('metadata')} editable={status === 'ready'}
          onImage={art => visual([{ op:'node.update', id:selected, ...(art ? {changes:{art}} : {unset:['art']}) }])} />}
      <div className="notebook-footer"><a href={docsURL + 'navigation/#model-nodes-with-metadata-and-images'}>TypeScript examples <span aria-hidden="true">↗</span></a>
        {status === 'ready' && <a href={studioURL + '?example=' + name + '&draft=' + draftToken}
          onClick={openStudio} onAuxClick={openStudio} onContextMenu={openStudio}>Continue in Studio <span aria-hidden="true">→</span></a>}
        <button type="button" disabled={downloading || status !== 'ready'} onClick={download}>{downloading ? 'Preparing project…' : 'Download project'} <span aria-hidden="true">↓</span></button>
        {downloadError && <span role="status">{downloadError}</span>}
      </div>
    </div>
  </>
}
