import { chapters, chapterURL } from '../docs/catalog.js'
import { absoluteURL } from '../metadata.js'
import { homeURL, studioURL } from '../site.js'

export const dynamic = 'force-static'

export default function sitemap() {
  return [homeURL, studioURL, studioURL + 'wikispeedia/', studioURL + 'cards/', homeURL + 'artwork/',
    ...chapters.map(chapter => chapterURL(chapter.slug))].map(path => ({ url: absoluteURL(path) }))
}
