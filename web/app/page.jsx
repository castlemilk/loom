import { apiURL, artURL, docsURL, homeURL, modelURL, opticsURL, repositoryURL, settingsSections, studioURL } from '../site'
import { absoluteURL, atlasImage, brandImage, cardsImage, pageMetadata } from '../metadata'
import { connectionURL, exampleConnections } from '../wiki-connections'
import model from '../public/examples/wire-model.json'
import { ModelPlate } from './model-plate'
import { GuideFrame } from './guide-frame'
import { ComponentShowcase } from './component-showcase'
import wikiEvidence from '../public/examples/wikispeedia/evidence/1-9.json'
import atlases from '../../demo/atlases/catalog.json'
import sdk from '../.generated/sdk-package.json'
import manifest from '../../package.json'

const description = 'Draw a knowledge graph in Loom Graph Studio, embed it with the TypeScript SDK, or give an assistant read access to its nodes, links and sources through Graph MCP.'
export const metadata = pageMetadata({ title: 'Loom · TypeScript library for interactive graph visualization', description, path: homeURL })
const library = { '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: 'Loom', alternateName: manifest.name,
  description, programmingLanguage: 'TypeScript', codeRepository: repositoryURL, url: absoluteURL(homeURL),
  version: manifest.version, license: repositoryURL + '/blob/main/LICENSE', isAccessibleForFree: true,
  image: absoluteURL(brandImage.url), thumbnailUrl: absoluteURL(artURL('loom-logo.png')),
  subjectOf: { '@type': 'WebPage', name: 'Loom SDK documentation', url: absoluteURL(docsURL) }, keywords: manifest.keywords.join(', '),
  ...(sdk.dependency === manifest.version && { sameAs: 'https://www.npmjs.com/package/' + manifest.name }) }
const music = exampleConnections[0]

const examples = {
  explore: { name: 'Optics notebook', note: 'Isolate the seven children of the Optics hub and inspect each one.', measure: '8 nodes', href: opticsURL },
  layout: { name: 'Section lanes', note: 'Read four notebooks side by side, then change the direction of their lanes.', measure: '4 lanes', href: studioURL + '?example=lanes' },
  groups: { name: 'Section clouds', note: 'Orbit the atlas and pull a node across its section boundary.', measure: '45 nodes', href: studioURL + '?example=clusters' },
  style: { name: 'Weighted connections', note: 'Trace citations and replications through the Materials notebook by stroke, weight and direction.', measure: '30 links', href: studioURL + '?example=wires' },
}

// Static Pages serves the same HTML for every query string. Forward old studio bookmarks before hydration.
const legacyStudio = `(() => { const p = new URLSearchParams(location.search); if (['example','group','bubbles'].some(k => p.has(k)) || /^#(settings-|studio-|graph$|legend$|selection$|group-bubbles$)/.test(location.hash)) location.replace(${JSON.stringify(studioURL)} + location.search + location.hash) })()`

