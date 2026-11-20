'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cardNeighborhood } from '../../dist/cards.js'
import { CardView } from './card-view'
import { imageURL } from './workload.mjs'
import './atlas.css'

export default function StudioCardDialog({ data, root, close, inspect }) {
  const dialog = useRef(null)
  const [selected, setSelected] = useState(root)
  const cards = useMemo(() => cardNeighborhood(data, root), [data, root])
  const focus = cards.nodes.find((n) => n.id === root)
  const current = cards.nodes.find((n) => n.id === selected) ?? focus
  const imageFor = useCallback((n) => imageURL(data, n, process.env.NEXT_PUBLIC_BASE_PATH), [data])
  useLayoutEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  return (
    <dialog
      className="studio-card-dialog"
      ref={dialog}
      aria-labelledby="card-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="card-dialog-bar">
        <h2 id="card-dialog-title">Around {focus.label ?? root}</h2>
        <button type="button" autoFocus onClick={close}>
          Close
        </button>
      </div>
      <CardView
        data={cards}
        root={root}
        selected={current.id}
        onSelect={(n) => setSelected(n.id)}
        useNodePositions={false}
        imageFor={imageFor}
        arrows
      />
      <div className="card-dialog-bar">
        <span>
          {cards.nodes.length - 1} neighbors · {cards.links.length} connections
        </span>
        <button type="button" onClick={() => inspect(current.id)}>
          Inspect {current.label ?? current.id}
        </button>
      </div>
    </dialog>
  )
}
