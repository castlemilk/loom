// Public canonical routes. Query-selected examples are Studio state, not separate pages.
export const collectionSlugs = ['bauhaus', 'outer-solar-system']
export const publicPagePaths = ['', 'artwork/', 'studio/', 'studio/cards/', 'studio/wikispeedia/', 'mcp/',
  ...collectionSlugs.map(slug => 'examples/' + slug + '/')]
