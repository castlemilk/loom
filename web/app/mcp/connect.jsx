'use client'

import { useEffect, useState } from 'react'
import { CopyButton } from '../../docs/copy-button'

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

function HttpSetup({ args }) {
  const [provider, setProvider] = useState('none'), [endpoint, setEndpoint] = useState(localEndpoint)
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
        <details className="codex-setup"><summary>Using the Codex CLI</summary>
          {oauth && <label className="graph-file-label">Registered public client ID<input value={clientId} onChange={e => setClientId(e.target.value)} spellCheck={false} /></label>}
          {(!oauth || clientId.trim()) && <Snippet title="Codex HTTP command">{'codex mcp add loom --url ' + shellArgument(server.url.href) +
            (oauth ? ' --oauth-client-id ' + shellArgument(clientId.trim()) + '\ncodex mcp login loom --scopes graph:read' : '')}</Snippet>}
        </details></>}
  </div>
}

export function McpConnect({ archiveURL, downloadURL }) {
  const [local, setLocal] = useState(false), [path, setPath] = useState('')
  const [http, setHttp] = useState(true)
  const [httpPackage, setHttpPackage] = useState(archiveURL)
  useEffect(() => {
    if (new URLSearchParams(location.search).get('source') === 'studio') { setLocal(true); setHttp(false) }
    if (address(location.origin)?.local) setHttpPackage(new URL(downloadURL, location.origin).href)
  }, [downloadURL])
  const file = path.trim()
  const absolute = file.startsWith('/') || /^[a-z]:[\\/]/i.test(file) || file.startsWith('\\\\')
  const args = ['--yes', '--package=' + (http ? httpPackage : archiveURL), 'loom-graph-mcp']
  if (local) args.push('--graph', file)
  const config = { mcpServers: { loom: { command: 'npx', args } } }
  return <div className="mcp-connect">
    <fieldset><legend>Connection</legend>
      <label><input type="radio" name="mcp-transport" checked={http} onChange={() => setHttp(true)} />Streamable HTTP</label>
      <label><input type="radio" name="mcp-transport" checked={!http} onChange={() => setHttp(false)} />Local stdio</label>
    </fieldset>
    <fieldset><legend>Graph source</legend>
      <label><input type="radio" name="mcp-source" checked={!local} onChange={() => setLocal(false)} />Bundled graphs</label>
      <label><input type="radio" name="mcp-source" checked={local} onChange={() => setLocal(true)} />My Studio export</label>
    </fieldset>
    {local && <label className="graph-file-label" htmlFor="graph-file">Path on your computer
      <input id="graph-file" placeholder="/absolute/path/to/scene.json" value={path} spellCheck={false}
        aria-describedby={!absolute ? 'mcp-path-hint' : undefined} onChange={event => setPath(event.target.value)} /></label>}
    {local && !absolute ? <p className="config-hint" id="mcp-path-hint">Enter the full path to your exported graph to generate its configuration.</p> : http ? <HttpSetup args={args} /> : <>
      <figure className="mcp-config"><figcaption>Client configuration <CopyButton name="MCP configuration" /></figcaption>
        <pre tabIndex={0}><code>{JSON.stringify(config, null, 2)}</code></pre></figure>
      <details className="codex-setup"><summary>Using the Codex CLI</summary>
        <figure className="mcp-config"><figcaption>macOS or Linux <CopyButton name="Codex command" /></figcaption>
          <pre tabIndex={0}><code>{'codex mcp add loom -- npx ' + args.map(shellArgument).join(' ')}</code></pre>
        </figure></details></>}
    <a className="guide-text-link" href={downloadURL} download>Download the server package <span aria-hidden="true">↓</span></a>
  </div>
}
