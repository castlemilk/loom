import { artURL, siteOrigin } from './site.js'

export const brandImage = { url: artURL('loom-social.jpg'), width: 1200, height: 630, type: 'image/jpeg',
  alt: 'Loom. Interactive graphs in TypeScript. A copper wire network connects ivory and terracotta joints.' }
export const atlasImage = { url: artURL('wikipedia-map.jpg'), width: 1080, height: 540, alt: 'Music and Science expanded in the Wikipedia topic map.' }
export const cardsImage = { url: artURL('canva-cards.jpg'), width: 1080, height: 540, alt: 'Relationship cards connecting Canva with its founders and investors.' }

export const absoluteURL = path => new URL(path, siteOrigin).href

export function pageMetadata({ title, description, path, image = brandImage, markdown = path + 'index.md' }) {
  const url = absoluteURL(path)
  const preview = { ...image, url: absoluteURL(image.url) }
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url, types: { 'text/markdown': absoluteURL(markdown) } },
    openGraph: { type: 'website', siteName: 'Loom', url, title, description, images: [preview] },
    twitter: { card: 'summary_large_image', title, description, images: [preview] },
  }
}
