'use client'

import './connection-frames.css'

const chapters = [
  ['Endpoint', 'Add the server', 'MCP client', 'Server settings', 'Connect over HTTP'],
  ['Discovery', 'Find the provider', 'Graph MCP', 'Resource metadata', 'Review access'],
  ['Consent', 'Grant read access', 'OAuth provider', 'Authorization request', 'Grant read access'],
  ['Token', 'Exchange the code', 'OAuth provider', 'Token response', 'List graph tools'],
  ['Tools', 'Inspect the tools', 'MCP client', 'Tool catalog', 'Run get_connection'],
  ['Result', 'Read the source', 'Graph MCP', 'Tool result', 'Replay walkthrough'],
]

// The client sits between the two peers. Each vertical line stays on the same column.
const routes = [
  ['  o<-------*        |', '  |        |        |', () => 'The client sends its first request to Graph MCP.'],
  ['  *------->o------->o', "  |        o<-------'", provider => 'Graph MCP returns a challenge. The client discovers ' + provider + ' and its endpoints.'],
  ['  |        o------->o', "  |        o<-------'", provider => 'The browser opens ' + provider + ' for consent and returns to the client with a code.'],
  ['  |        *=======>o', "  |        o<======='", provider => 'The client exchanges the code and its PKCE verifier for an access token at ' + provider + '.'],
  ['  o<-------*        |', "  '------->o        |", () => 'The client presents its token to Graph MCP and receives the tool catalog.'],
  ['  o<-------*        |', "  '=======>@        |", () => 'Graph MCP returns the Music to Sound connection and its archived source.'],
]

function Fields({ rows }) {
  return <dl className="frame-fields">{rows.map(([name, value]) =>
    <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
}

export function ConnectionFrames({ record, step, onStep, onNext, live = false, busy = false, error, providerControl }) {
  const [label, title, actor, surface, action] = chapters[step]
  const { provider, resource, issuer, scope, tools, evidence } = record
  const next = live && step === 2 ? 'Continue to ' + provider : live && step === 5 ? 'Connect again' : action
  const Step = onStep ? 'button' : 'span'
  return <div className="connection-frames">
    <div className="connection-rail">
      <span className="frame-mode"><i aria-hidden="true" />{live ? 'Live connection' : 'Recorded connection'}</span>
      {providerControl}
      <div className="frame-circuit">
        <div className="frame-stations" aria-hidden="true"><span>HTTP flow</span><pre>{[
          ' MCP    Client    OAuth',
          ' ___      ___      .-.',
          '|=.=|    | >_|     | |',
          '|___|    /___\\    [ o ]',
          '  |        |        |',
        ].join('\n')}</pre></div>
        <ol aria-label="Connection steps">{chapters.map(([name, heading], i) =>
          <li key={name}><Step className="frame-step" {...(onStep ? { type: 'button', onClick: () => onStep(i) } : {})}
            aria-label={'Step ' + (i + 1) + ', ' + heading} aria-current={i === step ? 'step' : undefined}
            title={routes[i][2](provider)}>
            <span className="frame-step-name"><span className="frame-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{name}</span>
            <span className="frame-trace" aria-hidden="true">{routes[i].slice(0, 2).join('\n')}</span>
          </Step></li>)}</ol>
      </div>
      <p className="frame-route" aria-live="polite">{routes[step][2](provider)}</p>
    </div>
    <section className="frame-workspace" aria-label={label + ' wireframe'} aria-busy={busy}>
      <div className="frame-stage">
        <div className="frame-window" key={step}>
          <div className="frame-chrome"><span>{actor === 'OAuth provider' ? provider : actor}</span><span>{surface}</span></div>
          <div className="frame-sheet" aria-live="polite" aria-atomic="true">
            {step === 0 && <><h3>Add an MCP server</h3><Fields rows={[
              ['Name', 'Loom Graph MCP'], ['Transport', 'Streamable HTTP'], ['Server URL', resource],
            ]} /></>}
            {step === 1 && <><div className="frame-response">{record.challenge} Unauthorized</div>
              <h3>Sign-in required</h3><Fields rows={[
                ['Metadata', new URL(record.metadataUrl).pathname], ['Issuer', issuer], ['Scope', scope],
              ]} /></>}
            {step === 2 && <><div className="frame-permission-mark" aria-hidden="true">↗</div>
              <h3>Read Loom graphs?</h3><p>Loom walkthrough is requesting access to graph nodes, links and their source passages.</p>
              <div className="frame-scope"><span aria-hidden="true">✓</span> Read graph data <code>{scope}</code></div>
              <p className="frame-note">{live && record.localRealm ? <>Local demo sign-in · <strong>reader</strong> / <strong>loom-demo</strong></> :
                <>Authorization code · PKCE {record.pkce}</>}</p></>}
            {step === 3 && <><div className="frame-response success">{record.tokenStatus} OK</div>
              <h3>Code exchanged</h3><Fields rows={[
                ['Grant', 'authorization_code'], ['Token type', record.tokenType], ['Scope', scope], ['Resource', resource],
              ]} /></>}
            {step === 4 && <><div className="frame-response success">{record.toolsStatus} OK</div><h3>Tools available</h3>
              <ul className="frame-tools">{tools.map(tool => <li key={tool}><code>{tool}</code></li>)}</ul></>}
            {step === 5 && <><div className="frame-response success">{record.resultStatus} OK</div><h3>{record.from} <span aria-hidden="true">→</span> {record.to}</h3>
              <blockquote>{evidence.excerpt}</blockquote><a className="frame-source" href={evidence.sourceUrl}>Archived {record.from} article ↗</a></>}
          </div>
        </div>
      </div>
      <footer className="frame-controls">
        <div><span className="frame-count">{String(step + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}</span><strong aria-live="polite">{title}</strong>
          <code>{['POST /mcp', 'GET ' + (record.metadataUrl ? new URL(record.metadataUrl).pathname : ''), 'authorization_code · S256',
            'POST ' + (record.tokenEndpoint ? new URL(record.tokenEndpoint).pathname : ''), 'tools/list', 'tools/call · get_connection'][step]}</code></div>
        <button type="button" onClick={() => onNext((step + 1) % chapters.length)} disabled={busy}>{busy ? 'Connecting…' : next} <span aria-hidden="true">{step === 5 ? '↻' : '→'}</span></button>
      </footer>
      {error && <p role="alert" className="frame-error">{error}</p>}
    </section>
  </div>
}
