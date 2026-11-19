import { apiURL, artURL, homeURL, modelURL, opticsURL, settingsSections, studioURL } from '../site'
import model from '../public/examples/wire-model.json'
import { ModelPlate } from './model-plate'
import { GuideFrame } from './guide-frame'

export const metadata = {
  alternates: { canonical: homeURL },
  openGraph: { title: 'Loom · A field guide to graphs', description: 'Handle a wire model in 3D, then explore four working graph studies.',
    url: homeURL, images: [{ url: artURL('wire-study-1280.webp'), width: 1280, height: 853, alt: 'A wire-and-bead graph model on a charcoal workbench.' }] },
}

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
    <GuideFrame>
    <main id="guide-main">
      <section className="guide-width guide-hero" aria-labelledby="guide-title">
        <div className="guide-intro">
          <h1 id="guide-title">A field guide<br />to <em>graphs.</em></h1>
          <p>Pull a node, open a group and follow its connections. Explore how a network takes shape in Loom’s WebGL2 graph studio.</p>
          <a className="guide-primary" href={studioURL}>Open graph studio <span aria-hidden="true">→</span></a>
        </div>
        <ModelPlate nodes={model.nodes.length} links={model.links.length} />
      </section>
      <section className="guide-examples" id="examples" aria-labelledby="examples-title">
        <div className="guide-width guide-index">
          <div className="index-intro"><h2 id="examples-title">Studio examples</h2>
            <p>Four starting points for exploring the data. Each opens with its layout and settings ready to edit.</p>
          </div>
          <ul className="example-list">{settingsSections.map(({ id }) => {
            const example = examples[id]
            return <li key={id}><a href={example.href} aria-labelledby={'example-' + id}>
              <img src={artURL(id + '.webp')} alt="" width="76" height="76" loading="lazy" />
              <div className="example-copy"><h3 id={'example-' + id}>{example.name}</h3><p>{example.note}</p></div>
              <span className="example-measure">{example.measure}</span><span className="example-arrow" aria-hidden="true">↗</span>
            </a></li>
          })}</ul>
        </div>
      </section>
      <section className="guide-library" id="typescript" aria-labelledby="library-title">
        <div className="guide-width library-grid">
          <div><h2 id="library-title">Build with Loom</h2>
            <p>Mount the TypeScript engine on a sized canvas. The wire model uses the same nodes and links in the live preview and in the studio.</p>
            <div className="library-links"><a href={apiURL}>TypeScript API <span aria-hidden="true">↗</span></a>
              <a href={homeURL + 'loom-core-0.1.0.tgz'} download>Download package <span aria-hidden="true">↓</span></a></div>
          </div>
          <div className="code-specimen"><div className="code-caption"><span>Mount the wire model</span><a href={modelURL} download>wire-model.json <span aria-hidden="true">↓</span></a></div>
            <pre tabIndex={0} aria-label="TypeScript example"><code><b>import</b> {'{ createGraph }'} <b>from</b> <i>'loom-core'</i>{'\n'}
              <b>import</b> model <b>from</b> <i>'./wire-model.json'</i>{'\n\n'}
              <b>const</b> canvas = document.querySelector(<i>'canvas'</i>)!{'\n'}
              createGraph(canvas, {'{'} ...model, mode: <i>'cloud'</i> {'}'})</code></pre>
          </div>
        </div>
      </section>
    </main>
    </GuideFrame>
  </>
}
