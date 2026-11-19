export const imagePoolSize = 256
export const maxNodes = 25000, maxLinks = 100000
export const presets = {
  mixed: { label: 'Mixed notebook', nodes: 180, degree: 4, coverage: 35, variety: 24, text: 'notes', topology: 'clusters' },
  images: { label: 'Image atlas', nodes: 1024, degree: 2, coverage: 100, variety: 256, text: 'notes', topology: 'clusters' },
  articles: { label: 'Long-form library', nodes: 1000, degree: 3, coverage: 30, variety: 64, text: 'articles', topology: 'random' },
  hubs: { label: 'Dense hubs', nodes: 5000, degree: 12, coverage: 5, variety: 16, text: 'labels', topology: 'hubs' },
  scale: { label: '25k nodes / 100k links', nodes: 25000, degree: 4, coverage: 0, variety: 8, text: 'labels', topology: 'clusters' },
}
export const initialWorkload = { ...presets.mixed, seed: 42027 }
const subjects = ['Optical field', 'Tidal basin', 'Wave packet', 'Lunar surface', 'Cell membrane', 'Magnetic flux', 'River delta', 'Resonant cavity']
const methods = ['spectrum', 'section', 'field notes', 'phase study', 'atlas', 'transect', 'survey', 'time series']
const kinds = ['lab', 'study', 'blog', 'concept', 'tag']
const relations = ['concept', 'tag', 'reference']
export function randomSource(seed) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
}
function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw Error(name + ' must be a whole number from ' + min + ' to ' + max + '.')
}
export function buildWorkload(config, positioned = false, prefix = '') {
  const { nodes: count, degree, seed, coverage, variety, topology, text } = config
  integer(count, 1, maxNodes, 'Node count')
  integer(degree, 0, 16, 'Links per node')
  integer(seed, 0, 4294967295, 'Seed')
  integer(coverage, 0, 100, 'Image coverage')
  integer(variety, 1, imagePoolSize, 'Image variety')
  if (!['clusters', 'random', 'hubs'].includes(topology) || !['labels', 'notes', 'articles'].includes(text)) throw Error('Unknown workload option.')
  const outgoing = Math.min(count - 1, degree)
  if (count * outgoing > maxLinks) throw Error('This workload exceeds 100,000 links. Reduce nodes or links per node.')
  const words = randomSource(seed ^ 0x479bf45), art = randomSource(seed ^ 0x9e3779b9), edges = randomSource(seed ^ 0x85ebca6b)
  const artwork = {}, links = [], nodes = [], id = (i) => prefix + 'n' + i
  for (let i = 0; i < count; i++) {
    const block = Math.floor(i / 24) * 24
    const subject = subjects[Math.floor(words() * subjects.length)], method = methods[Math.floor(words() * methods.length)]
    const label = subject + ' ' + method + ' ' + (i + 1), kind = i === block ? 'category' : kinds[Math.floor(words() * kinds.length)]
    const node = { id: id(i), kind, label, topics: [subject, method] }
    const reading = Math.round(words() * 800 + 150), section = Math.floor(words() * 9) + 1
    if (text !== 'labels') {
      const summary = 'Field series ' + reading + ' traces changes in the ' + subject.toLowerCase() + ' across section ' + section + '.'
      node.summary = summary
      if (text === 'articles') node.content = summary + '\n\n' + [
        'The first pass records the outline at low resolution. Repeated samples bring the smaller features into view, particularly near the boundary of the section.',
        'Compare the neighbouring entries in this series to follow the changing pattern. The linked ' + method + ' records a second view of the same synthetic observation.',
        'The accompanying catalogue groups these measurements by subject and method. Each entry retains its own image, caption and relationship to the wider collection.',
      ].join('\n\n')
    }
    const draw = art(), slot = (Math.floor(art() * variety) + seed % imagePoolSize) % imagePoolSize
    if (draw * 100 < coverage) {
      node.art = 'specimen-' + slot
      artwork[node.art] = 'graphs/specimens/v1/' + slot + '.webp'
    }
    if (positioned) {
      const angle = i * 2.3999632297, radius = 14 * Math.sqrt(i)
      node.x = radius * Math.cos(angle); node.y = radius * Math.sin(angle)
      node.z = Math.sin(i * 1.7549) * Math.sqrt(count) * 10
      node.pinned = positioned !== 'seeded'
    }
    nodes.push(node)
    const seen = new Set()
    for (let j = 0; j < outgoing; j++) {
      const r = edges()
      let target = Math.floor(r * count)
      if (topology === 'clusters' && j < 3) target = j === 0 ? block : block + Math.floor(r * Math.min(24, count - block))
      if (topology === 'hubs' && j < Math.ceil(outgoing / 2)) target = Math.floor(r * Math.max(1, Math.ceil(count / 80))) * 24
      while (target === i || seen.has(target)) target = (target + 1) % count
      seen.add(target)
      links.push({ source: node.id, target: id(target), kind: target % 24 === 0 ? 'category' : relations[j % relations.length] })
    }
  }
  return { nodes, links, artwork }
}

