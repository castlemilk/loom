import { createWikipediaImages } from 'loom-core/wikipedia-images'

export function createArticleInspector() {
  const images = createWikipediaImages()
  let selection = 0

  return {
    async show(title: string, container: HTMLElement) {
      const current = ++selection
      container.replaceChildren()
      const photo = await images.lookup(title)
      if (!photo || current !== selection) return

      const image = new Image()
      image.alt = 'Wikipedia lead image for ' + photo.title
      image.decoding = 'async'
      image.src = photo.src
      const credit = document.createElement('a')
      credit.href = photo.fileUrl
      credit.textContent = 'Image credits'
      try {
        await image.decode()
        if (current === selection) container.replaceChildren(image, credit)
      } catch { /* Keep the article text available if the image fails to load. */ }
    },
    close() { selection++; images.cancel() },
  }
}
