'use client'

import { useState } from 'react'
import { CopyButton } from '../../docs/copy-button'
import { ConnectionFrames } from './connection-frames'
import keycloak from '../../showcase/mcp-keycloak.json'
import local from '../../showcase/mcp-oidc.json'

export function RecordedConnection() {
  const [step, setStep] = useState(0), [profile, setProfile] = useState('keycloak')
  const docker = profile === 'keycloak'
  const providerControl = <label className="frame-provider">OAuth provider<select value={profile} onChange={e => setProfile(e.target.value)}>
    <option value="keycloak">Keycloak</option><option value="local">oidc-provider</option>
  </select></label>
  return <><ConnectionFrames record={docker ? keycloak : local} step={step} onStep={setStep} onNext={setStep} providerControl={providerControl} />
    <details className="mcp-demo-launch"><summary>Run a provider locally</summary>
      <p>{docker ? 'From a Loom checkout with Docker running, start the graph server and a temporary Keycloak realm.' :
        'From a Loom checkout, start the graph server and an in-memory OpenID Connect provider with Node.js.'}</p>
      <figure className="mcp-config"><figcaption>In the repository <CopyButton name="live demo commands" /></figcaption>
        <pre><code>{'task setup\ntask mcp:demo' + (docker ? '' : ' PROVIDER=local')}</code></pre></figure>
      <p>Sign in as <code>reader</code> with password <code>loom-demo</code>. Ctrl+C stops the demo. <a href="http://127.0.0.1:7341/demo/">Open local walkthrough ↗</a></p>
      <p>After the source passage appears, choose <strong>Open graph browser</strong> to explore another graph through the same connection.</p>
    </details></>
}