export function mergeWorkload(current, config) {
  if (current.nodes.length + config.nodes > maxNodes || current.links.length + config.nodes * Math.min(config.nodes - 1, config.degree) + (current.nodes.length ? 1 : 0) > maxLinks)
    throw Error('The combined graph exceeds 25,000 nodes or 100,000 links.')
  const existing = new Set(current.nodes.map((n) => /^batch(\d+)-n\d+$/.exec(n.id)?.[1]))
  let generation = 1
  while (existing.has(String(generation))) generation++
  const prefix = 'batch' + generation + '-'
  const batch = buildWorkload(config, false, prefix)
  const bridge = current.nodes.length ? [{ source: current.nodes[config.seed % current.nodes.length].id, target: batch.nodes[0].id, kind: 'reference' }] : []
  // Resolve imported artwork aliases before combining two independent dictionaries.
  const nodes = current.nodes.map((n) => n.art && Object.hasOwn(current.artwork ?? {}, n.art) ? { ...n, art: current.artwork[n.art] } : n)
  return { nodes: [...nodes, ...batch.nodes], links: [...current.links, ...bridge, ...batch.links], artwork: batch.artwork }
}

export function imageURL(data, node, base = '') {
  if (!node?.art) return undefined
  const value = Object.hasOwn(data.artwork ?? {}, node.art) ? data.artwork[node.art] : node.art
  if (typeof value !== 'string') return undefined
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(value) || /^https?:\/\//i.test(value)) return value
  return /^graphs\/[\w./-]+$/.test(value) && !value.includes('..') ? base + '/' + value : undefined
}

export function importWorkload(raw) {
  const links = raw?.links ?? raw?.edges
  if (!Array.isArray(raw?.nodes) || !Array.isArray(links)) throw Error('Expected a nodes array and a links or edges array.')
  if (raw.nodes.length > maxNodes || links.length > maxLinks) throw Error('Import supports up to 25,000 nodes and 100,000 links.')
  const ids = new Set()
  const stringFields = ['label', 'kind', 'summary', 'content', 'art']
  for (const n of raw.nodes) {
    if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id)) throw Error('Each node needs a unique, nonempty string id.')
    if (stringFields.some((k) => n[k] !== undefined && typeof n[k] !== 'string') ||
      ['x','y','z'].some((k) => n[k] !== undefined && !Number.isFinite(n[k])) ||
      (n.pinned !== undefined && typeof n.pinned !== 'boolean') ||
      (n.degree !== undefined && (!Number.isInteger(n.degree) || n.degree < 0 || n.degree > 0xffffffff))) throw Error('Invalid fields on node ' + n.id + '.')
    ids.add(n.id)
  }
  if (links.some((e) => !e || !ids.has(e.source) || !ids.has(e.target) || (e.kind !== undefined && typeof e.kind !== 'string')))
    throw Error('Every link needs existing source and target IDs and an optional string kind.')
  const artwork = raw.artwork ?? raw.thumbnails ?? {}
  if (typeof artwork !== 'object' || Array.isArray(artwork) || Object.values(artwork).some((v) => typeof v !== 'string'))
    throw Error('Artwork must map image IDs to image URLs.')
  const data = { nodes: raw.nodes, links, artwork }
  if (data.nodes.some((n) => n.art && !imageURL(data, n))) throw Error('Use a raster data URL, an HTTP(S) image URL, or a bundled graphs/ image path.')
  return data
}
