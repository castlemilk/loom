import { docsURL } from '../site.js'

export const chapters = [
  { slug: '', title: 'Your first graph', group: 'Getting started', intro: 'Build a small synthesizer signal path. Mount it on a canvas, switch its layout, and focus a module by double-clicking it.' },
  { slug: 'drawing', title: 'Layouts and styling', group: 'Guides', intro: 'Give nodes a visual vocabulary, arrange them in lanes or rings, and draw the direction of a connection.' },
  { slug: 'navigation', title: 'Search and drilldowns', group: 'Guides', intro: 'Answer two questions about a node. What does it connect to, and which part of the graph should the reader see next?' },
  { slug: 'atlas', title: 'Stream a Wikipedia atlas', group: 'Guides', intro: 'Start with a topic map. Fetch article clusters from SQLite as they open, keep a node in view, and load a picture when someone inspects it.' },
  { slug: 'editing', title: 'Edit a graph document', group: 'Guides', intro: 'Give a person or an agent the same editing contract. Preview a batch, commit it against a known revision, and read back the result.' },
  { slug: 'ai-tooling', title: 'Build an AI graph tool', group: 'AI tooling', intro: 'Give an assistant enough context to edit a graph. Follow one request from finding an amplifier to connecting a recorder, including what to do if someone edits the patch first.' },
  { slug: 'performance', title: 'Measure graph performance', group: 'Performance', intro: 'Watch a graph move and settle on your device. Learn which numbers describe loading, drawing, layout work and time between frames.' },
  { slug: 'optimisations', title: 'Optimise large graphs', group: 'Performance', intro: 'Trace a slow interaction to the work behind it. Compare worker layouts, labels, artwork and incremental loading while keeping the graph and camera consistent.' },
  { slug: 'api', title: 'API reference', group: 'Reference', intro: 'Find a package import, exported type, or method on a returned controller. This index is generated from the declarations shipped with Loom.' },
  { slug: 'roadmap', title: 'SDK roadmap', group: 'Reference', intro: 'These are proposed additions, in the order we would build them. Each addresses work an application has to do itself today.' },
]
export const chapterURL = slug => docsURL + (slug ? slug + '/' : '')
export const chapterFile = slug => (slug ? slug + '/' : '') + 'index.md'
export const markdownURL = slug => docsURL + chapterFile(slug)
