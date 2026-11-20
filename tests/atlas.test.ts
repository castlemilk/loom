import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { atlasConnections, createAtlas, type AtlasBlock, type AtlasManifest, type AtlasReader } from '../src/atlas.js'
import { cardNeighborhood } from '../src/cards.js'

test('card neighborhoods bound distinct neighbors while keeping reciprocal, parallel and self links', () => {
  const nodes = ['a', 'b', 'c'].map((id) => ({ id }))
  const links = [
    ['a', 'b'],
    ['c', 'a'],
    ['b', 'a'],
    ['a', 'a'],
    ['a', 'b'],
    ['b', 'c'],
  ].map(([source, target]) => ({ source, target }))
  assert.deepEqual(cardNeighborhood({ nodes, links }, 'a', 1), {
    nodes: nodes.slice(0, 2),
    links: [links[0], links[2], links[3], links[4]],
  })
  assert.deepEqual(cardNeighborhood({ nodes, links }, 'a', 0), { nodes: [nodes[0]], links: [links[3]] })
  assert.throws(() => cardNeighborhood({ nodes, links }, 'missing'), /Unknown/)
})

const manifest: AtlasManifest = {
  topics: [0, 1].map((id) => ({ id, label: 'Topic ' + id, first: id * 2, count: 2, x: id * 120, y: 0, color: '#ccc' })),
  connections: [
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
  ],
}
const blocks: AtlasBlock[] = [
  {
    topic: 0,
    articles: [
      [0, 'Zero', 1],
      [1, 'One', 2],
    ],
    edges: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    topic: 1,
    articles: [
      [2, 'Two', 2],
      [3, 'Three', 1],
    ],
    edges: [[2, 1]],
  },
]
function deferredReader() {
  const calls: { ids: readonly number[]; resolve: (rows: AtlasBlock[]) => void; reject: (err: Error) => void }[] = []
  let closed = false
  const reader: AtlasReader = {
    read: (ids) => new Promise((resolve, reject) => calls.push({ ids, resolve, reject })),
    stats: () => ({ bytes: calls.length * 32, requests: calls.length }),
    close() {
      closed = true
    },
  }
  return { reader, calls, isClosed: () => closed }
}

test('atlas caches concurrent topic reads, keeps unopened topics in place and shows only real hyperlinks', async () => {
  const io = deferredReader(),
    atlas = createAtlas(manifest, { 'on-demand': () => io.reader, full: () => io.reader })
  const overview = atlas.getSnapshot().scene
  assert.equal(overview.nodes.length, 2)
  assert.equal(io.calls.length, 0)
  const a = atlas.toggle(0),
    b = atlas.setExpanded([0]),
    both = atlas.toggle(1)
  await Promise.resolve()
  assert.deepEqual(
    io.calls.map((c) => c.ids),
    [[0], [1]],
  )
  const closeSecond = atlas.toggle(1)
  io.calls[1].resolve([blocks[1]])
  io.calls[0].resolve([blocks[0]])
  await Promise.all([a, b, both, closeSecond])
  const partial = atlas.getSnapshot().scene
  assert.deepEqual(partial.nodes.slice(0, 2), overview.nodes)
  assert.deepEqual(
    partial.links.filter((e) => e.kind === 'hyperlink').map((e) => [e.source, e.target]),
    [['article:0', 'article:1']],
  )
  await atlas.toggle(1)
  const expanded = atlas.getSnapshot().scene
  assert.deepEqual(expanded.nodes.slice(0, partial.nodes.length), partial.nodes)
  assert.equal(expanded.links.filter((e) => e.kind === 'hyperlink').length, 3)
  await atlas.setExpanded([])
  assert.deepEqual(atlas.getSnapshot().scene, overview)
  assert.equal(io.calls.length, 2)
  atlas.close()
})

test('topic summaries and loaded article pairs preserve direction without fetching other topics', async () => {
  const io = deferredReader(), atlas = createAtlas(manifest, { 'on-demand': () => io.reader, full: () => io.reader })
  assert.deepEqual(atlasConnections(manifest, 0), [{ topic: 1, outgoing: 1, incoming: 1, total: 2 }])
  assert.deepEqual(atlas.crossings(0, 1), [])
  assert.equal(io.calls.length, 0)
  const opened = atlas.setExpanded([0, 1])
  await Promise.resolve()
  io.calls[0].resolve(blocks)
  await opened
  assert.deepEqual(atlas.crossings(0, 1), [
    { source: 1, target: 2, sourceTitle: 'One', targetTitle: 'Two', sourceTopic: 0, targetTopic: 1 },
    { source: 2, target: 1, sourceTitle: 'Two', targetTitle: 'One', sourceTopic: 1, targetTopic: 0 },
  ])
  assert.deepEqual(atlas.crossings(1, 0), atlas.crossings(0, 1).reverse())
  assert.deepEqual(atlas.crossings(0, 0), [])
  const links = atlas.getSnapshot().scene.links.filter(e => e.kind === 'hyperlink' && e.sourceTopic !== e.targetTopic)
  assert.deepEqual(links.map(e => [e.sourceTopic, e.targetTopic]), [[0, 1], [1, 0]])
  assert.equal(io.calls.length, 1)
  atlas.close()
})

