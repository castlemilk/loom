'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mountAtlasMap } from '../../../../dist/atlas-map.js'
import manifest from '../../../public/examples/wikispeedia/manifest.json'
import { mountNodePhotos } from './node-photos'

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

// At oblique angles several topic dots can project close together. Try the four sides of each
// dot and reserve the open topics' captions first. Measurements only change with the viewport.
function arrangeLabels(frame, labels, sizes, scene, selectedIndex) {
  if (sizes.width !== frame.width) {
    sizes.width = frame.width
    sizes.byId.clear()
  }
  const result = new Map(),
    occupied = [],
    visible = []
  if (selectedIndex !== undefined) {
    const x = frame.points[selectedIndex * 4], y = frame.points[selectedIndex * 4 + 1]
    const width = 12 + Math.min(30, scene.nodes[selectedIndex].label.length) * 8
    // Leave the selected marker and its caption readable and available for a second click.
    occupied.push(x > frame.width / 2 ? [x - width, y - 22, x + 7, y + 7] : [x - 7, y - 22, x + width, y + 7])
  }
  manifest.topics.forEach((topic, i) => {
    const label = labels.get(topic.id),
      k = i * 4
    const x = frame.points[k],
      y = frame.points[k + 1],
      r = frame.points[k + 2] + 3
    if (!label || x < 0 || x > frame.width || y < 0 || y > frame.height) return
    if (!sizes.byId.has(topic.id) && label.offsetWidth)
      sizes.byId.set(topic.id, [label.offsetWidth, label.offsetHeight])
    const [w, h] = sizes.byId.get(topic.id) ?? [80, 30]
    occupied.push([x - r, y - r, x + r, y + r])
    visible.push({ id: topic.id, x, y, r, w, h, open: label.getAttribute('aria-pressed') === 'true' })
  })
  visible.sort((a, b) => Number(b.open) - Number(a.open))
  for (const { id, x, y, r, w, h } of visible) {
    let best,
      least = Infinity
    for (const [cx, top] of [
      [x, y + r],
      [x, y - r - h],
      [x + r + w / 2, y - h / 2],
      [x - r - w / 2, y - h / 2],
    ]) {
      const left = Math.max(0, Math.min(frame.width - w, cx - w / 2)),
        y0 = Math.max(0, Math.min(frame.height - h, top))
      const right = left + w,
        bottom = y0 + h
      let overlap = 0
      for (const [l, t, rr, b] of occupied)
        overlap +=
          Math.max(0, Math.min(rr, right) - Math.max(l, left)) * Math.max(0, Math.min(b, bottom) - Math.max(t, y0))
      if (overlap < least) {
        least = overlap
        best = [left, y0, right, bottom]
        if (!overlap) break
      }
    }
    occupied.push(best)
    result.set(id, [(best[0] + best[2]) / 2, best[1]])
  }
  return result
}

