import { artURL, siteOrigin } from './site.js'

const wireImage = { url: artURL('wire-study-1280.webp'), width: 1280, height: 853, alt: 'A Loom graph model made of beads and wire.' }
export const atlasImage = { url: artURL('wikipedia-map.jpg'), width: 1080, height: 540, alt: 'Music and Science expanded in the Wikipedia topic map.' }
export const cardsImage = { url: artURL('canva-cards.jpg'), width: 1080, height: 540, alt: 'Relationship cards connecting Canva with its founders and investors.' }

export const absoluteURL = path => new URL(path, siteOrigin).href

export function pageMetadata({ title, description, path, image = wireImage, markdown }) {
  const url = absoluteURL(path)
  const preview = { ...image, url: absoluteURL(image.url) }
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url, ...(markdown && { types: { 'text/markdown': markdown } }) },
    openGraph: { type: 'website', siteName: 'Loom', url, title, description, images: [preview] },
    twitter: { card: 'summary_large_image', title, description, images: [preview] },
  }
}
