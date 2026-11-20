'use client'

import { useEffect, useRef, useState } from 'react'
import { showCanva } from '../../docs/examples/cards'

export function CardPreview() {
  const svg = useRef(null), [cards, setCards] = useState(null)
  useEffect(() => {
    const instance = showCanva(svg.current)
    setCards(instance)
    return () => instance.destroy()
  }, [])
  return <figure className="docs-preview docs-card-preview">
    <div className="docs-preview-bar"><figcaption>Around Canva</figcaption></div>
    <svg ref={svg} aria-label="Canva, its founder, and an investor" />
    <div className="docs-preview-foot"><span>3 cards · 2 relationships</span>
      <button type="button" disabled={!cards} onClick={() => cards?.fit()}>Fit view</button></div>
  </figure>
}
