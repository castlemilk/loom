import { docsURL } from '../site'

export const chapters = [
  { slug: '', title: 'Your first graph', group: 'Getting started', intro: 'Build a small synthesizer signal path. Mount it on a canvas, switch its layout, and focus a module by double-clicking it.' },
  { slug: 'drawing', title: 'Layouts and styling', group: 'Guides', intro: 'Give nodes a visual vocabulary, arrange them in lanes or rings, and draw the direction of a connection.' },
  { slug: 'navigation', title: 'Search and drilldowns', group: 'Guides', intro: 'Answer two questions about a node. What does it connect to, and which part of the graph should the reader see next?' },
  { slug: 'atlas', title: 'Stream a Wikipedia atlas', group: 'Guides', intro: 'Start with a topic map. Fetch article clusters from SQLite as they open, keep a node in view, and load a picture when someone inspects it.' },
  { slug: 'editing', title: 'Edit a graph document', group: 'Guides', intro: 'Give a person or an agent the same editing contract. Preview a batch, commit it against a known revision, and read back the result.' },
  { slug: 'api', title: 'API reference', group: 'Reference', intro: 'Find a package import, exported type, or method on a returned controller. This index is generated from the declarations shipped with Loom.' },
  { slug: 'roadmap', title: 'SDK roadmap', group: 'Reference', intro: 'These are proposed additions, in the order we would build them. Each addresses work an application has to do itself today.' },
]
export const chapterURL = slug => docsURL + (slug ? slug + '/' : '')
