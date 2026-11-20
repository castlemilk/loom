'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createCardGraph } from '../../dist/cards.js'
import { homeURL } from '../site'

const colors = { partner: '#f0ebfa', person: '#f7efdf', startup: '#e9effe', article: '#e8f0ed' }
function portrait(data, root) {
  const others = data.nodes.filter((n) => n.id !== root),
    split = Math.ceil(others.length / 2)
  const slots = new Map([[root, { x: 0, y: 0 }]])
  for (const [half, group] of [others.slice(0, split), others.slice(split)].entries()) {
    group.forEach((node, i) => {
      const lastUnpaired = i === group.length - 1 && group.length % 2 === 1
      slots.set(node.id, {
        x: lastUnpaired ? 0 : i % 2 === 0 ? -112 : 112,
        y: (half === 0 ? -1 : 1) * (106 + Math.floor(i / 2) * 99),
      })
    })
  }
  return { ...data, nodes: data.nodes.map((n) => ({ ...n, ...slots.get(n.id) })) }
}
export function CardView({
  data,
  root,
  selected,
  onSelect,
  appearance = 'cards',
  labels = true,
  ports = true,
  arrows = false,
  useNodePositions = true,
  imageFor,
  name = 'Relationship cards',
}) {
  const svg = useRef(null),
    instance = useRef(null),
    pick = useRef(onSelect)
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 720px)'),
      update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  pick.current = onSelect
  useLayoutEffect(() => {
    const graph = createCardGraph(svg.current, compact ? portrait(data, root) : data, {
      root,
      appearance,
      showLabels: labels,
      showPorts: ports,
      showArrows: arrows,
      useNodePositions: compact || useNodePositions,
      image: imageFor ?? ((n) => (n.image ? homeURL + 'examples/' + n.image : undefined)),
      badge: (n) => n.kind,
      tint: (n) => colors[n.kind] ?? '#e8edf7',
      relationship: (e) => e.label ?? e.kind,
      onSelect: (n) => pick.current?.(n),
    })
    instance.current = graph
    return () => {
      graph.destroy()
      instance.current = null
    }
  }, [data, root, compact, imageFor, useNodePositions])
  useEffect(() => {
    instance.current?.setOptions({ appearance, showLabels: labels, showPorts: ports, showArrows: arrows })
  }, [appearance, labels, ports, arrows])
  useEffect(() => {
    instance.current?.select(selected ?? root)
  }, [selected, root, data, compact])
  return (
    <div className="atlas-card-stage">
      <svg ref={svg} className="atlas-card-svg" role="group" aria-label={name} />
      <div className="atlas-map-tools">
        <button type="button" aria-label="Zoom out" onClick={() => instance.current?.zoom(0.8)}>
          −
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => instance.current?.zoom(1.25)}>
          +
        </button>
        <button type="button" onClick={() => instance.current?.fit()}>
          Fit view
        </button>
      </div>
    </div>
  )
}
