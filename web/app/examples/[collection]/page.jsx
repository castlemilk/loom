import { notFound } from 'next/navigation'
import catalog from '../../../../demo/atlases/catalog.json'
import bauhaus from '../../../../demo/atlases/bauhaus.json'
import solar from '../../../../demo/atlases/outer-solar-system.json'
import { GuideFrame } from '../../guide-frame'
import { pageMetadata } from '../../../metadata'
import { docsURL, homeURL, studioURL } from '../../../site'

const graphs = { bauhaus, 'outer-solar-system': solar }
const startingPoints = { bauhaus: 'Anni_Albers', 'outer-solar-system': 'Voyager_2' }
export const dynamicParams = false
export function generateStaticParams() { return Object.keys(graphs).map(collection => ({ collection })) }

export async function generateMetadata({ params }) {
  const { collection } = await params
  if (!Object.hasOwn(graphs, collection)) notFound()
  const graph = graphs[collection]
  return pageMetadata({ title: graph.name + ' · Wikipedia knowledge graph example · Loom',
    description: catalog[collection].description + ' Browse ' + graph.nodes.length + ' articles and open their connections in Loom Graph Studio.',
    path: homeURL + 'examples/' + collection + '/' })
}

export default async function ArticleIndex({ params }) {
  const { collection } = await params
  if (!Object.hasOwn(graphs, collection)) notFound()
  const graph = graphs[collection]
  const articleURL = id => studioURL + '?' + new URLSearchParams({ example: collection, article: id })
  const start = graph.nodes.find(node => node.id === startingPoints[collection])
  const counts = new Map(graph.nodes.map(node => [node.id, 0]))
  for (const link of graph.links) counts.set(link.source, counts.get(link.source) + 1)
  return <GuideFrame><main className="guide-width article-index" id="guide-main">
    <header>
      <a className="guide-text-link" href={homeURL + '#examples'}>← Graph examples</a>
      <h1>{graph.name} <em>graph.</em></h1>
      <p>{catalog[collection].description} This Wikipedia graph contains {graph.nodes.length} articles and {graph.links.length} directed links.</p>
      <div className="guide-actions">
        <a className="guide-primary" href={studioURL + '?example=' + collection}>Open graph in Studio <span aria-hidden="true">→</span></a>
        <a className="guide-text-link" href={articleURL(start.id)}>Start with {start.label}</a>
      </div>
    </header>
    <p className="article-key">Choose an article to inspect it in Studio. The count shows how many other articles it links to in this graph.</p>
    <div className="article-groups">{Object.keys(catalog[collection].sections).map(section =>
      <section key={section} aria-label={section}><h2>{section}</h2>
        <ul>{graph.nodes.filter(node => node.section === section).map(node =>
          <li key={node.id}><a href={articleURL(node.id)}>{node.label}<span aria-label={counts.get(node.id) + ' outgoing links'}>{counts.get(node.id)}</span></a></li>)}</ul>
      </section>)}</div>
    <footer><p>Source data from {graph.attribution.split(',')[0]}. <a href={graph.licenseUrl}>CC BY-SA 4.0</a></p>
      <a href={docsURL + 'navigation/'}>Build search and drilldowns with the SDK →</a></footer>
  </main></GuideFrame>
}
