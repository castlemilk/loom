import type { GraphData, GraphLink, GraphNode } from './types.js'

export type AtlasLoading = 'on-demand' | 'full'
export interface AtlasTopic {
  id: number
  label: string
  color: string
  first: number
  count: number
  x: number
  y: number
}
export interface AtlasManifest {
  topics: readonly AtlasTopic[]
  /** [source topic, target topic, hyperlink count], including links within a topic. */
  connections: readonly (readonly number[])[]
}
export interface AtlasBlock {
  topic: number
  articles: [id: number, title: string, degree: number][]
  edges: [source: number, target: number][]
}
export interface AtlasReads {
  bytes: number
  requests: number
}
export interface AtlasReader {
  read(topics: readonly number[]): Promise<AtlasBlock[]>
  stats(): AtlasReads
  close(): void
}
export type AtlasReaders = Record<AtlasLoading, () => AtlasReader>
export interface AtlasNode extends GraphNode {
  topic: number
  article?: number
}
export interface AtlasLink extends GraphLink {
  sourceTopic: number
  targetTopic: number
}
export type AtlasScene = GraphData<AtlasNode, AtlasLink>
export interface AtlasCrossing {
  source: number
  target: number
  sourceTitle: string
  targetTitle: string
  sourceTopic: number
  targetTopic: number
}

/** Rank neighboring topics from the small manifest, including topics that have never been opened. */
export function atlasConnections(manifest: AtlasManifest, topic: number) {
  const counts = new Map<number, { topic: number; incoming: number; outgoing: number; total: number }>()
  for (const [from, to, count] of manifest.connections) {
    if (from === to || (from !== topic && to !== topic)) continue
    const other = from === topic ? to : from
    const row = counts.get(other) ?? { topic: other, incoming: 0, outgoing: 0, total: 0 }
    if (from === topic) row.outgoing += count
    else row.incoming += count
    row.total += count
    counts.set(other, row)
  }
  return [...counts.values()].sort((a, b) => b.total - a.total || a.topic - b.topic)
}
export interface AtlasSnapshot {
  mode: AtlasLoading
  expanded: readonly number[]
  loaded: readonly number[]
  pending: readonly number[]
  reads: AtlasReads
  scene: AtlasScene
  error: string | null
}

/** An eagerly fetched version of the same logical blocks, usable without WebAssembly. */
export function createFullAtlasReader(url: string | URL): AtlasReader {
  const abort = new AbortController()
  let reads: AtlasReads = { bytes: 0, requests: 0 }
  return {
    async read() {
      const response = await fetch(url, { signal: abort.signal })
      if (!response.ok) throw new Error('Full graph returned HTTP ' + response.status)
      const bytes = await response.arrayBuffer()
      reads = { requests: reads.requests + 1, bytes: reads.bytes + bytes.byteLength }
      return JSON.parse(new TextDecoder().decode(bytes)) as AtlasBlock[]
    },
    stats: () => reads,
    close: () => abort.abort(),
  }
}

/** Keep the overview legible by drawing the two strongest inter-topic connections for each topic. */
function overviewLinks(manifest: AtlasManifest): AtlasLink[] {
  const pairs = new Map<string, { left: number; right: number; count: number }>()
  for (const [a, b, n] of manifest.connections) {
    if (a === b) continue
    const left = Math.min(a, b),
      right = Math.max(a, b),
      key = left + ':' + right
    const pair = pairs.get(key) ?? { left, right, count: 0 }
    pair.count += n
    pairs.set(key, pair)
  }
  const ranked = [...pairs.values()].sort((a, b) => b.count - a.count)
  const shown = new Set(
    manifest.topics.flatMap((t) => ranked.filter((p) => p.left === t.id || p.right === t.id).slice(0, 2)),
  )
  return [...shown].map((p) => ({
    source: 'topic:' + p.left,
    target: 'topic:' + p.right,
    kind: 'overview',
    weight: p.count,
    sourceTopic: p.left,
    targetTopic: p.right,
  }))
}

/** Coordinates depend only on the published topic centre and the article's slot within it. */
function makeScene(
  topics: readonly AtlasTopic[],
  overview: AtlasLink[],
  blocks: Map<number, AtlasBlock>,
  open: Set<number>,
): AtlasScene {
  const nodes: AtlasNode[] = topics.map((t) => ({
    id: 'topic:' + t.id,
    topic: t.id,
    label: t.label,
    kind: 'topic',
    markerColor: t.color,
    x: t.x,
    y: t.y,
    pinned: true,
  }))
  const links: AtlasLink[] = [...overview],
    visible = new Map<number, number>()
  for (const t of topics) {
    const block = open.has(t.id) && blocks.get(t.id)
    if (!block) continue
    for (const [id, title, degree] of block.articles) {
      const slot = id - t.first,
        angle = slot * 2.3999632297,
        radius = 18 + 53 * Math.sqrt((slot + 0.5) / t.count)
      visible.set(id, t.id)
      nodes.push({
        id: 'article:' + id,
        article: id,
        topic: t.id,
        label: title,
        section: t.label,
        degree,
        kind: 'article',
        markerColor: t.color,
        x: t.x + radius * Math.cos(angle),
        y: t.y + radius * Math.sin(angle),
        pinned: true,
      })
    }
  }
  for (const group of open) {
    for (const [source, target] of blocks.get(group)?.edges ?? []) {
      const targetTopic = visible.get(target)
      if (targetTopic !== undefined)
        links.push({
          source: 'article:' + source,
          target: 'article:' + target,
          kind: 'hyperlink',
          sourceTopic: group,
          targetTopic,
        })
    }
  }
  return { nodes, links }
}

