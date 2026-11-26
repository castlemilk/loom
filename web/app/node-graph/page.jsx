import { GuideFrame } from '../guide-frame'
import { pageMetadata } from '../../metadata'
import { homeURL } from '../../site'
import {
  nodeGraphTitle, nodeGraphIntro, nodeGraphBoundary, nodeGraphExamples, nodeGraphReferences,
} from '../../node-graph'
import canva from '../../public/examples/around-canva.json'
import './node-graph.css'

const path = homeURL + 'node-graph/'
const labelById = new Map(canva.nodes.map(node => [node.id, node.label]))
export const metadata = pageMetadata({
  path,
  title: 'Node graph library for JavaScript and TypeScript · Loom Graph SDK',
  description: 'Build interactive node-link diagrams with the open-source Loom node graph library. Try sourced examples, download graph JSON and use the WebGL2 renderer or headless editor.',
})

export default function NodeGraphGuide() {
  return <GuideFrame><main id="guide-main" className="mcp-page node-graph-guide">
    <header className="guide-width mcp-section">
      <a className="component-crumb" href={homeURL}>← Loom Graph SDK</a>
      <h1>{nodeGraphTitle}</h1>
      <p>{nodeGraphIntro}</p>
      <div className="guide-actions">
        <a className="guide-primary" href={homeURL + 'docs/'}>Build your first graph</a>
        <a className="guide-text-link" href="#graph-examples">Browse examples without the canvas</a>
      </div>
    </header>
    <section className="guide-width mcp-section" id="graph-examples" aria-labelledby="graph-examples-title">
      <h2 id="graph-examples-title">Graph examples you can read</h2>
      <p>Start with HTML, Markdown or data. The canvas is optional for reading these examples.</p>
      <ul className="node-graph-examples">{nodeGraphExamples.map(example => <li key={example.id} id={example.id}>
        <h3>{example.label}</h3>
        <p>{example.description}</p>
        <ul aria-label={example.label + ' formats'}>
          <li><a href={homeURL + example.html} aria-label={'Open example: ' + example.label}>Open example</a></li>
          <li><a href={homeURL + example.markdown} aria-label={'Read Markdown: ' + example.label}>Read Markdown</a></li>
          <li><a href={homeURL + example.data} aria-label={'Get JSON: ' + example.label}>Get JSON</a></li>
          {example.source && <li><a href={example.source}>Read original source</a></li>}
        </ul>
      </li>)}</ul>
      <details className="node-graph-details">
        <summary>Read all {canva.links.length} Canva relationships</summary>
        <ul>{canva.links.map(edge => <li key={edge.source + ':' + edge.target}>
          <strong>{labelById.get(edge.source)} → {labelById.get(edge.target)}</strong>
          {' · '}{edge.label}{' · '}<a href={edge.evidence}>Source for {labelById.get(edge.source)} → {labelById.get(edge.target)}</a>
        </li>)}</ul>
      </details>
    </section>
    <section className="guide-width mcp-section mcp-reference" aria-labelledby="agent-reference-title">
      <h2 id="agent-reference-title">Use Loom from an agent</h2>
      <p>{nodeGraphBoundary}</p>
      <p><a href={homeURL + 'node-graph/agent-guide.json'}>Read the agent guide (JSON)</a>{' · '}
        <a href={homeURL + 'node-graph/index.md'}>Read this page as Markdown</a>{' · '}
        <a href={homeURL + 'llms.txt'}>Browse all assistant docs</a></p>
      <ul>{nodeGraphReferences.map(entry => <li key={entry.href}><a href={homeURL + entry.href}>{entry.label}</a></li>)}</ul>
    </section>
  </main></GuideFrame>
}
