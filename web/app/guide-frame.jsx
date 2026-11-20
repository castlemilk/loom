import localFont from 'next/font/local'
import { artURL, docsURL, homeURL, mcpURL, repositoryURL, studioURL } from '../site'
import './field-guide.css'
import './component-guide.css'

const display = localFont({ src: [
  { path: '../assets/type/instrument-serif-regular.woff', weight: '400', style: 'normal' },
  { path: '../assets/type/instrument-serif-italic.woff', weight: '400', style: 'italic' },
], variable: '--guide-serif', display: 'swap' })

export const pigments = [
  { name: 'Paper', property: '--paper', hex: '#f5f3ea' },
  { name: 'Graphite', property: '--ink', hex: '#202721' },
  { name: 'Copper', property: '--copper', hex: '#9b4427' },
  { name: 'Mineral', property: '--mineral', hex: '#e8ece5' },
]
const colors = Object.fromEntries(pigments.map((color) => [color.property, color.hex]))

export function GuideFrame({ artwork = false, docs = false, mcp = false, children }) {
  return <div id="top" className={'field-guide ' + display.variable} style={colors}>
    <a className="guide-skip" href="#guide-main">Skip to content</a>
    <header className="guide-mast"><div className="guide-width mast-inner">
      <div className="guide-identity"><a className="guide-brand" href={homeURL} aria-label="Loom home">
        <img src={artURL('loom-logo.png')} width="34" height="34" alt="" />Loom
      </a></div>
      <nav className="guide-nav" aria-label="Field guide">
        <a href={homeURL + '#components'}>Components</a><a href={homeURL + '#examples'}>Examples</a>
        <a href={docsURL} aria-current={docs ? 'location' : undefined}>SDK docs</a>
        <a href={mcpURL} aria-current={mcp ? 'page' : undefined}><img src={artURL('graph-mcp.png')} width="20" height="20" alt="" />Graph MCP</a>
      </nav>
      <a className="mast-launch" href={studioURL}>Open Studio <span aria-hidden="true">↗</span></a>
    </div></header>
    {children}
    <footer className="guide-width guide-footer"><a className="guide-brand" href={homeURL}><img src={artURL('loom-logo.png')} width="24" height="24" alt="" />Loom</a>
      <div><a href={homeURL + 'artwork/'} aria-current={artwork ? 'page' : undefined}>Artwork</a><a href={repositoryURL}>GitHub <span aria-hidden="true">↗</span></a><a href="#top">Back to top <span aria-hidden="true">↑</span></a></div></footer>
  </div>
}