/** A transport-independent, observable atlas. Multiple topics can be open at once. */
export function createAtlas(manifest: AtlasManifest, readers: AtlasReaders, loading: AtlasLoading = 'on-demand') {
  const topics = new Map(manifest.topics.map((t) => [t.id, t]))
  if (topics.size !== manifest.topics.length) throw new RangeError('Duplicate atlas topic')
  const overview = overviewLinks(manifest),
    listeners = new Set<() => void>()
  const blocks = new Map<number, AtlasBlock>(),
    fetched = new Set<number>(),
    pending = new Map<number, Promise<void>>()
  let open = new Set<number>(),
    mode = loading,
    generation = 0,
    reader: AtlasReader | undefined
  let scene = makeScene(manifest.topics, overview, blocks, open),
    error: string | null = null,
    closed = false
  const state = (): AtlasSnapshot => ({
    mode,
    expanded: [...open],
    loaded: [...fetched],
    pending: [...pending.keys()],
    reads: reader?.stats() ?? { bytes: 0, requests: 0 },
    scene,
    error,
  })
  let snapshot = state()
  function publish(redraw = false) {
    if (redraw) scene = makeScene(manifest.topics, overview, blocks, open)
    snapshot = state()
    for (const listener of listeners) listener()
  }
  function load() {
    if (closed) return Promise.reject(new Error('Atlas is closed'))
    const needed = mode === 'full' ? [...topics.keys()] : [...open]
    const missing = needed.filter((id) => !fetched.has(id) && !pending.has(id))
    const token = generation
    if (missing.length) {
      error = null
      const job = Promise.resolve()
        .then(() => {
          if (generation !== token) return []
          reader ??= readers[mode]()
          return reader.read(missing)
        })
        .then((rows) => {
          if (generation !== token) return
          const incoming = new Map(rows.map((b) => [b.topic, b]))
          for (const id of missing) {
            const block = incoming.get(id),
              topic = topics.get(id)!
            if (!block || block.articles.length !== topic.count || !Array.isArray(block.edges))
              throw new Error('Incomplete atlas block for ' + topic.label)
          }
          for (const id of missing) {
            blocks.set(id, incoming.get(id)!)
            fetched.add(id)
          }
        })
        .catch((cause) => {
          if (generation === token) error = cause instanceof Error ? cause.message : String(cause)
        })
        .finally(() => {
          if (generation !== token) return
          for (const id of missing) pending.delete(id)
          publish(missing.some((id) => open.has(id)))
        })
      for (const id of missing) pending.set(id, job)
      publish()
    }
    return Promise.all(new Set(needed.map((id) => pending.get(id)))).then(() => {})
  }
  function setExpanded(ids: Iterable<number>) {
    if (closed) return Promise.reject(new Error('Atlas is closed'))
    const next = new Set(ids)
    for (const id of next) if (!topics.has(id)) throw new RangeError('Unknown atlas topic ' + id)
    if (open.size !== next.size || [...next].some((id) => !open.has(id))) {
      open = next
      publish(true)
    }
    return load()
  }
  function setLoading(next: AtlasLoading) {
    if (closed) return Promise.reject(new Error('Atlas is closed'))
    if (next !== 'on-demand' && next !== 'full') throw new RangeError('Unknown atlas loading mode')
    if (next !== mode) {
      generation++
      reader?.close()
      reader = undefined
      pending.clear()
      fetched.clear()
      for (const id of blocks.keys()) if (!open.has(id)) blocks.delete(id)
      mode = next
      error = null
      publish()
    }
    return load()
  }
  if (mode === 'full') void load()
  else if (mode !== 'on-demand') throw new RangeError('Unknown atlas loading mode')
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    setLoading,
    setExpanded,
    retry: load,
    toggle(id: number) {
      const next = new Set(open)
      if (!next.delete(id)) next.add(id)
      return setExpanded(next)
    },
    block: (id: number) => blocks.get(id),
    /** Directed crossing rows for two loaded topics. Querying never initiates a fetch. */
    crossings(left: number, right: number): AtlasCrossing[] {
      const a = blocks.get(left),
        b = blocks.get(right)
      if (!a || !b || left === right) return []
      const titles = new Map([...a.articles, ...b.articles].map(([id, title]) => [id, title]))
      const rows: AtlasCrossing[] = []
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        const members = new Set(to.articles.map(([id]) => id))
        for (const [source, target] of from.edges)
          if (members.has(target))
            rows.push({
              source,
              target,
              sourceTitle: titles.get(source)!,
              targetTitle: titles.get(target)!,
              sourceTopic: from.topic,
              targetTopic: to.topic,
            })
      }
      return rows
    },
    close() {
      closed = true
      generation++
      reader?.close()
      pending.clear()
      blocks.clear()
      listeners.clear()
    },
  }
}
export type Atlas = ReturnType<typeof createAtlas>
