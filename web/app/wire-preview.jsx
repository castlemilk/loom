import { useLayoutEffect, useId, useMemo, useRef } from 'react'

function pathBetween(a, b, route, vertical, loop) {
  const [x, y, r] = a, [u, v] = b
  const start = 'M' + x + ' ' + y, end = ' ' + u + ' ' + v
  if (loop) {
    const radius = Math.max(7, r)
    return start + 'C' + [x-2*radius, y-3*radius, x+2*radius, y-3*radius].join(' ') + end
  }
  if (route === 'straight') return start + 'L' + end
  const dx = u - x, dy = v - y, mx = x + dx / 2, my = y + dy / 2
  const controls = route === 'patch'
    ? (vertical ? [x, my, u, my] : [mx, y, mx, v])
    : [x+.29*dx-.17*dy, y+.29*dy+.17*dx, x+.71*dx-.17*dy, y+.71*dy+.17*dx]
  return start + 'C' + controls.join(' ') + end
}

// The overlay borrows the graph's projected points, including its camera and layout.
export function WirePreview({ graph, canvas, nodes, ends, route, accent, background }) {
  const pathId = useId()
  const svg = useRef(null), line = useRef(null), ring = useRef(null)
  const pointer = useRef(null), hovered = useRef(null)
  const index = useMemo(() => new Map(nodes.map((node, i) => [node.id, 4 * i])), [nodes])
  useLayoutEffect(() => {
    const element = canvas.current
    if (!graph || !element) return
    let frame = graph.getFrame()
    function paint() {
      const points = frame.points
      const source = index.get(ends?.source)
      const target = index.get(ends?.target || (pointer.current && hovered.current))
      const b = target === undefined ? pointer.current : points.subarray(target, target + 3)
      const active = source !== undefined && !!b
      svg.current.toggleAttribute('data-active', active)
      svg.current.toggleAttribute('data-snapped', active && target !== undefined)
      if (!active) return
      const a = points.subarray(source, source + 3)
      line.current.setAttribute('d', pathBetween(a, b, route, frame.vertical, source === target))
      ring.current.setAttribute('cx', b[0])
      ring.current.setAttribute('cy', b[1])
      ring.current.setAttribute('r', target === undefined ? 3 : b[2] + 4)
    }
    const offFrame = graph.onFrame((next) => { frame = next; paint() })
    const offHover = graph.on('hover', (id) => { hovered.current = id; paint() })
    function move(event) {
      const rect = element.getBoundingClientRect()
      pointer.current = [event.clientX - rect.left, event.clientY - rect.top]
      paint()
    }
    function leave() { pointer.current = hovered.current = null; paint() }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerleave', leave)
    element.addEventListener('pointercancel', leave)
    paint()
    return () => {
      offFrame(); offHover()
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('pointercancel', leave)
    }
  }, [canvas, graph, index, ends, route])
  return <svg ref={svg} aria-hidden="true" className="wire-preview" style={{ color: accent }}>
    <defs><path ref={line} id={pathId}/></defs>
    <g fill="none" strokeLinecap="round">
      <use href={'#' + pathId} stroke={background} strokeWidth="4"/>
      <use href={'#' + pathId} stroke="currentColor" strokeWidth="2" strokeDasharray="6 4"/>
      <circle ref={ring} stroke="currentColor" strokeWidth="1.5"/>
    </g>
  </svg>
}
