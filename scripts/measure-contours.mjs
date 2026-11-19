import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'

await build({ entryPoints: ['src/group-outline.ts'], outfile: '.test-build/contours.mjs', platform: 'node', format: 'esm' })
const { cloudOutline, cacheOutline } = await import('../.test-build/contours.mjs')
const total = 25000, groups = 32, samples = 100
const original = new Float32Array(total * 4)
const memberships = Array.from({ length: groups }, () => [])
for (let i = 0; i < total; i++) {
  const group = i % groups, angle = i * 2.39996323, r = 3.7 * Math.sqrt(Math.floor(i / groups))
  original.set([100 + (group % 8)*160 + Math.cos(angle)*r, 100 + Math.floor(group/8)*165 + Math.sin(angle)*r, 3 + i%5, 0], i*4)
  memberships[group].push(i)
}
function measure(cached, movingGroups) {
  const points = original.slice()
  const paths = memberships.map((members) => cached ? cacheOutline(cloudOutline, members, 10) : (p) => cloudOutline(p, members, 10))
  const times = []
  let rebuilt = 0
  for (let frame = -10; frame < samples; frame++) {
    for (let i = 0; i < movingGroups; i++) points[i*4] += 1
    const start = performance.now()
    let changed = 0
    for (const path of paths) if (path(points) !== undefined) changed++
    const elapsed = performance.now()-start
    if (frame >= 0) { times.push(elapsed); rebuilt += changed }
  }
  times.sort((a,b) => a-b)
  return { movingGroups, cached, rebuilt, medianMs: +times[50].toFixed(2), p95Ms: +times[95].toFixed(2) }
}
console.log('Contour CPU time across 100 frames with 25,000 projected nodes in 32 groups')
console.table([1, 32].flatMap((moving) => [false, true].map((cached) => measure(cached, moving))))
