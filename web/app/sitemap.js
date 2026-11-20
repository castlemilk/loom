import { chapters, chapterURL } from '../docs/catalog.js'
import { absoluteURL } from '../metadata.js'
import { homeURL, studioURL } from '../site.js'
import atlases from '../../demo/atlases/catalog.json'

export const dynamic = 'force-static'

export default function sitemap() {
  return [homeURL, studioURL, studioURL + 'wikispeedia/', studioURL + 'cards/', homeURL + 'artwork/',
    ...Object.keys(atlases).map(slug => homeURL + 'examples/' + slug + '/'),
    ...chapters.map(chapter => chapterURL(chapter.slug))].map(path => ({ url: absoluteURL(path) }))
}
