import type { Model } from '../model.js'

/** A selected or highest-degree centre, two neighbourhood rings, then the remaining nodes. */
export function orbitTargets(model: Pick<Model, 'n' | 'endpoints' | 'positions' | 'byId'>, selected: number, gap = 80) {
  const { n, endpoints, positions, byId } = model
  const targets = new Float32Array(n * 3)
  if (!n) return targets
  const ids = [...byId.keys()]
  let centre = selected
  if (centre < 0) {
    const degree = new Uint32Array(n)
    for (const endpoint of endpoints) degree[endpoint]++
    centre = 0
    for (let i = 1; i < n; i++) {
      if (degree[i] > degree[centre] || (degree[i] === degree[centre] && ids[i] < ids[centre])) centre = i
    }
  }
  const hops = new Uint8Array(n).fill(3)
  hops[centre] = 0
  for (let hop = 1; hop <= 2; hop++) {
    for (let k = 0; k < endpoints.length; k += 2) {
      const a = endpoints[k], b = endpoints[k + 1]
      if (hops[a] === hop - 1 && hops[b] > hop) hops[b] = hop
      if (hops[b] === hop - 1 && hops[a] > hop) hops[a] = hop
    }
  }
  const rings: number[][] = [[], [], [], []]
  hops.forEach((hop, i) => rings[hop].push(i))
  const x = positions[centre * 4], y = positions[centre * 4 + 1]
  let radius = 0
  for (let hop = 0; hop < rings.length; hop++) {
    const members = rings[hop]
    if (hop) radius = Math.max(radius + gap, members.length * 12 / (2 * Math.PI))
    members.sort((a, b) => ids[a] < ids[b] ? -1 : 1)
    members.forEach((i, k) => {
      const angle = 2 * Math.PI * k / members.length - Math.PI / 2
      targets[i * 3] = x + radius * Math.cos(angle)
      targets[i * 3 + 1] = y + radius * Math.sin(angle)
    })
  }
  return targets
}
