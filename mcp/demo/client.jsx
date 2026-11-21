import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client'
import { ConnectionFrames } from '../../web/app/mcp/connection-frames.jsx'
import { GraphApp } from './graph-app.jsx'
import { InstallOptions } from '../../web/app/mcp/install.jsx'
import './client.css'

const redirectUrl = location.origin + location.pathname
const pendingKey = 'loom.mcp.oauth.pending:' + location.pathname

function connection(config) {
  let tokens, authorizeUrl, browserUri, toolResult
  const sample = { graph: 'wikispeedia', from: 'article:74', to: 'article:2863' }
  const pending = JSON.parse(sessionStorage.getItem(pendingKey) ?? '{}')
  const save = () => sessionStorage.setItem(pendingKey, JSON.stringify(pending))
  const provider = {
    redirectUrl, clientMetadata: { redirect_uris: [redirectUrl], token_endpoint_auth_method: 'none' },
    clientInformation: ({ issuer }) => {
      if (issuer !== config.issuer) throw new Error('The discovered issuer differs from the selected provider.')
      return { client_id: config.clientId, issuer }
    },
    state: () => { pending.state = crypto.randomUUID(); save(); return pending.state },
    saveCodeVerifier: verifier => { pending.verifier = verifier; save() }, codeVerifier: () => pending.verifier,
    saveDiscoveryState: discovery => { pending.discovery = discovery; save() }, discoveryState: () => pending.discovery,
    tokens: () => tokens, saveTokens: value => { tokens = value },
    redirectToAuthorization: url => { url.searchParams.set('prompt', 'consent'); authorizeUrl = url },
  }
  const client = new Client({ name: 'loom-walkthrough', version: '1' }, {
    capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } },
  })
  const statuses = {}
  const transport = new StreamableHTTPClientTransport(new URL(config.resource), {
    authProvider: provider, fetch: async (input, init) => {
      const response = await fetch(input, init)
      if (response.url === pending.discovery?.authorizationServerMetadata?.token_endpoint) statuses.token = response.status
      if (response.url === config.resource && typeof init?.body === 'string') {
        statuses[JSON.parse(init.body).method] = response.status
        if (response.status === 401) { pending.challenge = 401; save() }
      }
      return response
    },
  })
  return {
    async discover() {
      try { await client.connect(transport) }
      catch (error) { if (!(error instanceof UnauthorizedError) || !authorizeUrl) throw error }
      if (!authorizeUrl || !pending.discovery?.resourceMetadata || pending.challenge !== 401) {
        throw new Error('Expected an OAuth challenge from the Graph MCP server.')
      }
      pending.pkce = authorizeUrl.searchParams.get('code_challenge_method')
      pending.scope = authorizeUrl.searchParams.get('scope')
      save()
      return { challenge: pending.challenge, metadataUrl: pending.discovery.resourceMetadataUrl,
        scope: pending.scope, pkce: pending.pkce }
    },
    authorize() { location.assign(authorizeUrl.href) },
    async finish(params) {
      if (!pending.state || params.get('state') !== pending.state) throw new Error('The sign-in state did not match. Connect again.')
      if (params.has('error')) throw new Error('Access was declined. Connect again to retry.')
      await transport.finishAuth(params)
      return { tokenStatus: statuses.token, tokenEndpoint: pending.discovery.authorizationServerMetadata.token_endpoint,
        tokenType: tokens.token_type, scope: tokens.scope ?? pending.scope }
    },
    async list() {
      await client.connect(transport)
      const { tools } = await client.listTools()
      browserUri = tools.find(tool => tool.name === 'get_connection')?._meta?.ui?.resourceUri
      return { toolsStatus: statuses['tools/list'], tools: tools.map(tool => tool.name) }
    },
    async run() {
      const result = await client.callTool({ name: 'get_connection', arguments: sample })
      const link = result.structuredContent
      if (result.isError || !link?.evidence) throw new Error('The graph returned no source passage.')
      toolResult = result
      return { resultStatus: statuses['tools/call'], from: link.from.label, to: link.to.label, evidence: link.evidence }
    },
    async openApp() {
      if (!browserUri || !toolResult) throw new Error('The server did not return an interactive connection.')
      const { contents } = await client.readResource({ uri: browserUri })
      const resource = contents.find(item => item.uri === browserUri && item.mimeType === 'text/html;profile=mcp-app')
      if (typeof resource?.text !== 'string') throw new Error('The graph browser resource is unavailable.')
      return { html: resource.text, result: toolResult, args: sample }
    },
    callAppTool({ name, arguments: args }) {
      if (!['list_graphs', 'search_nodes', 'get_neighbors', 'get_connection'].includes(name)) throw new Error('Unknown graph browser tool.')
      return client.callTool({ name, arguments: args })
    },
    close: () => client.close(),
  }
}

