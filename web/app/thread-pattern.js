export const patterns = [
  { name: 'Rosette', count: 36, skip: 13, trySkip: 3, color: '#ae4c2e' },
  { name: 'Star', count: 7, skip: 3, trySkip: 1, color: '#795178' },
  { name: 'Halo', count: 48, skip: 5, trySkip: 17, color: '#387068' },
]

// Shared with the isolated editor worker. Keep this helper self-contained.
export function ring(count) {
  if (!Number.isInteger(count) || count < 0 || count > 256)
    throw new RangeError('ring() takes a whole number from 0 to 256.')
  return Array.from({ length: count }, (_, i) => {
    const angle = 2 * Math.PI * i / count
    return { id: String(i + 1), label: 'Pin ' + (i + 1), x: 120 * Math.sin(angle), y: -120 * Math.cos(angle) }
  })
}

export function patternSource({ count, skip, color }) {
  return `function pattern(ring) {
  const pins = ring(${count})
  const skip = ${skip}
  const color = '${color}'

  const links = pins.map((pin, i) => ({
    source: pin.id,
    target: pins[(i + skip) % pins.length].id
  }))

  return { nodes: pins, links, color }
}`
}

export function startingPattern() {
  const { count, skip, color } = patterns[0]
  const nodes = ring(count)
  return { nodes, links: nodes.map((pin, i) => ({ source: pin.id, target: nodes[(i + skip) % count].id })), color }
}

const hex = /^#(?:[\da-f]{3}|[\da-f]{6})$/i

export function readPattern(value) {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.links))
    throw new TypeError('Return an object with nodes and links arrays.')
  if (value.nodes.length > 256 || value.links.length > 2048)
    throw new RangeError('This pinboard fits up to 256 nodes and 2,048 links.')
  const color = value.color === undefined ? patterns[0].color : value.color
  if (typeof color !== 'string' || !hex.test(color)) throw new TypeError('Use a hex thread color, such as #ae4c2e.')
  const ids = new Set()
  const positions = ring(value.nodes.length)
  const nodes = Array.from(value.nodes, (node, i) => {
    if (typeof node?.id !== 'string' || !node.id.trim()) throw new TypeError('Give each node a text id.')
    if (ids.has(node.id)) throw new TypeError('Two nodes share the id “' + node.id + '”.')
    ids.add(node.id)
    const x = node.x ?? positions[i].x, y = node.y ?? positions[i].y
    if (![x, y].every(v => Number.isFinite(v) && Math.abs(v) <= 1e6)) throw new TypeError('Check the coordinates of “' + node.id + '”.')
    if (node.label !== undefined && typeof node.label !== 'string') throw new TypeError('Use a text label for “' + node.id + '”.')
    return { id: node.id, label: node.label ?? node.id, x, y }
  })
  const links = Array.from(value.links, link => {
    for (const id of [link?.source, link?.target]) {
      if (!ids.has(id)) throw new TypeError('A link points to “' + String(id) + '”. Give it an existing node id.')
    }
    return { source: link.source, target: link.target }
  })
  return { nodes, links, color }
}
