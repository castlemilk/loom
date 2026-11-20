import { useEffect, useState } from 'react'

export function useArticleImages(source, titles) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!source || !titles.length) return
    let current = true
    Promise.all(titles.map(async title => [title, await source.lookup(title)])).then(entries => {
      if (current) setResult({ source, titles, images: new Map(entries) })
    })
    return () => { current = false }
  }, [source, titles])
  return source && result?.source === source && result.titles === titles ? result.images : null
}

export function ArticlePhoto({ photo }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <a className="wiki-article-photo" href={photo.fileUrl} target="_blank" rel="noreferrer">
      <img src={photo.src} width={photo.width} height={photo.height} decoding="async"
        alt={'Wikipedia lead image for ' + photo.title} onError={() => setFailed(true)} />
      <span>Image credits ↗</span>
    </a>
  )
}
