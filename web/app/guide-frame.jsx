import localFont from 'next/font/local'
import { artURL, homeURL, repositoryURL } from '../site'
import { GuideMast } from './guide-mast'
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
    <GuideMast docs={docs} mcp={mcp} />
    {children}
    <footer className="guide-width guide-footer"><a className="guide-brand" href={homeURL}><img src={artURL('loom-logo.png')} width="24" height="24" alt="" />Loom</a>
      <div><a href={homeURL + 'artwork/'} aria-current={artwork ? 'page' : undefined}>Artwork</a><a href={homeURL + 'llms.txt'}>Markdown index</a><a href={repositoryURL}>GitHub <span aria-hidden="true">↗</span></a><a href="#top">Back to top <span aria-hidden="true">↑</span></a></div></footer>
  </div>
}
