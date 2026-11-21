import { chapters, chapterURL } from '../docs/catalog.js'
import { absoluteURL } from '../metadata.js'
import { homeURL } from '../site.js'
import { publicPagePaths } from '../public-pages.js'

export const dynamic = 'force-static'

export default function sitemap() {
  return [...publicPagePaths.map(path => homeURL + path),
    ...chapters.map(chapter => chapterURL(chapter.slug))].map(path => ({ url: absoluteURL(path) }))
}
