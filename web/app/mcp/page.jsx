import { GuideFrame } from '../guide-frame'
import { artURL, docsURL, homeURL, mcpURL, repositoryURL, studioURL } from '../../site'
import { absoluteURL, pageMetadata } from '../../metadata'
import archive from '../../.generated/graph-mcp.json'
import { GraphExplorer } from './explorer'
import { McpConnect } from './connect'
import { RecordedConnection } from './recorded-connection'
import { PluginInstall } from './install'

const description = 'Install Loom Graph for Codex, Claude Code or Claude Desktop. Follow the HTTP and OAuth walkthrough from provider discovery to a cited graph result.'
export const metadata = pageMetadata({ title: 'Graph MCP · Knowledge graph server for AI assistants · Loom', description, path: mcpURL, markdown: mcpURL + 'index.md',
  image: { url: artURL('graph-mcp-social.jpg'), width: 1200, height: 630, alt: 'Loom Graph MCP. A copper branch connects three ivory graph nodes.' } })
const software = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Loom Graph MCP', description,
  url: absoluteURL(mcpURL), image: absoluteURL(artURL('graph-mcp.png')), downloadUrl: archive.archiveURL,
  applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows, macOS, Linux', license: repositoryURL + '/blob/main/LICENSE' }

export default function GraphMcpPage() {
  return <GuideFrame mcp><main id="guide-main" className="mcp-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(software).replace(/</g, '\\u003c') }} />
    <header className="mcp-intro"><div className="guide-width mcp-intro-inner"><div>
      <a className="component-crumb" href={homeURL + '#components'}>← Loom components</a>
      <h1>Graph <em>MCP</em></h1>
      <p>Give an assistant a way to read your graph. It can look up a node, trace a path and bring back the passage behind a Wikipedia link.</p>
      <div className="guide-actions"><a className="guide-primary" href="#http">Walk through HTTP <span aria-hidden="true">↓</span></a>
      <a className="guide-text-link" href="#install">Install the plugin <span aria-hidden="true">↓</span></a>
      <a className="guide-text-link" href="#connect">Connect a client <span aria-hidden="true">↓</span></a>
      <a className="guide-text-link" href="#try">Try a query <span aria-hidden="true">↓</span></a></div>
    </div><figure className="mcp-mark-plate"><img src={artURL('graph-mcp.png')} width="256" height="256" alt="Two copper paths join three ivory terminals." />
      <figcaption><span>Graph MCP</span><code>loom-graph-mcp</code></figcaption></figure></div></header>
    <section id="http" className="guide-width mcp-section" aria-labelledby="http-title">
      <div className="section-heading"><h2 id="http-title">Connect over HTTP</h2>
        <div><p>Connect to the hosted graph as a guest. Approve read access, then run a query and open its archived source.</p>
          <a className="guide-primary" href={mcpURL + 'live/'}>Try the live OAuth demo ↗</a></div></div>
      <p>Follow the same stages in a recorded session with Keycloak or oidc-provider.</p>
      <RecordedConnection />
    </section>
    <PluginInstall marketplaceURL={homeURL + archive.marketplaceFile} desktopURL={homeURL + archive.desktopFile}
      version={archive.version} iconURL={artURL('graph-mcp.png')} />
    <section id="try" className="guide-width mcp-section" aria-labelledby="try-title">
      <div className="section-heading"><h2 id="try-title">Explore the Bauhaus graph</h2>
        <p>Search 15 Wikipedia articles, then follow one of their 52 links. This browser example uses the same graph index and neighbor query as the MCP server.</p></div>
      <GraphExplorer />
      <p className="example-credit">English Wikipedia contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · <a href={studioURL + '?example=bauhaus'}>Open this graph in Studio ↗</a></p>
    </section>
    <section className="mcp-install-surface" id="connect" aria-labelledby="connect-title"><div className="guide-width mcp-install-grid">
      <div><h2 id="connect-title">Connect a client</h2><p>The marketplace plugin runs on your computer over stdio. For a shared graph, run the HTTP server behind an HTTPS endpoint and configure an OAuth provider. Your browser signs in with that provider and returns to your MCP client.</p>
        <p>The <a href={mcpURL + 'live/'}>hosted walkthrough</a> connects this Pages site to the public Graph MCP service. You can also run either demo provider on your computer.</p>
        <p>Start with Wikispeedia, the knowledge console or either curated Wikipedia graph. For your own data, download <code>scene.json</code> from Studio and choose <strong>My Studio export</strong>.</p>
        <p>Try asking <em>“How does Music connect to Sound in Wikispeedia? Show me the source.”</em></p>
        <a className="guide-text-link" href={repositoryURL + '/tree/main/mcp'}>Server source and API ↗</a></div>
      <McpConnect archiveURL={archive.archiveURL} downloadURL={homeURL + archive.filename} />
    </div></section>
    <section className="guide-width mcp-section mcp-reference" aria-labelledby="tools-title"><h2 id="tools-title">Available queries</h2>
      <dl>{[
        ['list_graphs','Discover graph IDs, sizes and attribution.'], ['search_nodes','Find nodes by name, ID, section or subject.'],
        ['get_node','Read the original fields and count incoming and outgoing links.'], ['get_neighbors','Page through the articles around a node in either direction.'],
        ['get_connection','Inspect parallel edges and retrieve archived cross-topic evidence where available.'], ['find_path','Trace a shortest directed path within a chosen number of hops.'],
      ].map(([tool, description]) => <div key={tool}><dt><code>{tool}</code></dt><dd>{description}</dd></div>)}</dl>
      <p>Clients can also read <code>loom://graphs/catalog</code> and the node resource URI returned by each search. <a href={mcpURL + 'index.md'}>Read the MCP guide as Markdown</a>.</p>
      <p>To build an editing agent, use the <a href={docsURL + 'ai-tooling/'}>SDK’s graph editing guide</a>.</p>
    </section>
  </main></GuideFrame>
}
