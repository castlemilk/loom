import { useLayoutEffect, useRef } from 'react'

// A diagram of the recorded Music cluster. Every wire joins the endpoints of an archived link.
const labels = {
  Jazz: [-.78, -.38], Piano: [.58, -.65], 'Folk music': [.62, .40], 'Bluegrass music': [-.66, .63],
}
const pointPositions = (data, compact) => {
  const cx = compact ? 164 : 298, cy = compact ? 140 : 187
  const rx = compact ? 137 : 245, ry = compact ? 97 : 148
  const points = data.members.map(({ id, label }, i) => {
    const angle = i * 2.39996
    const radius = Math.sqrt((i + 1) / data.members.length)
    const [x, y] = labels[label] ?? [Math.cos(angle) * radius, Math.sin(angle) * radius]
    return { id, label, x: cx + x * rx, y: cy + y * ry }
  })
  return { cx, cy, points }
}

export function MusicMap({ data, compact, open, chosen }) {
  const canvas = useRef(null), progress = useRef(open ? 1 : 0)
  const { cx, cy, points } = pointPositions(data, compact)
  const jazz = points.find(p => p.label === 'Jazz')
  const width = compact ? 358 : 704, height = compact ? 282 : 354

  useLayoutEffect(() => {
    const ctx = canvas.current.getContext('2d')
    const lookup = new Map(points.map(p => [p.id, p]))
    const edges = data.edges.map(([a, b]) => [lookup.get(a), lookup.get(b)])
    const start = performance.now(), to = open ? 1 : 0
    const from = matchMedia('(prefers-reduced-motion: reduce)').matches ? to : progress.current
    let frame
    function draw(now) {
      const t = Math.min(1, (now - start) / 850)
      const p = from + (to - from) * (1 - (1 - t) ** 3)
      progress.current = p
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, width, height)
      // The other topic positions belong to the paper map, outside the expanding cluster.
      const art = compact ? [41, 39] : [87, 53], science = compact ? [299, 63] : [587, 73]
      for (const [x,y] of [art, science]) {
        ctx.strokeStyle = '#c0bcb0'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.quadraticCurveTo(x, cy, x, y); ctx.stroke()
      }
      for (const [at, title, color] of [[art,'Art','#a55f45'],[science,'Science','#49755d']]) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(at[0], at[1], 4, 0, 2*Math.PI); ctx.fill()
        ctx.font = '15px Georgia'; ctx.fillStyle = '#495448'; ctx.textAlign = 'center'; ctx.fillText(title, at[0], at[1]-12)
      }
      if (p > .001) {
        ctx.save(); ctx.translate(cx,cy); ctx.scale(p,p); ctx.translate(-cx,-cy)
        ctx.globalAlpha = p * .25; ctx.strokeStyle = '#836379'; ctx.lineWidth = .72
        ctx.beginPath()
        for (const [a,b] of edges) { ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y) }
        ctx.stroke()
        ctx.globalAlpha = .88 * p
        for (const point of points) {
          ctx.fillStyle = labels[point.label] ? '#734768' : '#ac8a9c'
          ctx.beginPath(); ctx.arc(point.x, point.y, labels[point.label] ? 4 : 2.25, 0, Math.PI*2); ctx.fill()
        }
        ctx.font = (compact ? '14' : '16') + 'px Georgia'
        for (const point of points.filter(p => labels[p.label])) {
          if (compact && point.label === 'Bluegrass music') continue
          ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#faf6e9'; ctx.lineJoin = 'round'
          ctx.strokeText(point.label, point.x, point.y - 10); ctx.fillStyle = '#423642'; ctx.fillText(point.label, point.x, point.y - 10)
        }
        if (chosen) {
          ctx.strokeStyle = '#78466c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(jazz.x,jazz.y,8,0,Math.PI*2); ctx.stroke()
        }
        ctx.restore()
      }
      if (t < 1 && from !== to) frame = requestAnimationFrame(draw)
    }
    draw(start)
    return () => cancelAnimationFrame(frame)
  }, [data, compact, open, chosen])
  return <div className="tour-map">
    <canvas ref={canvas} width={width*2} height={height*2} style={{ width, height }} />
    <span data-target="music" data-cursor="pointer" className="music-hub" style={{ left:cx, top:cy }}>Music</span>
    <span data-target="jazz" data-cursor="pointer" className="article-hit" style={{ left:jazz.x, top:jazz.y }} />
  </div>
}
