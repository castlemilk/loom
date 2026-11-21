'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { CopyButton } from '../docs/copy-button'
import { artURL, docsURL, mcpURL } from '../site'
import sdk from '../.generated/sdk-package.json'
import examples from '../.generated/notebook-sources.json'
import { downloadFile } from './download-file'
import { fileStem, mountCode, projectCommands, projectZip } from './export-project.mjs'
import './graph-export.css'

const count = (data) => [ ['node', data.nodes.length], ['link', data.links.length] ]
  .map(([label, n]) => n.toLocaleString('en') + ' ' + label + (n === 1 ? '' : 's')).join(' · ')

function Dialog({ title, close, children, compact }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const element = ref.current
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={ref} className={'document-dialog' + (compact ? ' compact' : '')} aria-labelledby="document-dialog-title"
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="document-dialog-bar">
      <h2 id="document-dialog-title">{title}</h2>
      <button type="button" onClick={close} aria-label={'Close ' + title.toLowerCase()}><svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
        <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
    </div>
    {children}
  </dialog>
}

export function NewGraphDialog({ create, close }) {
  const [name, setName] = useState('')
  return <Dialog title="New graph" compact close={close}>
    <form onSubmit={event => { event.preventDefault(); create(name.trim()) }}>
      <label className="project-label">Graph name<input autoFocus required maxLength={120} value={name}
        onChange={event => setName(event.target.value)} placeholder="e.g. Studio signal path" /></label>
      <button className="export-primary" disabled={!name.trim()}>Create graph</button>
    </form>
  </Dialog>
}

function Code({ name, children }) {
  return <figure className="export-code"><figcaption><span>{name}</span><CopyButton name={name} /></figcaption>
    <pre tabIndex={0}><code>{children}</code></pre></figure>
}

export function ExportDialog({ snapshot, close }) {
  const { scene, full, name } = snapshot
  const [projectName, setProjectName] = useState(name)
  const [tab, setTab] = useState('project'), [language, setLanguage] = useState('ts')
  const [keepView, setKeepView] = useState(!!scene.positions)
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const moduleFile = 'graph.' + language
  const inDetail = full.nodes.length !== scene.data.nodes.length || full.links.length !== scene.data.links.length
  function chosenScene() {
    if (keepView) return scene
    const { positions, viewport, ...rest } = scene
    return rest
  }
  async function saveProject() {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const title = projectName.trim()
      const bytes = await projectZip({ name:title, scene:chosenScene(), language, dependency:sdk.dependency,
        dataModule:snapshot.module, dataTypes:examples['notebook-types.ts'] })
      downloadFile(fileStem(title) + '.zip', bytes, 'application/zip')
      setNotice('Project downloaded. Unzip it and run the commands above.')
    } catch (error) { setNotice('Could not create the project. ' + error.message) }
    finally { setBusy(false) }
  }
  function saveScene() {
    downloadFile('scene.json', JSON.stringify(chosenScene(), null, 2) + '\n', 'application/json')
    setNotice(tab === 'mcp' ? 'Scene downloaded. Enter its full path in the client setup.' : 'Scene downloaded. Place it beside ' + moduleFile + '.')
  }
  return <Dialog title="Export graph" close={close}>
    <div className="export-summary">
      {tab === 'project' ? <label className="export-name">Project name<input value={projectName} maxLength={120}
        onChange={event => { setProjectName(event.target.value); setNotice('') }}/></label> : <strong>{name}</strong>}
      <span>{count(scene.data)} · {scene.mode}</span>
    </div>
    {inDetail && <p className="export-scope">This scene contains the open view. Return to the overview to export the whole canvas.</p>}
    <div className="export-tabs" role="group" aria-label="Export destination">
      {[['project','Starter project'], ['app','Existing app'], ['mcp','Graph MCP']].map(([id, label]) => <button type="button" key={id} aria-pressed={id === tab}
        onClick={() => { setTab(id); setNotice('') }}>{id === 'mcp' && <img src={artURL('graph-mcp.png')} width="17" height="17" alt="" />}{label}</button>)}
    </div>
    {tab !== 'mcp' && <div className="export-options">
      <label>Language <select value={language} onChange={event => { setLanguage(event.target.value); setNotice('') }}>
        <option value="ts">TypeScript</option><option value="js">JavaScript</option></select></label>
      {!!scene.positions && <label><input type="checkbox" checked={keepView} onChange={event => { setKeepView(event.target.checked); setNotice('') }}/>
        Keep positions and camera</label>}
    </div>}
    {tab === 'project' ? <>
      <ul className="export-files">
        {language === 'ts' && <li><code>data.ts</code><span>Your live TypeScript graph</span></li>}
        {[[moduleFile, 'Mounts the graph on a canvas'], ['scene.json', 'Graph, layout and styling'], ['index.html', 'A page to run and build']].map(([file, label]) =>
          <li key={file}><code>{file}</code><span>{label}</span></li>)}
      </ul>
      <Code name="Run the project">{projectCommands}</Code>
      <button type="button" className="export-primary" disabled={busy || !projectName.trim()} onClick={saveProject}>{busy ? 'Preparing ZIP…' : 'Download project ZIP'}</button>
    </> : tab === 'mcp' ? <div className="export-mcp">
      <p className="export-instruction">Download this graph, then give its file path to Graph MCP. Your assistant can search the nodes and trace their connections locally.</p>
      <button type="button" className="export-primary" onClick={saveScene}>Download scene.json</button>
      <a href={mcpURL + '?source=studio#connect'} target="_blank" rel="noreferrer">Open MCP client setup ↗</a>
    </div> : <>
      <p className="export-instruction">Install Loom, then save this module beside <code>scene.json</code>{language === 'ts' && <>, <code>data.ts</code> and <code>notebook-types.ts</code></>}. Call <code>await mountGraph(canvas)</code> on a sized canvas.</p>
      <Code name="Install Loom">{'npm install ' + sdk.installSpec}</Code>
      <Code key={moduleFile} name={moduleFile}>{mountCode(language)}</Code>
      <button type="button" className="export-primary" onClick={saveScene}>Download scene.json</button>
    </>}
    <output className="export-notice" aria-live="polite">{notice}</output>
    {snapshot.module && <div className="export-foot"><button type="button" onClick={() => downloadFile('data.ts', snapshot.module, 'text/plain')}>Download data.ts</button>
      <button type="button" onClick={() => downloadFile('notebook-types.ts', examples['notebook-types.ts'], 'text/plain')}>Download graph types</button></div>}
    <div className="export-foot"><button type="button" onClick={() => {
      downloadFile(fileStem(name) + '.json', JSON.stringify(full, null, 2) + '\n', 'application/json')
      setNotice('Full graph data downloaded.')
    }}>Download full graph data{inDetail ? ' (' + count(full) + ')' : ''}</button>
      <a href={docsURL + 'editing/#export-a-graph-to-your-app'} target="_blank" rel="noreferrer">SDK guide ↗</a></div>
  </Dialog>
}