export default function FieldGuide() {
  return <>
    <script dangerouslySetInnerHTML={{ __html: legacyStudio }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(library).replace(/</g, '\\u003c') }} />
    <GuideFrame>
    <main id="guide-main">
      <section className="guide-hero-surface" aria-labelledby="guide-title"><div className="guide-width guide-hero">
        <div className="guide-intro">
          <h1 id="guide-title">Interactive graphs<br />in <em>TypeScript.</em></h1>
          <p>Draw a graph in Studio, query it in TypeScript, or ask an assistant how two articles connect.</p>
          <div className="guide-actions">
            <a className="guide-primary" href={docsURL}>Build your first graph <span aria-hidden="true">→</span></a>
            <a className="guide-text-link" href={studioURL}>Open graph studio <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <ComponentShowcase passage={wikiEvidence.links[music.edge][3]} source="https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm" />
        <nav className="hero-guides" aria-label="SDK shortcuts">
          <a href={docsURL + 'editing/#export-a-graph-to-your-app'}>Export to code</a>
          <a href={docsURL + 'atlas/'}>Stream clusters with SQLite</a>
          <a href={apiURL}>API reference</a>
        </nav>
      </div></section>
      <section className="guide-examples" id="examples" aria-labelledby="examples-title">
        <div className="guide-width featured-studies">
          <h2 id="examples-title">Explore the graphs</h2>
          <div className="featured-pair">
            <article><a className="featured-open" href={studioURL + 'wikispeedia/'} aria-labelledby="example-wikispeedia">
              <img src={atlasImage.url} alt={atlasImage.alt} width={atlasImage.width} height={atlasImage.height} loading="lazy" />
              <h3 id="example-wikispeedia">Wikispeedia</h3>
            </a>
              <p>Open a topic in a map of 4,604 Wikipedia articles. The Music article links to Sound in its opening paragraph. Follow the link back to that passage.</p>
              <div className="study-links"><a href={connectionURL(music.topics, music.edge)}>Follow {music.title}</a><a href={docsURL + 'atlas/'}>Build a streaming atlas</a></div>
            </article>
            <article><a className="featured-open" href={studioURL + 'cards/'} aria-labelledby="example-canva">
              <img src={cardsImage.url} alt={cardsImage.alt} width={cardsImage.width} height={cardsImage.height} loading="lazy" />
              <h3 id="example-canva">Around Canva</h3>
            </a>
              <p>See how founders and investors connect to Canva. Select a card to highlight its relationships and inspect the evidence for each one.</p>
              <div className="study-links"><a href={docsURL + 'navigation/#open-relationship-cards'}>Build relationship cards</a></div>
            </article>
          </div>
        </div>
        <div className="guide-width guide-index">
          <div className="index-intro"><h2>Graph studies</h2>
            <p>Try the same controls on a small graph. Change its layout, follow a wire or look inside a group.</p>
            <a className="guide-text-link" href={docsURL + 'drawing/'}>Layouts and styling <span aria-hidden="true">→</span></a>
            <nav className="atlas-indexes" aria-label="Wikipedia graph article indexes">
              {Object.entries(atlases).map(([slug, atlas]) => <a key={slug} href={homeURL + 'examples/' + slug + '/'}>{atlas.title} article index</a>)}
            </nav>
          </div>
          <ul className="example-list">{settingsSections.map(({ id }) => {
            const example = examples[id]
            return <li key={id}><a href={example.href} aria-labelledby={'example-' + id}>
              <img src={artURL(id + '.webp')} alt="" width="76" height="76" loading="lazy" />
              <div className="example-copy"><h3 id={'example-' + id}>{example.name}</h3><p>{example.note}</p></div>
              <span className="example-measure">{example.measure}</span><span className="example-arrow" aria-hidden="true">↗</span>
            </a></li>
          })}{Object.entries(atlases).map(([key, atlas]) =>
            <li key={key} className="collection-study"><a href={studioURL + '?example=' + key} aria-labelledby={'example-' + key}>
              <div className="example-copy"><h3 id={'example-' + key}>{atlas.title}</h3><p>{atlas.description}</p></div>
              <span className="example-measure">{Object.values(atlas.sections).reduce((n, group) => n + group.articles.length, 0)} articles</span>
              <span className="example-arrow" aria-hidden="true">↗</span>
            </a></li>)}</ul>
        </div>
      </section>
      <section className="guide-library" id="typescript" aria-labelledby="library-title">
        <div className="guide-width library-grid">
          <div><h2 id="library-title">Build with Loom</h2>
            <p>Start with an array of nodes and links. Mount the graph on a sized canvas, then choose a layout, handle a selection or connect an AI editing tool.</p>
            <div className="library-links"><a href={apiURL}>TypeScript API <span aria-hidden="true">↗</span></a>
              <a href={docsURL + 'ai-tooling/'}>Build an AI graph tool</a>
              <a href={docsURL + 'performance/'}>Measure graph performance</a>
              <a href={homeURL + sdk.filename} download>Download package <span aria-hidden="true">↓</span></a></div>
            <div className="code-specimen"><div className="code-caption"><span>Mount the wire model</span><a href={modelURL} download>wire-model.json <span aria-hidden="true">↓</span></a></div>
              <pre tabIndex={0} aria-label="TypeScript example"><code><b>import</b> {'{ createGraph }'} <b>from</b> <i>'loom-core'</i>{'\n'}
                <b>import</b> model <b>from</b> <i>'./wire-model.json'</i>{'\n\n'}
                <b>const</b> canvas = document.querySelector(<i>'canvas'</i>)!{'\n'}
                createGraph(canvas, {'{'} ...model, mode: <i>'cloud'</i> {'}'})</code></pre>
            </div>
          </div>
          <ModelPlate nodes={model.nodes.length} links={model.links.length} />
        </div>
      </section>
    </main>
    </GuideFrame>
  </>
}