test('switching loading mode preserves the visible scene and ignores responses from a closed reader', async () => {
  const lazy = deferredReader(),
    full = deferredReader(),
    atlas = createAtlas(manifest, { 'on-demand': () => lazy.reader, full: () => full.reader })
  const first = atlas.toggle(0)
  await Promise.resolve()
  lazy.calls[0].resolve([blocks[0]])
  await first
  const late = atlas.toggle(1),
    scene = atlas.getSnapshot().scene
  await Promise.resolve()
  const eager = atlas.setLoading('full')
  assert.equal(lazy.isClosed(), true)
  assert.equal(atlas.getSnapshot().scene, scene)
  await Promise.resolve()
  assert.deepEqual(full.calls[0].ids, [0, 1])
  full.calls[0].resolve(blocks)
  await eager
  const complete = atlas.getSnapshot()
  lazy.calls[1].reject(new Error('request aborted'))
  await late
  assert.equal(atlas.getSnapshot(), complete)
  assert.deepEqual(complete.loaded, [0, 1])
  assert.deepEqual(complete.expanded, [0, 1])
  assert.equal(complete.scene.nodes.length, 6)
  atlas.close()
  await assert.rejects(atlas.setExpanded([]), /closed/)
})

test('an incomplete batch is atomic and can be retried with the same expansion', async () => {
  const io = deferredReader(),
    atlas = createAtlas(manifest, { 'on-demand': () => io.reader, full: () => io.reader }, 'full')
  const first = atlas.setExpanded([1])
  await Promise.resolve()
  io.calls[0].resolve([blocks[0]])
  await first
  assert.match(atlas.getSnapshot().error!, /Incomplete/)
  assert.deepEqual(atlas.getSnapshot().loaded, [])
  const retry = atlas.retry()
  await Promise.resolve()
  io.calls[1].resolve(blocks)
  await retry
  assert.equal(atlas.getSnapshot().error, null)
  assert.deepEqual(atlas.getSnapshot().expanded, [1])
  assert.equal(atlas.getSnapshot().scene.nodes.length, 4)
  assert.throws(() => atlas.toggle(42), /Unknown/)
  atlas.close()
})

test('the published SQLite and JSON graphs contain the same 4,604 articles and 119,882 directed links', () => {
  const root = 'web/public/examples/wikispeedia/'
  const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'))
  for (const [file, size] of [
    [manifest.database, manifest.databaseBytes],
    [manifest.full, manifest.fullBytes],
  ]) {
    const bytes = readFileSync(root + file)
    assert.equal(bytes.length, size)
    assert.ok(file.includes(createHash('sha256').update(bytes).digest('hex').slice(0, 16)))
  }
  const db = new DatabaseSync(root + manifest.database, { readOnly: true })
  try {
    const blocks: AtlasBlock[] = JSON.parse(readFileSync(root + manifest.full, 'utf8'))
    const articles = db.prepare('SELECT id,title,degree FROM articles WHERE topic=? ORDER BY id')
    const edges = db.prepare('SELECT source,target FROM edges WHERE topic=? ORDER BY source,target')
    assert.equal(db.prepare('PRAGMA page_size').get()?.page_size, manifest.pageSize)
    assert.equal(blocks.length, 16)
    for (const block of blocks) {
      assert.deepEqual(
        articles.all(block.topic).map((row) => [row.id, row.title, row.degree]),
        block.articles,
      )
      assert.deepEqual(
        edges.all(block.topic).map((row) => [row.source, row.target]),
        block.edges,
      )
      assert.equal(block.articles.length, manifest.topics.find((t: { id: number }) => t.id === block.topic).count)
    }
    assert.equal(
      blocks.reduce((sum, b) => sum + b.articles.length, 0),
      4604,
    )
    assert.equal(
      blocks.reduce((sum, b) => sum + b.edges.length, 0),
      119882,
    )
  } finally {
    db.close()
  }
})

test('each historical source record belongs to a real directed crossing in precisely its topic pair', () => {
  const root = 'web/public/examples/wikispeedia/'
  const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'))
  const blocks: AtlasBlock[] = JSON.parse(readFileSync(root + manifest.full, 'utf8'))
  const topics = new Map(blocks.flatMap(b => b.articles.map(([id]) => [id, b.topic] as const)))
  const expected = new Map<string, Set<string>>()
  for (const block of blocks) {
    for (const [source, target] of block.edges) {
      const to = topics.get(target)!
      if (block.topic === to) continue
      const file = Math.min(block.topic, to) + '-' + Math.max(block.topic, to) + '.json'
      if (!expected.has(file)) expected.set(file, new Set())
      expected.get(file)!.add(source + ':' + target)
    }
  }
  assert.deepEqual(readdirSync(root + 'evidence').sort(), [...expected.keys()].sort())
  const gaps: string[] = []
  let found = 0
  for (const [file, crossings] of expected) {
    const data: { pages: Record<string, string>; links: Record<string, string[]> } =
      JSON.parse(readFileSync(root + 'evidence/' + file, 'utf8'))
    for (const key of crossings) {
      const [source, target] = key.split(':')
      for (const endpoint of [source, target]) assert.match(data.pages[endpoint], /^wp\/[^/]+\/[^/]+\.htm$/)
      if (!Object.hasOwn(data.links, key)) gaps.push(key)
    }
    for (const [key, [section, , anchor, quote]] of Object.entries(data.links)) {
      assert.ok(crossings.has(key), file + ' contains a link outside its pair')
      assert.ok(section && anchor)
      if (quote) assert.ok(quote.includes(anchor))
      assert.doesNotMatch(quote, /<!\[CDATA\[|showTocToggle|tocShowText|<\/?(?:script|style)\b/i, file + ' ' + key)
      if (key === '1965:4098')
        assert.equal(quote, 'The binary arithmetic article discusses the use of binary numbers in computer systems.')
      found++
    }
  }
  assert.equal(found, 79126)
  assert.deepEqual(gaps.sort(), ['3542:4021', '3542:4029'])
})
