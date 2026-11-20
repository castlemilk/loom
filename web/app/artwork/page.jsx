import { artURL, homeURL, modelStudioURL, modelURL, repositoryURL, settingsSections } from '../../site'
import { GuideFrame, pigments } from '../guide-frame'
import { pageMetadata } from '../../metadata'

export const metadata = pageMetadata({
  title: 'Graph illustrations and the wire model · Loom artwork',
  description: 'The individual Loom illustrations, wire study, mark and field guide palette.',
  path: homeURL + 'artwork/',
})

const subjects = { explore: 'Finding a node', layout: 'Arranging nodes in lanes', groups: 'Outlining related nodes', style: 'Changing a wire stroke' }

export default function Artwork() {
  return <GuideFrame artwork><main id="guide-main" className="guide-width art-archive">
    <div className="art-intro"><h1>Loom <em>artwork.</em></h1>
      <p>Graphite drawings identify the controls. Copper wire and ceramic joints give the graph a physical form.</p></div>
    <section aria-labelledby="drawings"><h2 id="drawings">Settings illustrations</h2>
      <ul className="drawing-sheet">{settingsSections.map(({ id, label }) => <li key={id}>
        <a href={artURL(id + '.webp')} download aria-label={'Download ' + label + ' illustration'}>
          <img src={artURL(id + '.webp')} width="224" height="224" alt={subjects[id]} />
          <span><strong>{label}</strong><small>WebP ↓</small></span>
        </a></li>)}</ul>
    </section>
    <section className="art-model" aria-labelledby="study"><img src={artURL('wire-study-640.webp')} width="640" height="427" loading="lazy" alt="Terracotta, graphite and ivory joints joined by fine metal rods." />
      <div><h2 id="study">Wire study</h2><p>The still is a photographic-style illustration. Its 3D interpretation uses a separate JSON file containing every joint and rod.</p>
        <div className="asset-actions"><a href={artURL('wire-study-1280.webp')} download>Download still ↓</a><a href={modelURL} download>Download graph ↓</a>
          <a href={modelStudioURL}>Open wire model ↗</a></div>
      </div>
    </section>
    <section className="art-direction" aria-labelledby="palette"><div><h2 id="palette">Palette and type</h2>
      <p>Instrument Serif sets the titles. The studio pairs sans-serif controls with monospaced measurements.</p>
      <div className="asset-actions"><a href={artURL('loom-mark.svg')} download>Loom mark ↓</a><a href={homeURL + 'licenses/instrument-serif.txt'}>Font licence</a>
        <a href={repositoryURL + '/blob/main/DESIGN.md'}>Design notes ↗</a></div></div>
      <dl className="pigments">{pigments.map((item) => <div key={item.property}><dt><i aria-hidden="true" style={{ background: 'var(' + item.property + ')' }} />{item.name}</dt><dd>{item.hex}</dd></div>)}</dl>
    </section>
  </main></GuideFrame>
}
