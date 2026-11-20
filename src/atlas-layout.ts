import type { AtlasLink, AtlasTopic } from './atlas.js'
import { defaultForces, makeTargets } from './constraints.js'
import { cloudTargets } from './sim/cloud.js'
import { Layout } from './sim/layout.js'
import { orbitTargets } from './sim/orbit.js'

export const atlasLayouts = ['published', 'drift', 'lanes', 'orbit', 'cloud'] as const
export type AtlasLayout = (typeof atlasLayouts)[number]
export type PlacedTopic = AtlasTopic & { z?: number }

// Only topic hubs participate. Opening an article block never changes these anchors.
export function placeAtlasTopics(
  topics: readonly AtlasTopic[],
  links: readonly AtlasLink[],
  layout: AtlasLayout,
): readonly PlacedTopic[] {
  if (!atlasLayouts.includes(layout)) throw new RangeError('Unknown atlas layout: ' + layout)
  if (layout === 'published' || !topics.length) return topics
  const nodes = topics.map((t) => ({ id: 'topic:' + t.id }))
  const n = nodes.length
  let anchors: Float32Array
  if (layout === 'cloud') {
    // Keep clusters spaced in the opening view while giving them real depth as the camera turns.
    const spread = nodes.map((node, i) => {
      const angle = i * Math.PI * (3 - Math.sqrt(5)),
        radius = 100 * Math.sqrt(i)
      return { ...node, x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
    })
    anchors = cloudTargets(spread, { cloudDepth: 2 })
  } else if (layout === 'lanes') {
    const ranked = [...topics].sort((a, b) => b.count - a.count || a.id - b.id)
    const lanes = new Map(
      ranked.map((t, rank) => [t.id, String(Math.floor((rank * Math.ceil(Math.sqrt(n / 2))) / n))]),
    )
    anchors = makeTargets(nodes, {
      laneBy: (_, i) => lanes.get(topics[i].id)!,
      direction: 'vertical',
      laneGap: 190,
      rowGap: 180,
    })
  } else {
    const byId = new Map(nodes.map((node, i) => [node.id, i]))
    const endpoints = Uint32Array.from(links.flatMap((edge) => [byId.get(edge.source)!, byId.get(edge.target)!]))
    const positions = new Float32Array(n * 4)
    if (layout === 'orbit') {
      anchors = orbitTargets({ n, positions, byId, endpoints }, -1, 165)
      // The inner ring has to accommodate whole clusters. Orient the outer rings across the board.
      for (let k = 0; k < anchors.length; k += 3) {
        const x = anchors[k],
          y = anchors[k + 1],
          radius = Math.hypot(x, y)
        if (!radius) continue
        const scale = 1 + 160 / radius
        anchors[k] = -y * scale
        anchors[k + 1] = x * scale
      }
    } else {
      topics.forEach((t, i) => positions.set([t.x, t.y, 0, 72], i * 4))
      const data = { n, positions, endpoints, fixed: new Uint8Array(n), lanes: new Float32Array(n) }
      const simulation = new Layout(data, 'drift', { ...defaultForces, repulsion: 3, linkDistance: 100 })
      simulation.advance(Infinity)
      return topics.map((t, i) => ({ ...t, x: positions[i * 4], y: positions[i * 4 + 1] }))
    }
  }
  return topics.map((t, i) => ({ ...t, x: anchors[i * 3], y: anchors[i * 3 + 1], z: anchors[i * 3 + 2] }))
}
