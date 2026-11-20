import { notFound } from 'next/navigation'
import { GuideFrame } from '../app/guide-frame'
import { chapters, chapterURL } from './catalog'
import FirstGraph from './guides/first-graph.mdx'
import Drawing from './guides/drawing.mdx'
import Navigation from './guides/navigation.mdx'
import Atlas from './guides/atlas.mdx'
import Editing from './guides/editing.mdx'
import Reference from './guides/api.mdx'
import Roadmap from './guides/roadmap.mdx'
import './guide.css'

const pages = { '': FirstGraph, drawing: Drawing, navigation: Navigation, atlas: Atlas, editing: Editing, api: Reference, roadmap: Roadmap }
function Contents({ slug }) {
  return <nav aria-label="SDK chapters">{[...new Set(chapters.map(c => c.group))].map(group =>
    <div key={group}><p>{group}</p><ul>{chapters.filter(c => c.group === group).map(c =>
      <li key={c.slug}><a href={chapterURL(c.slug)} aria-current={c.slug === slug ? 'page' : undefined}>{c.title}</a></li>)}</ul></div>)}</nav>
}
export function metadataFor(slug) {
  const chapter = chapters.find(c => c.slug === slug)
  if (!chapter) notFound()
  return { title: chapter.title + ' · SDK docs', description: chapter.intro, alternates: { canonical: chapterURL(slug) } }
}
export function Guide({ slug }) {
  const i = chapters.findIndex(c => c.slug === slug)
  if (i < 0) notFound()
  const chapter = chapters[i], Content = pages[slug]
  return <GuideFrame docs>
    <div className="guide-width docs-shell">
      <aside className="docs-sidebar"><Contents slug={slug} /></aside>
      <details className="docs-mobile-index"><summary>Browse SDK docs</summary><Contents slug={slug} /></details>
      <main id="guide-main" className="docs-article">
        <header className="docs-title"><p>{chapter.group}</p><h1>{chapter.title}</h1><div>{chapter.intro}</div></header>
        <div className="docs-reading"><Content /></div>
        <nav className="docs-steps" aria-label="Adjacent chapters">
          {chapters[i - 1] && <a href={chapterURL(chapters[i - 1].slug)} rel="prev"><small>← Previous</small>{chapters[i - 1].title}</a>}
          {chapters[i + 1] && <a href={chapterURL(chapters[i + 1].slug)} rel="next"><small>Next →</small>{chapters[i + 1].title}</a>}
        </nav>
      </main>
    </div>
  </GuideFrame>
}
