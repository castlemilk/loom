'use client'

import { useEffect, useState } from 'react'
import { CopyButton } from '../../docs/copy-button'
import { GraphCheck } from './graph-check'

const shellArgument = value => /^[\w./:=@-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'"

function Snippet({ title, children }) {
  return <figure className="mcp-config"><figcaption>{title}<CopyButton name={title} /></figcaption>
    <pre tabIndex={0}><code>{children}</code></pre></figure>
}

const localEndpoint = 'http://127.0.0.1:7341/mcp'
const localIssuer = 'http://127.0.0.1:8180/realms/loom'
function address(value) {
  try {
    const url = new URL(value)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!url.username && !url.password && !url.search && !url.hash && (url.protocol === 'https:' || (local && url.protocol === 'http:'))) return { url, local }
  } catch {}
}

function HttpSetup({ args, name }) {
  const [provider, setProvider] = useState('none'), [endpoint, setEndpoint] = useState(localEndpoint)
  const [client, setClient] = useState('Codex')
  const [issuers, setIssuers] = useState({ Keycloak: localIssuer, 'oidc-provider': 'http://127.0.0.1:8181', Auth0: '' }), [clientId, setClientId] = useState('')
  const oauth = provider !== 'none', issuer = issuers[provider]?.trim(), server = address(endpoint.trim())
  const validUrl = server && (oauth || server.local), validIssuer = !oauth || address(issuer)
  const start = [...args, '--http']
  if (validUrl) {
    if (server.url.protocol === 'http:') start.push('--port', server.url.port || '80')
    start.push('--resource-url', server.url.href)
  }
  if (oauth) start.push('--issuer', issuer || '')
  return <div className="http-setup">
    <label className="graph-file-label">Authorization provider<select value={provider} onChange={e => { setProvider(e.target.value); setClientId('') }}>
      <option value="none">Local HTTP without sign-in</option><option>Keycloak</option><option>oidc-provider</option><option>Auth0</option>
    </select></label>
    <label className="graph-file-label">MCP server URL<input value={endpoint} type="url" spellCheck={false} onChange={e => setEndpoint(e.target.value)} /></label>
    {oauth && <><label className="graph-file-label">Issuer URL<input value={issuers[provider]} type="url" spellCheck={false}
      placeholder={provider === 'Auth0' ? 'https://your-tenant.auth0.com/' : 'Issuer from provider discovery'}
      onChange={e => setIssuers({ ...issuers, [provider]: e.target.value })} /></label>
      <p>{provider === 'Keycloak' ? <>Use a realm with an S256 public client. Add a <code>graph:read</code> client scope and an audience mapper for the MCP server URL. <a href="https://www.keycloak.org/securing-apps/oidc-layers">Keycloak endpoints ↗</a></> :
        provider === 'oidc-provider' ? <>Register the MCP URL as a resource with the <code>graph:read</code> scope and RS256 access tokens. <a href="#http">Try the local provider walkthrough ↑</a></> :
        <>Set the API identifier to the MCP server URL, add <code>graph:read</code> as a permission and enable the Resource Parameter Compatibility Profile. <a href="https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0">Auth0 resource settings ↗</a></>}</p></>}
    {!validUrl || !validIssuer ? <p className="config-hint" role="status">{!validUrl ?
      'Enter an HTTPS endpoint with OAuth, or a loopback address for local HTTP.' : 'Enter the exact issuer URL from your provider.'}</p> :
      <><Snippet title="Start the HTTP server">{'npx ' + start.map(shellArgument).join(' ')}</Snippet>
        <p>{server.url.protocol === 'https:' ? 'Forward the HTTPS endpoint to the loopback listener on port 7341 and preserve the Host header. ' : ''}
          Choose Streamable HTTP in your client and paste the MCP server URL.{oauth ? ' Register the client’s callback URL with your provider, then sign in when prompted.' : ''}</p>
        {server.url.protocol === 'https:' && <Snippet title="MCP URL for your team">{server.url.href}</Snippet>}
        <details className="codex-setup"><summary>Connect Codex or Claude Code</summary>
          <div className="graph-file-label"><label htmlFor="http-client">HTTP client</label><select id="http-client" value={client} onChange={e => setClient(e.target.value)}>
            <option>Codex</option><option>Claude Code</option>
          </select></div>
          {oauth && <label className="graph-file-label">Registered public client ID<input value={clientId} onChange={e => setClientId(e.target.value)} spellCheck={false} /></label>}
          {(!oauth || clientId.trim()) && <Snippet title={client + ' HTTP command'}>{client === 'Codex'
            ? 'codex mcp add ' + name + ' --url ' + shellArgument(server.url.href) +
              (oauth ? ' --oauth-client-id ' + shellArgument(clientId.trim()) + '\ncodex mcp login ' + name + ' --scopes graph:read' : '')
            : 'claude mcp add --transport http ' + (oauth ? '--client-id ' + shellArgument(clientId.trim()) + ' ' : '') +
              name + ' ' + shellArgument(server.url.href)}</Snippet>}
        </details></>}
  </div>
}