export function TopicMap({
  atlas,
  snap,
  api,
  onPick,
  onOpen,
  onConnection,
  keep,
  animate,
  speed,
  active,
  images,
  onFollow,
  carry,
  memberMotion,
  spring,
  selected,
  hidden,
  theme,
  pair,
  edge,
}) {
  const canvas = useRef(null),
    labels = useRef(new Map()),
    highlight = useRef(null),
    photoLayer = useRef(null),
    photos = useRef(null),
    pick = useRef(onPick),
    open = useRef(onOpen),
    pickConnection = useRef(onConnection)
  const drawing = useRef({}),
    cached = useRef({}),
    labelSizes = useRef({ width: 0, byId: new Map() }),
    drag = useRef(null),
    suppress = useRef(false)
  const [error, setError] = useState('')
  pick.current = onPick
  open.current = onOpen
  pickConnection.current = onConnection
  drawing.current = { selected, edge, active, layout: snap.layout }
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
    const selectedIndex = cached.current.indices.get(drawing.current.selected)
    const positions = drawing.current.layout === 'published' ? null
      : arrangeLabels(frame, labels.current, labelSizes.current, scene, selectedIndex)
    for (const [i, t] of manifest.topics.entries()) {
      const label = labels.current.get(t.id)
      if (!label) continue
      const x = frame.points[i * 4],
        y = frame.points[i * 4 + 1],
        r = frame.points[i * 4 + 2],
        margin = frame.width < 550 ? 42 : 67
      const pos = positions?.get(t.id)
      label.style.left = (pos?.[0] ?? Math.min(frame.width - margin, Math.max(margin, x))) + 'px'
      label.style.top = (pos?.[1] ?? y + r + 3) + 'px'
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
    const moving = !!api.current?.isAnimatingLayout()
    if (overlay.parentElement.dataset.layoutMoving !== String(moving)) overlay.parentElement.dataset.layoutMoving = String(moving)
    photos.current?.paint(frame, scene, cached.current.indices, drawing.current.active, drawing.current.selected, moving)
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
  }, [api])
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
        animateLayouts: animate,
        layoutSpeed: speed,
        onFollowChange: onFollow,
        moveMembers: carry,
        memberMotion,
        spring,
        positions: storedPositions(),
        onPositionsChange: (positions) => {
          pending = positions
          clearTimeout(timer)
          timer = setTimeout(save, 160)
        },
        onPick: (n) => pick.current(n),
        onOpen: (n) => open.current(n),
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
    api.current?.setMemberMotion(memberMotion)
  }, [keep, carry, memberMotion, api])
  useLayoutEffect(() => {
    api.current?.setAnimateLayouts(animate)
  }, [animate, api])
  useLayoutEffect(() => {
    api.current?.setLayoutSpeed(speed)
  }, [speed, api])
  useLayoutEffect(() => {
    if (!images || hidden) return
    photos.current = mountNodePhotos(photoLayer.current, images)
    if (api.current) paint(api.current.getFrame(), atlas.getSnapshot().scene)
    return () => {
      photos.current.destroy()
      photos.current = null
    }
  }, [images, hidden, api, atlas, paint])
  useEffect(() => {
    api.current?.setSpring(spring)
  }, [spring, api])
  useEffect(() => {
    api.current?.setTheme(displayTheme)
  }, [displayTheme, api])
  useLayoutEffect(() => {
    const map = api.current
    if (map) {
      map.select(selected)
      paint(map.getFrame(), snap.scene)
    }
  }, [edge, selected, active, snap.scene, api, paint])
  function grab(event, id) {
    if (event.button !== 0 || !event.isPrimary || !api.current) return
    drag.current = {
      pointer: event.pointerId,
      id,
      x: event.clientX,
      y: event.clientY,
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
    api.current?.moveTopicByScreen(d.id, dx, dy)
    d.x = event.clientX
    d.y = event.clientY
  }
  function keyMove(event, id) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!event.repeat) api.current?.open('topic:' + id)
      return
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta || !api.current) return
    event.preventDefault()
    const step = event.shiftKey ? 32 : 12
    api.current.moveTopicByScreen(id, delta[0] * step, delta[1] * step)
  }
  return (
    <div className="atlas-map-surface" style={{ visibility: hidden ? 'hidden' : undefined }} aria-hidden={hidden}>
      <canvas
        ref={canvas}
        aria-label={
          'Wikipedia topic map. Double-click or double-tap a node to focus it. Drag a topic to move it. Arrow keys on the background ' +
          (snap.layout === 'cloud' ? 'rotate' : 'pan') +
          ' the map.'
        }
      />
      <div className="wiki-node-photos" aria-hidden="true" ref={photoLayer} />
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
              title={'Click to ' + (opened ? 'collapse' : 'expand') + '. Double-click or press Enter to focus. Drag or use arrow keys to move.'}
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
                if (!e.detail) onPick({ kind: 'topic', topic: t.id })
                else if (e.detail === 2 && !suppress.current) api.current?.open('topic:' + t.id)
                else if (!suppress.current) api.current?.pick('topic:' + t.id)
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
