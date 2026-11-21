'use client'

import { useState } from 'react'
import { CopyButton } from '../../docs/copy-button'

const clients = ['Codex', 'Claude Code', 'Claude Desktop']
const commands = {
  Codex: 'codex plugin marketplace add ./loom-marketplace\ncodex plugin add loom-graph@loom',
  'Claude Code': 'claude plugin marketplace add ./loom-marketplace\nclaude plugin install loom-graph@loom',
}

export function PluginInstall({ marketplaceURL, desktopURL, version, iconURL }) {
  return <section id="install" className="guide-width mcp-section" aria-labelledby="install-title">
    <div className="section-heading"><h2 id="install-title">Install Loom Graph</h2>
      <p>Give your client four offline graphs and six read-only tools. MCP Apps clients can also open the graph browser and inspect a connection with its source.</p></div>
    <div className="plugin-install">
      <div className="plugin-edition">
        <img src={iconURL} width="56" height="56" alt="" />
        <h3>Loom Graph</h3><p>Wikispeedia, the knowledge console, Bauhaus and the outer solar system.</p>
        <dl><div><dt>Release</dt><dd>v{version}</dd></div><div><dt>Transport</dt><dd>Local stdio</dd></div></dl>
        <a className="guide-text-link" href="#connect">Configure HTTP and OAuth ↓</a>
      </div>
      <InstallOptions marketplaceURL={marketplaceURL} desktopURL={desktopURL} />
    </div>
  </section>
}

export function InstallOptions({ marketplaceURL, desktopURL }) {
  const [client, setClient] = useState('Codex')
  const desktop = client === 'Claude Desktop'
  return <div className="plugin-instructions">
    <fieldset><legend>Install for</legend><div>{clients.map(name => <label key={name}>
      <input type="radio" name="install-client" checked={client === name} onChange={() => setClient(name)} />{name}
    </label>)}</div></fieldset>
    <a className="guide-primary" href={desktop ? desktopURL : marketplaceURL} download>
      {desktop ? 'Download desktop extension' : 'Download Loom marketplace'} <span aria-hidden="true">↓</span></a>
    {desktop ? <p>In Claude Desktop settings, open <strong>Extensions</strong>, then <strong>Advanced settings</strong>. Choose <strong>Install Extension</strong> and select the downloaded <code>.mcpb</code> file.</p> :
      <><p>Use Node.js 22.14 or later. Extract the ZIP to a folder you’ll keep, then run these commands from the directory containing <code>loom-marketplace</code>.</p>
      <figure className="mcp-config"><figcaption>{client}<CopyButton name={client + ' plugin install'} /></figcaption>
        <pre tabIndex={0}><code>{commands[client]}</code></pre></figure></>}
    <p className="plugin-prompt">Try asking <em>“How does Music connect to Sound in Wikispeedia? Show me the source.”</em></p>
  </div>
}
