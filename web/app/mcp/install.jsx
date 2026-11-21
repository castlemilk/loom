'use client'

import { useState } from 'react'
import { CopyButton } from '../../docs/copy-button'

const clients = ['Codex', 'Claude Code', 'Claude Desktop']
const commands = {
  Codex: 'codex plugin marketplace add castlemilk/loom\ncodex plugin add loom-graph@loom',
  'Claude Code': 'claude plugin marketplace add castlemilk/loom\nclaude plugin install loom-graph@loom',
}

export function PluginInstall({ marketplaceURL, desktopURL, version, iconURL }) {
  return <section id="install" className="guide-width mcp-section" aria-labelledby="install-title">
    <div className="section-heading"><h2 id="install-title">Install Loom Graph</h2>
      <p>Install the marketplace plugin to try the same tools on four offline example graphs. To connect your own file, use <a href="#connect">graph setup</a>.</p></div>
    <div className="plugin-install">
      <div className="plugin-edition">
        <img src={iconURL} width="56" height="56" alt="" />
        <h3>Loom Graph</h3><p>Wikispeedia, the knowledge console, Bauhaus and the outer solar system.</p>
        <dl><div><dt>Release</dt><dd>v{version}</dd></div><div><dt>Transport</dt><dd>Local stdio</dd></div></dl>
        <a className="guide-text-link" href="#connect">Connect my graph ↑</a>
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
    {desktop ? <><a className="guide-primary" href={desktopURL} download>Download desktop extension <span aria-hidden="true">↓</span></a>
      <p>In Claude Desktop settings, open <strong>Extensions</strong>, then <strong>Advanced settings</strong>. Choose <strong>Install Extension</strong> and select the downloaded <code>.mcpb</code> file.</p></> :
      <><p>With Node.js 22.14 or later installed, run these commands in your terminal. {client} fetches Loom Graph from GitHub and starts the graph server locally.</p>
      <figure className="mcp-config"><figcaption>{client}<CopyButton name={client + ' plugin install'} /></figcaption>
        <pre tabIndex={0}><code>{commands[client]}</code></pre></figure>
      <p>For an offline install, extract the ZIP and use <code>./loom-marketplace</code> in place of <code>castlemilk/loom</code> in the first command. <a className="guide-text-link" href={marketplaceURL} download>Download Loom marketplace <span aria-hidden="true">↓</span></a></p></>}
    <p className="plugin-prompt">Try asking <em>“How does Music connect to Sound in Wikispeedia? Show me the source.”</em></p>
  </div>
}
