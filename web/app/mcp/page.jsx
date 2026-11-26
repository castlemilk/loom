import { GuideFrame } from '../guide-frame'
import { artURL, docsURL, homeURL, mcpURL, repositoryURL, studioURL } from '../../site'
import { absoluteURL, pageMetadata } from '../../metadata'
import archive from '../../.generated/graph-mcp.json'
import { GraphExplorer } from './explorer'
import { McpConnect } from './connect'
import { RecordedConnection } from './recorded-connection'
import { PluginInstall } from './install'

const description = 'Turn your knowledge graph into an MCP server. Check a JSON file in your browser, connect it to Codex or Claude Code, or serve it to your team over HTTP with OAuth.'
export const metadata = pageMetadata({ title: 'An MCP server for your knowledge graph · Loom', description, path: mcpURL, markdown: mcpURL + 'index.md',
  image: { url: artURL('graph-mcp-social.jpg'), width: 1200, height: 630, alt: 'Loom Graph MCP. A copper branch connects three ivory graph nodes.' } })
const software = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Loom Graph MCP', description,
  url: absoluteURL(mcpURL), image: absoluteURL(artURL('graph-mcp.png')), downloadUrl: archive.archiveURL,
  applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows, macOS, Linux', license: repositoryURL + '/blob/main/LICENSE' }

export default function GraphMcpPage() {
  return <GuideFrame mcp><main id="guide-main" className="mcp-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(software).replace(/</g, '\\u003c') }} />
    <header className="mcp-intro"><div className="guide-width mcp-intro-inner"><div>
      <a className="component-crumb" href={homeURL + '#components'}>← Loom components</a>
      <h1>An MCP server for <em>your graph</em></h1>
      <p>Give an assistant your nodes and relationships in a format it can query. Loom turns a graph file into six read-only tools for searching, following links and tracing paths.</p>
      <div className="guide-actions"><a className="guide-primary" href="#connect">Connect my graph <span aria-hidden="true">↓</span></a>
      <a className="guide-text-link" href="#http">See a hosted example <span aria-hidden="true">↓</span></a></div>
    </div><figure className="mcp-mark-plate"><img src={artURL('graph-mcp.png')} width="256" height="256" alt="Two copper paths join three ivory terminals." />
      <figcaption><span>Graph MCP</span><code>graph.json → MCP</code></figcaption></figure></div></header>
    <section id="connect" className="guide-width mcp-section" aria-labelledby="connect-title">
      <div className="section-heading"><h2 id="connect-title">Bring your graph</h2>
        <p>Preview a real MCP query here. To use the same graph in an assistant, copy its setup command and run it with Node.js 22.14 or later.</p></div>
      <McpConnect archiveURL={archive.archiveURL} downloadURL={homeURL + archive.filename} />
      <p className="example-credit">Building a graph in <a href={studioURL}>Loom Studio</a>? Choose <strong>Export graph → Graph MCP</strong> to save the file.
        {' '}<a href={mcpURL + 'index.md'}>File format and server guide</a>{' · '}<a href={homeURL + 'node-graph/#agent-reference-title'}>Public examples and agent guide</a></p>
    </section>
    <section id="http" className="guide-width mcp-section" aria-labelledby="http-title">
      <div className="section-heading"><h2 id="http-title">Connect over HTTP</h2>
        <div><p>See what a teammate experiences when you share an MCP endpoint. Loom’s public example grants guest access to a sample graph and returns a cited connection.</p>
          <a className="guide-primary" href={mcpURL + 'live/'}>Try the live OAuth demo ↗</a></div></div>
      <p>To host your file, choose <strong>Streamable HTTP</strong> in <a href="#connect">graph setup</a> and enter your endpoint and OAuth issuer. These recordings show sign-in with Keycloak and oidc-provider.</p>
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
    <section className="guide-width mcp-section mcp-reference" aria-labelledby="tools-title"><h2 id="tools-title">Available queries</h2>
      <dl>{[
        ['list_graphs','Discover graph IDs, sizes and attribution.'], ['search_nodes','Find nodes by name, ID, section or subject.'],
        ['get_node','Read the original fields and count incoming and outgoing links.'], ['get_neighbors','Page through the articles around a node in either direction.'],
        ['get_connection','Read the original relationship fields between two nodes, including parallel links and any supplied evidence.'], ['find_path','Trace a shortest directed path within a chosen number of hops.'],
      ].map(([tool, description]) => <div key={tool}><dt><code>{tool}</code></dt><dd>{description}</dd></div>)}</dl>
      <p>Clients can also read <code>loom://graphs/catalog</code> and the node resource URI returned by each search. <a href={mcpURL + 'index.md'}>Read the MCP guide as Markdown</a>.</p>
      <p>Already have nodes and links in your application? <a href={repositoryURL + '/tree/main/mcp#use-the-server-in-code'}>Use the JavaScript API to serve your graph directly</a>.</p>
      <p>To build an editing agent, use the <a href={docsURL + 'ai-tooling/'}>SDK’s graph editing guide</a>.</p>
    </section>
  </main></GuideFrame>
}