function LiveDemo({ config, callback }) {
  const [record, setRecord] = useState(config), [step, setStep] = useState(0)
  const [busy, setBusy] = useState(Boolean(callback)), [error, setError] = useState('')
  const active = useRef(null)
  const [showApp, setShowApp] = useState(false)
  function reset(message = '') {
    active.current?.close().catch(() => {})
    active.current = null
    setShowApp(false)
    sessionStorage.removeItem(pendingKey)
    setRecord(config); setStep(0); setError(message)
  }
  useEffect(() => {
    if (!callback) { sessionStorage.removeItem(pendingKey); return }
    async function finish() {
      try {
        active.current = connection(config)
        const receipt = await active.current.finish(callback)
        setRecord({ ...config, ...receipt }); setStep(3)
      } catch (err) { reset(err.message) }
      finally { sessionStorage.removeItem(pendingKey); setBusy(false) }
    }
    finish()
  }, [config, callback])
  async function next() {
    setBusy(true); setError('')
    try {
      if (step === 0) {
        active.current = connection(config)
        const receipt = await active.current.discover()
        setRecord({ ...config, ...receipt }); setStep(1)
      } else if (step === 1) setStep(2)
      else if (step === 2) active.current.authorize()
      else if (step === 3) {
        const receipt = await active.current.list()
        setRecord({ ...record, ...receipt }); setStep(4)
      } else if (step === 4) {
        const receipt = await active.current.run()
        setRecord({ ...record, ...receipt }); setStep(5)
      } else reset()
    } catch (err) { reset(err.message) }
    finally { setBusy(false) }
  }
  return <><header><span>Loom / Graph MCP</span><h1>Connect over HTTP</h1>
    <p>{config.hosted ? 'Continue as a guest, approve five minutes of read access, then ask how Music links to Sound.' :
      'Connect to your local graph server, sign in with ' + config.provider + ', then ask how Music links to Sound.'}</p>
    {config.hosted && <a href="../#http">Back to the MCP guide</a>}</header>
    <ConnectionFrames live step={step} record={record} onNext={next} busy={busy} error={error} />
    {step === 5 && <section className="demo-extension"><button type="button" aria-haspopup="dialog" onClick={() => setShowApp(true)}>
      Open graph browser</button>
      {showApp && <GraphApp session={active.current} onClose={() => setShowApp(false)} />}</section>}
    <details className="demo-install"><summary>Install Loom Graph</summary>
      <InstallOptions marketplaceURL={config.marketplaceURL} desktopURL={config.desktopURL} />
    </details></>
}

const params = new URLSearchParams(location.search)
const callback = params.has('code') || params.has('error') ? params : null
if (callback) history.replaceState(null, '', redirectUrl)
const root = createRoot(document.getElementById('demo'))
fetch(new URL('config.json', redirectUrl)).then(r => r.json()).then(config => root.render(<LiveDemo config={config} callback={callback} />))
  .catch(() => root.render(<p>Could not load the connection settings. Reload to retry.</p>))
