'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mountAtlasMap } from '../../../../dist/atlas-map.js'
import manifest from '../../../public/examples/wikispeedia/manifest.json'

const layoutKey = 'loom:wikispeedia:positions:' + manifest.database
const count = new Intl.NumberFormat('en')
function storedPositions() {
  try {
    return JSON.parse(localStorage.getItem(layoutKey)) ?? undefined
  } catch {
    return undefined
  }
}

// The atlas uses straight wires. Measure the distance to their visible segments in screen pixels.
function connectionAt({ x, y }, frame, scene, indices) {
  let closest = null,
    best = 25
  for (const link of scene.links) {
    if (link.sourceTopic === link.targetTopic) continue
    const a = indices.get(link.source) * 4,
      b = indices.get(link.target) * 4
    const ax = frame.points[a],
      ay = frame.points[a + 1],
      dx = frame.points[b] - ax,
      dy = frame.points[b + 1] - ay
    const length = dx * dx + dy * dy
    if (!length) continue
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
    const distance = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2
    if (distance < best) {
      best = distance
      closest = link
    }
  }
  return closest
}

export function TopicMap({
  atlas,
  snap,
  api,
  onPick,
  onConnection,
  keep,
  carry,
  selected,
  hidden,
  theme,
  pair,
  edge,
}) {
  const canvas = useRef(null),
    labels = useRef(new Map()),
    highlight = useRef(null),
    pick = useRef(onPick),
    pickConnection = useRef(onConnection)
  const drawing = useRef({}),
    cached = useRef({}),
    drag = useRef(null),
    suppress = useRef(false)
  const [error, setError] = useState('')
  pick.current = onPick
  pickConnection.current = onConnection
  drawing.current = { selected, edge }
  const displayTheme = useMemo(
    () =>
      pair
        ? {
            ...theme,
            wires: {
              ...theme.wires,
              resolve: (e) => {
                if (
                  e.kind === 'hyperlink' &&
                  e.sourceTopic !== e.targetTopic &&
                  pair.includes(e.sourceTopic) &&
                  pair.includes(e.targetTopic)
                )
                  return { color: '#b65632', opacity: 0.48, width: 1.1 }
                if (e.kind === 'hyperlink') return { opacity: 0.07 }
              },
            },
          }
        : theme,
    [theme, pair],
  )
  const paint = useCallback((frame, scene) => {
    if (cached.current.scene !== scene)
      cached.current = { scene, indices: new Map(scene.nodes.map((n, i) => [n.id, i])) }
    for (const [i, t] of manifest.topics.entries()) {
      const label = labels.current.get(t.id)
      if (!label) continue
      const x = frame.points[i * 4],
        y = frame.points[i * 4 + 1],
        r = frame.points[i * 4 + 2],
        margin = frame.width < 550 ? 42 : 67
      label.style.left = Math.min(frame.width - margin, Math.max(margin, x)) + 'px'
      label.style.top = y + r + 3 + 'px'
      label.hidden = x < 0 || y < 0 || x > frame.width || y > frame.height
      const ring = highlight.current?.querySelector('[data-topic-ring="' + t.id + '"]')
      if (ring) {
        ring.setAttribute('cx', x)
        ring.setAttribute('cy', y)
        ring.setAttribute('r', r + 3)
      }
    }
    const overlay = highlight.current
    if (!overlay) return
    const { selected, edge } = drawing.current
    const project = (id) => {
      const i = cached.current.indices.get(id)
      return i === undefined
        ? null
        : { x: frame.points[4 * i], y: frame.points[4 * i + 1], title: scene.nodes[i].label }
    }
    const from = edge && project('article:' + edge.source),
      to = edge && project('article:' + edge.target)
    const line = overlay.querySelector('[data-crossing-line]')
    line.style.display = from && to ? '' : 'none'
    if (from && to) {
      const dx = to.x - from.x,
        dy = to.y - from.y,
        length = Math.max(1, Math.hypot(dx, dy)),
        end = Math.min(7, length / 3) / length
      line.setAttribute('x1', from.x + dx * end)
      line.setAttribute('y1', from.y + dy * end)
      line.setAttribute('x2', to.x - dx * end)
      line.setAttribute('y2', to.y - dy * end)
    }
    for (const [name, p] of [
      ['source', from],
      ['target', to],
      ['selected', selected && project(selected)],
    ]) {
      const marker = overlay.querySelector('[data-map-marker="' + name + '"]')
      const caption = overlay.querySelector('[data-map-caption="' + name + '"]')
      marker.style.display = p ? '' : 'none'
      caption.style.display = p && p.x >= 0 && p.x <= frame.width && p.y >= 0 && p.y <= frame.height ? '' : 'none'
      if (p) {
        marker.setAttribute('cx', p.x)
        marker.setAttribute('cy', p.y)
        const toLeft = p.x > frame.width / 2
        caption.setAttribute('text-anchor', toLeft ? 'end' : 'start')
        caption.setAttribute('x', p.x + (toLeft ? -10 : 10))
        caption.setAttribute('y', Math.min(frame.height - 4, Math.max(13, p.y - 6)))
        const title = p.title.length > 30 ? p.title.slice(0, 29) + '…' : p.title
        if (caption.textContent !== title) caption.textContent = title
      }
    }
  }, [])
  useLayoutEffect(() => {
    let timer, pending
    function save() {
      if (!pending) return
      try {
        localStorage.setItem(layoutKey, JSON.stringify(pending))
      } catch {}
      pending = null
    }
    try {
      const map = mountAtlasMap(canvas.current, atlas, {
        theme: displayTheme,
        keepView: keep,
        moveMembers: carry,
        positions: storedPositions(),
        onPositionsChange: (positions) => {
          pending = positions
          clearTimeout(timer)
          timer = setTimeout(save, 160)
        },
        onPick: (n) => pick.current(n),
        onBackgroundClick: (point, frame, scene) => {
          if (point.clicks !== 1 || cached.current.scene !== scene) return
          const link = connectionAt(point, frame, scene, cached.current.indices)
          if (link) pickConnection.current(link)
        },
        onFrame: paint,
      })
      api.current = map
      window.addEventListener('pagehide', save)
      return () => {
        map.destroy()
        clearTimeout(timer)
        save()
        window.removeEventListener('pagehide', save)
        api.current = null
      }
    } catch (cause) {
      setError(cause.message)
    }
  }, [atlas, api, paint])
  useEffect(() => {
    api.current?.setKeepView(keep)
    api.current?.setMoveMembers(carry)
  }, [keep, carry, api])
  useEffect(() => {
    api.current?.setTheme(displayTheme)
  }, [displayTheme, api])
  useLayoutEffect(() => {
    const map = api.current
    if (map) {
      map.select(selected)
      paint(map.getFrame(), snap.scene)
    }
  }, [edge, selected, snap.scene, api, paint])
  function grab(event, id) {
    if (event.button !== 0 || !event.isPrimary || !api.current) return
    const position = api.current.getPosition('topic:' + id)
    drag.current = {
      pointer: event.pointerId,
      id,
      x: event.clientX,
      y: event.clientY,
      position,
      zoom: api.current.getViewport().zoom,
    }
    suppress.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event) {
    const d = drag.current
    if (!d || d.pointer !== event.pointerId) return
    const dx = event.clientX - d.x,
      dy = event.clientY - d.y
    if (!suppress.current && Math.hypot(dx, dy) < 4) return
    suppress.current = true
    api.current?.moveTopic(d.id, { x: d.position.x + dx / d.zoom, y: d.position.y + dy / d.zoom })
  }
  function keyMove(event, id) {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta || !api.current) return
    event.preventDefault()
    const p = api.current.getPosition('topic:' + id),
      step = (event.shiftKey ? 32 : 12) / api.current.getViewport().zoom
    api.current.moveTopic(id, { x: p.x + delta[0] * step, y: p.y + delta[1] * step })
  }
  return (
    <div className="atlas-map-surface" style={{ visibility: hidden ? 'hidden' : undefined }} aria-hidden={hidden}>
      <canvas
        ref={canvas}
        aria-label="Wikipedia topic map. Drag a topic to move it. Arrow keys on the background pan the map."
      />
      <svg ref={highlight} className="atlas-crossing-overlay" aria-hidden="true">
        {snap.expanded.map((id) => (
          <circle
            key={id}
            data-topic-ring={id}
            fill="none"
            stroke={manifest.topics[id].color}
            strokeWidth="1.2"
            strokeOpacity=".85"
          />
        ))}
        <defs>
          <marker
            id="wiki-link-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="#a23822" />
          </marker>
        </defs>
        <line
          data-crossing-line=""
          stroke="#a23822"
          strokeWidth="2.7"
          markerEnd="url(#wiki-link-arrow)"
          style={{ display: 'none' }}
        />
        {['source', 'target', 'selected'].map((n) => (
          <g key={n}>
            <circle
              data-map-marker={n}
              r="6"
              fill="none"
              stroke={n === 'selected' ? '#324e8d' : '#a23822'}
              strokeWidth="2"
              style={{ display: 'none' }}
            />
            <text data-map-caption={n} className="atlas-article-caption" style={{ display: 'none' }} />
          </g>
        ))}
      </svg>
      {error ? (
        <p className="atlas-graph-error" role="alert">
          {error} Use the topics list to explore.
        </p>
      ) : (
        manifest.topics.map((t) => {
          const opened = snap.expanded.includes(t.id)
          return (
            <button
              type="button"
              key={t.id}
              ref={(el) => {
                if (el) labels.current.set(t.id, el)
                else labels.current.delete(t.id)
              }}
              className="atlas-map-label"
              data-map-topic={t.id}
              aria-pressed={opened}
              aria-label={(opened ? 'Close ' : 'Open ') + t.label + ' on map'}
              title={'Drag ' + t.label + ' to move it. Click to ' + (opened ? 'collapse' : 'expand') + '.'}
              onPointerDown={(e) => grab(e, t.id)}
              onPointerMove={move}
              onPointerUp={() => {
                drag.current = null
              }}
              onPointerCancel={() => {
                drag.current = null
              }}
              onLostPointerCapture={() => {
                drag.current = null
              }}
              onKeyDown={(e) => keyMove(e, t.id)}
              onClick={(e) => {
                if (!e.detail || !suppress.current) onPick({ kind: 'topic', topic: t.id })
                suppress.current = false
              }}
            >
              <span>{t.label}</span>
              <small>
                {count.format(t.count)} <b aria-hidden="true">{opened ? '−' : '+'}</b>
              </small>
            </button>
          )
        })
      )}
    </div>
  )
}