export function McpConnect({ archiveURL, downloadURL }) {
  const [local, setLocal] = useState(true), [path, setPath] = useState('')
  const [http, setHttp] = useState(false), [client, setClient] = useState('Codex')
  const [preview, setPreview] = useState({ name: '', ready: true })
  const [packageURL, setPackageURL] = useState(archiveURL)
  useEffect(() => {
    if (address(location.origin)?.local) setPackageURL(new URL(downloadURL, location.origin).href)
  }, [downloadURL])
  function selectFile(name, ready) {
    if (!ready) setPath(current => current.split(/[\\/]/).at(-1) === name ? current : '')
    setPreview({ name, ready })
  }
  const file = path.trim()
  const absolute = file.startsWith('/') || /^[a-z]:[\\/]/i.test(file) || file.startsWith('\\\\')
  const fromFolder = local && preview.ready && preview.name && !file && !http && client !== 'Client JSON'
  const args = ['--yes', '--package=' + packageURL, 'loom-graph-mcp']
  if (local) args.push('--graph', file || preview.name)
  const name = local ? 'my-graph' : 'loom'
  const config = { mcpServers: { [name]: { command: 'npx', args } } }
  const shellArgs = args.map(shellArgument)
  if (fromFolder) shellArgs[shellArgs.length - 1] = '"$PWD"/' + shellArgument(preview.name)
  const launcher = 'npx ' + shellArgs.join(' ')
  return <div className="owner-workbench"><div className="owner-source">
    <h3>Choose your graph</h3>
    <fieldset><legend>Graph source</legend>
      <label><input type="radio" name="mcp-source" checked={local} onChange={() => setLocal(true)} />My graph file</label>
      <label><input type="radio" name="mcp-source" checked={!local} onChange={() => { setLocal(false); setPreview({ name: '', ready: true }) }} />Bundled graphs</label>
    </fieldset>
    {local ? <GraphCheck onFile={selectFile} /> : <p>Your server will offer Wikispeedia, the knowledge console, Bauhaus and the outer solar system. Ask your assistant which graphs are available.</p>}
  </div><div className="mcp-connect">
    <h3>Connect an assistant</h3>
    <fieldset><legend>Connection</legend>
      <label><input type="radio" name="mcp-transport" checked={!http} onChange={() => setHttp(false)} />Local stdio</label>
      <label><input type="radio" name="mcp-transport" checked={http} onChange={() => setHttp(true)} />Streamable HTTP</label>
    </fieldset>
    {!http && <div className="graph-file-label"><label htmlFor="mcp-client">MCP client</label><select id="mcp-client" value={client} onChange={e => setClient(e.target.value)}>
      <option>Codex</option><option>Claude Code</option><option>Client JSON</option>
    </select></div>}
    {local && <label className="graph-file-label" htmlFor="graph-file">{http ? 'Path on the server' : 'Path on your computer'}{fromFolder ? ' (optional)' : ''}
      <input id="graph-file" placeholder={'/absolute/path/to/' + (preview.name || 'graph.json')} value={path} spellCheck={false}
        aria-describedby="mcp-path-hint" onChange={event => setPath(event.target.value)} /></label>}
    {local && <p className="config-hint" id="mcp-path-hint">{fromFolder
      ? <>Run the command from the folder containing <code>{preview.name}</code>, or enter its full path above.</>
      : <>Enter the full path to {preview.name || 'your JSON file'} on the machine that will run the server.</>}</p>}
    {(!local || (preview.ready && (absolute || fromFolder))) && (http ? <HttpSetup args={args} name={name} /> : <>
      {client === 'Client JSON' ? <><Snippet title="MCP configuration">{JSON.stringify(config, null, 2)}</Snippet>
        <p>Add this entry to your client’s MCP server settings, then reconnect.</p></> : <>
        <Snippet title={client + ' command'}>{(client === 'Codex' ? 'codex' : 'claude') + ' mcp add ' + name + ' -- ' + launcher}</Snippet>
        <p>Run this in a macOS or Linux terminal, then open {client}. The client starts the server when you connect.</p></>}
    </>)}
    <a className="guide-text-link" href={downloadURL} download>Download the server package <span aria-hidden="true">↓</span></a>
  </div></div>
}
