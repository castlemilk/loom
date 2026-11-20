'use client'

import { useEffect, useState } from 'react'
import { CopyButton } from '../../docs/copy-button'

const shellArgument = value => /^[\w./:=@-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'"

export function McpConnect({ archiveURL, downloadURL }) {
  const [local, setLocal] = useState(false), [path, setPath] = useState('')
  useEffect(() => {
    if (new URLSearchParams(location.search).get('source') === 'studio') setLocal(true)
  }, [])
  const file = path.trim()
  const absolute = file.startsWith('/') || /^[a-z]:[\\/]/i.test(file) || file.startsWith('\\\\')
  const args = ['--yes', '--package=' + archiveURL, 'loom-graph-mcp']
  if (local) args.push('--graph', file)
  const config = { mcpServers: { loom: { command: 'npx', args } } }
  return <div className="mcp-connect">
    <fieldset><legend>Graph source</legend>
      <label><input type="radio" name="mcp-source" checked={!local} onChange={() => setLocal(false)} />Bundled graphs</label>
      <label><input type="radio" name="mcp-source" checked={local} onChange={() => setLocal(true)} />My Studio export</label>
    </fieldset>
    {local && <label className="graph-file-label" htmlFor="graph-file">Path on your computer
      <input id="graph-file" placeholder="/absolute/path/to/scene.json" value={path} spellCheck={false}
        aria-describedby={!absolute ? 'mcp-path-hint' : undefined} onChange={event => setPath(event.target.value)} /></label>}
    {local && !absolute ? <p className="config-hint" id="mcp-path-hint">Enter the full path to your exported graph to generate its configuration.</p> : <>
      <figure className="mcp-config"><figcaption>Client configuration <CopyButton name="MCP configuration" /></figcaption>
        <pre tabIndex={0}><code>{JSON.stringify(config, null, 2)}</code></pre></figure>
      <details className="codex-setup"><summary>Using the Codex CLI</summary>
        <figure className="mcp-config"><figcaption>macOS or Linux <CopyButton name="Codex command" /></figcaption>
          <pre tabIndex={0}><code>{'codex mcp add loom -- npx ' + args.map(shellArgument).join(' ')}</code></pre>
        </figure></details></>}
    <a className="guide-text-link" href={downloadURL} download>Download the server package <span aria-hidden="true">↓</span></a>
  </div>
}
