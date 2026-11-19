// A reproducible sparse graph: local connections, hubs, and cross-cluster links.
const groups = ['Signal', 'Field', 'Orbit', 'Flux', 'Phase', 'Wave']
const kinds = ['concept', 'blog', 'lab', 'tag', 'study', 'category']
export function fixture(count, positioned = false, linksPerNode = 4) {
  let seed = 42027
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const nodes = Array.from({ length: count }, (_, i) => {
    const kind = i % 24 === 0 ? 0 : 1 + (i % 5)
    const n = { id: 'n' + i, kind: kinds[kind], label: groups[i % 6] + ' ' + (i + 1) }
    if (positioned) {
      if (positioned === 'seeded') n.pinned = false
      const r = Math.sqrt(i) * 14,
        a = i * Math.PI * (3 - Math.sqrt(5))
      n.x = Math.cos(a) * r
      n.y = Math.sin(a) * r
      n.z = (random() - 0.5) * Math.sqrt(count) * 6
    }
    return n
  })
  const links = []
  for (let i = 0; i < count; i++)
    for (let e = 0; e < linksPerNode; e++) {
      let target =
        e === 0
          ? (i + 1) % count
          : e === 1
            ? i - (i % 24)
            : e === 2
              ? Math.max(0, i - Math.floor(random() * 48))
              : Math.floor(random() * count)
      if (target === i) target = (i + 1) % count
      links.push({ source: nodes[i].id, target: nodes[target].id })
    }
  return { nodes, links }
}
