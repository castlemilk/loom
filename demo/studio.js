import { fromConsole, ink, parchment, blueprint, knowledgeConsole } from '../dist/index.js'
import { createWireGraph, sketchbook } from '../dist/wires.js'
import { createGraphIndex } from '../dist/explore.js'
import { clusterLayout } from '../dist/clusters.js'
import { consoleLayout } from '../dist/console.js'
import snapshot from './knowledge.json' with { type: 'json' }
import catalog from './atlases/catalog.json' with { type: 'json' }
import bauhaus from './atlases/bauhaus.json' with { type: 'json' }
import solar from './atlases/outer-solar-system.json' with { type: 'json' }
import { fixture } from './fixture.js'
import { maxNodeSize, minNodeSize, nodeCounts, sizeLabel, stepNodeSize } from './node-controls.js'

const byId = (id) => document.getElementById(id)
const canvas = byId('graph')
const embedded = byId('layout-worker')?.textContent
const workerURL = embedded
  ? URL.createObjectURL(new Blob([embedded], { type: 'text/javascript' }))
  : undefined
if (workerURL)
  addEventListener('pagehide', (e) => {
    if (!e.persisted) URL.revokeObjectURL(workerURL)
  })
const full = fromConsole(snapshot),
  sampleIds = new Set(snapshot.sample)
const excerpt = {
  nodes: full.nodes.filter((n) => sampleIds.has(n.id)),
  links: full.links.filter((l) => sampleIds.has(l.source) && sampleIds.has(l.target)),
}
const atlases = { bauhaus, 'outer-solar-system': solar }
const themes = { console: knowledgeConsole, ink, parchment, blueprint, sketchbook }
const defaultOrder = ['study', 'concept', 'tag', 'blog', 'lab', 'category']
const hub = (k) => ['tag', 'concept', 'category'].includes(k)
let graph,
  data,
  kinds,
  articleIndex,
  atlasLayout,
  atlasMarks,
  selected = null,
  paused = false,
  mode = 'drift',
  edits = {},
  wireEdits = {}
const base = () => themes[byId('theme').value]
const generated = () => byId('dataset').value === 'stress' || byId('dataset').value.startsWith('count-')
function currentTheme() {
  const theme = base(),
    wires = theme.wires ?? {},
    byKind = {}
  const opacity = Number(byId('wire-opacity').value) / 100
  for (const [kind, rule] of Object.entries(wires.byKind ?? {})) {
    byKind[kind] =
      rule.opacity === undefined
        ? rule
        : { ...rule, opacity: Math.min(1, (opacity * rule.opacity) / (wires.opacity || 1)) }
  }
  for (const [kind, rule] of Object.entries(wireEdits)) byKind[kind] = { ...byKind[kind], ...rule }
  return {
    ...theme,
    nodes: {
      ...theme.nodes,
      scale: Number(byId('node-size').value) / 100,
      artwork: byId('artwork').checked,
      byKind: { ...theme.nodes?.byKind, ...atlasMarks, ...edits },
    },
    wires: { ...wires, byKind, opacity, routing: byId('route').value },
    labels: { ...theme.labels, visibility: byId('labels').value },
    grid: byId('grid').checked ? (theme.grid ?? { spacing: 32, opacity: 0.18 }) : undefined,
  }
}
function currentLayout() {
  return {
    anchor: atlasLayout?.anchor ?? null,
    blend: Number(byId('blend').value) / 100,
    laneGap: Number(byId('lane-gap').value),
    rowGap: Number(byId('row-gap').value),
    direction: byId('direction').value,
    linkDistance: Number(byId('link-distance').value),
    springStrength: Number(byId('spring').value),
    repulsion: Number(byId('repulsion').value),
    springsByKind: generated() ? undefined : consoleLayout.springsByKind,
    guides: byId('guides').checked,
    pinOnDrag: byId('pin-drag').checked,
  }
}
function mark(kind, t = currentTheme()) {
  const rule = t.nodes?.byKind?.[kind]
  return {
    shape: rule?.shape ?? (hub(kind) ? 'circle' : 'rounded-square'),
    color: rule?.color ?? t.kind[kind] ?? t.accent,
  }
}
function legend(theme) {
  const list = byId('legend')
  list.style.setProperty('--map-ink', theme.ink)
  list.style.setProperty('--map-bg', theme.bg)
  list.replaceChildren(
    ...kinds.map((kind) => {
      const el = document.createElement('span'),
        icon = document.createElement('i'),
        style = mark(kind, theme)
      icon.dataset.shape = style.shape
      icon.style.setProperty('--kind', style.color)
      el.append(icon, kind)
      return el
    }),
  )
}
function kindControls() {
  const s = mark(byId('kind').value)
  byId('kind-color').value = s.color
  byId('shape').value = s.shape
}
function wireControls() {
  const t = currentTheme(),
    rule = t.wires.byKind[byId('wire-kind').value]
  byId('wire-color').value = rule?.color ?? t.wires.color ?? t.dim
  byId('wire-width').value = rule?.width ?? t.wires.width ?? 1.3
  byId('width-value').value = byId('wire-width').value + ' px'
}
function styleInputs() {
  const t = base()
  edits = {}
  wireEdits = {}
  byId('route').value = t.wires?.routing ?? 'arc'
  byId('wire-opacity').value = Math.round((t.wires?.opacity ?? 0.45) * 100)
  byId('node-size').value = Math.round((t.nodes?.scale ?? 1) * 100)
  byId('grid').checked = !!t.grid
  byId('artwork').checked = t.nodes?.artwork !== false
  byId('labels').value = t.labels?.visibility ?? 'auto'
  byId('drawing-fill').value = t === sketchbook ? 'hachure' : 'solid'
  byId('linework').value = t === sketchbook ? '1' : '0'
}
const drawingStyle = () => ({ fill: byId('drawing-fill').value, roughness: Number(byId('linework').value) })
function showNodeSize() {
  const size = Number(byId('node-size').value)
  byId('size-value').value = sizeLabel(size)
  byId('node-size').setAttribute('aria-valuetext', sizeLabel(size))
  byId('size-down').disabled = size <= minNodeSize
  byId('size-up').disabled = size >= maxNodeSize
  byId('size-default').title = 'Reset to theme size (' + sizeLabel(Math.round((base().nodes?.scale ?? 1) * 100)) + ')'
}
function restyle() {
  const t = currentTheme()
  graph?.setTheme(t)
  graph?.setDrawingStyle(drawingStyle())
  legend(t)
  showNodeSize()
  byId('opacity-value').value = Math.round(t.wires.opacity * 100) + '%'
}
function diagnostics() {
  if (!graph) return
  const s = graph.stats()
  byId('first').textContent = s.firstSubmitMs.toFixed(2) + ' ms'
  byId('draws').textContent = String(s.drawCalls)
  byId('ticks').textContent = String(s.simTicks)
  byId('transport').textContent = s.transport
}
function inspect() {
  const n = data.nodes.find((n) => n.id === selected)
  byId('selection').textContent = n ? n.label : 'Select a node to inspect its links.'
  byId('selection-tools').hidden = !n
  byId('atlas-article').value = selected ?? ''
  byId('atlas-detail').hidden = !articleIndex || !n
  if (articleIndex && n) {
    byId('article-summary').textContent = n.summary
    byId('wiki-source').href = 'https://en.wikipedia.org/w/index.php?oldid=' + n.wikipediaRevision
    const buttons = articleIndex.neighbors(n.id, 'outgoing').map(({node}) => {
      const button = document.createElement('button')
      button.textContent = node.label
      button.onclick = () => { graph.select(node.id); graph.focus(node.id) }
      return button
    })
    byId('article-links').replaceChildren(...(buttons.length ? buttons : ['No outgoing links.']))
  }
  if (!n) {
    byId('selection-meta').textContent = ''
    return
  }
  const count = data.links.filter((l) => l.source === n.id || l.target === n.id).length
  const pinned = graph.getPosition(n.id).pinned
  byId('selection-meta').textContent =
    n.kind + ' · ' + count + (count === 1 ? ' link' : ' links') + (pinned ? ' · pinned' : '')
  byId('pin').textContent = pinned ? 'Release node' : 'Pin node'
}
function mount() {
  const dataset = byId('dataset').value,
    stress = generated()
  const simulation = byId('physics')
  for (const value of ['fixed', 'seeded'])
    simulation.querySelector('[value="' + value + '"]').disabled = !stress
  if (simulation.selectedOptions[0].disabled) simulation.value = 'auto'
  const physics = byId('physics').value
  byId('size-control').hidden = !stress
  data = stress
    ? fixture(Number(byId('count').value), physics === 'seeded' ? 'seeded' : physics === 'fixed')
    : atlases[dataset] ?? (dataset === 'full' ? full : excerpt)
  const atlas = catalog[dataset]
  articleIndex = atlas ? createGraphIndex(data) : null
  atlasLayout = atlas ? clusterLayout(data.nodes, n => n.section, { spacing: 54, aspectRatio: 1.65 }) : null
  atlasMarks = atlas ? Object.fromEntries(Object.values(atlas.sections).map(({kind, color, shape}) => [kind, {color,shape}])) : {}
  byId('article-field').hidden = byId('atlas-credit').hidden = !atlas
  byId('atlas-article').replaceChildren(new Option('Choose an article', ''), ...(atlas ? data.nodes.map(n => new Option(n.label, n.id)) : []))
  const present = new Set(data.nodes.map(n => n.kind))
  kinds = [...new Set([...defaultOrder, ...present])].filter(k => present.has(k))
  byId('kind').replaceChildren(...kinds.map((k) => new Option(k, k)))
  const edgeKinds = [...new Set(data.links.map((l) => l.kind ?? ''))].sort()
  byId('wire-kind').replaceChildren(...edgeKinds.map((k) => new Option(k || 'Untyped', k)))
  graph?.destroy()
  canvas.removeAttribute('data-node')
  graph = undefined
  const theme = currentTheme()
  try {
    graph = createWireGraph(canvas, {
      ...data,
      mode,
      theme,
      drawingStyle: drawingStyle(), wireEffects: { direction: 'none', separation: atlas ? 12 : 0 },
      layout: currentLayout(),
      workerURL,
      art: { urlFor: (n) => snapshot.thumbnails[n.art] },
      sim: ['worker', 'main'].includes(physics) ? physics : undefined,
    })
    byId('error').hidden = true
  } catch (e) {
    byId('error').textContent = e.message
    byId('error').hidden = false
    return
  }
  paused = false
  selected = null
  byId('pause').textContent = 'Pause'
  byId('totals').textContent =
    data.nodes.length.toLocaleString() + ' nodes · ' + data.links.length.toLocaleString() + ' links'
  legend(theme)
  kindControls()
  wireControls()
  inspect()
  graph.on('select', (id) => {
    selected = id
    inspect()
    diagnostics()
  })
  graph.on('hover', (id) => canvas.toggleAttribute('data-node', id !== null))
  graph.on('open', (id) => graph.focus(id))
  diagnostics()
  requestAnimationFrame(diagnostics)
}
for (const btn of document.querySelectorAll('[data-mode]'))
  btn.onclick = () => {
    mode = btn.dataset.mode
    for (const b of document.querySelectorAll('[data-mode]'))
      b.setAttribute('aria-pressed', String(b === btn))
    graph?.setMode(mode)
  }
function relayout() {
  byId('blend-value').value = byId('blend').value + '%'
  graph?.setLayout(currentLayout())
}
byId('blend').oninput = relayout
for (const id of ['lane-gap', 'row-gap', 'link-distance', 'spring', 'repulsion'])
  byId(id).oninput = () => {
    byId(id + '-value').value = byId(id).value + (['spring', 'repulsion'].includes(id) ? '×' : '')
    relayout()
  }
for (const id of ['direction', 'guides', 'pin-drag']) byId(id).onchange = relayout
byId('theme').onchange = () => {
  styleInputs()
  restyle()
  kindControls()
  wireControls()
}
for (const id of ['route', 'grid', 'artwork', 'labels', 'drawing-fill', 'linework']) byId(id).onchange = restyle
for (const id of ['node-size', 'wire-opacity']) byId(id).oninput = restyle
function sizeNodes(percent) {
  byId('node-size').value = String(percent)
  restyle()
}
byId('size-down').onclick = () => sizeNodes(stepNodeSize(Number(byId('node-size').value), -1))
byId('size-up').onclick = () => sizeNodes(stepNodeSize(Number(byId('node-size').value), 1))
byId('size-default').onclick = () => sizeNodes(Math.round((base().nodes?.scale ?? 1) * 100))
byId('kind').onchange = kindControls
byId('wire-kind').onchange = wireControls
function editWire() {
  wireEdits[byId('wire-kind').value] = {
    color: byId('wire-color').value,
    width: Number(byId('wire-width').value),
  }
  restyle()
  wireControls()
}
byId('wire-color').oninput = editWire
byId('wire-width').oninput = editWire
function editKind() {
  const kind = byId('kind').value
  edits[kind] = {
    ...base().nodes?.byKind?.[kind],
    color: byId('kind-color').value,
    shape: byId('shape').value,
  }
  restyle()
}
byId('kind-color').oninput = editKind
byId('shape').onchange = editKind
byId('count').oninput = (e) => {
  byId('countLabel').value = Number(e.target.value).toLocaleString()
}
for (const n of nodeCounts) byId('node-counts').append(new Option(n.toLocaleString('en') + ' nodes · ' + (n * 4).toLocaleString('en') + ' links', 'count-' + n))
for (const [key, item] of Object.entries(catalog)) byId('atlas-options').append(new Option(item.title, key))
byId('atlas-article').onchange = (event) => graph?.select(event.target.value || null)
byId('dataset').onchange = () => {
  const value = byId('dataset').value
  if (catalog[value]) {
    byId('theme').value = 'sketchbook'
    byId('blend').value = '100'
    byId('blend-value').value = '100%'
    styleInputs()
    showNodeSize()
    byId('opacity-value').value = byId('wire-opacity').value + '%'
  }
  if (value.startsWith('count-')) {
    const n = Number(value.slice(6))
    byId('count').value = String(n)
    byId('countLabel').value = n.toLocaleString('en')
  }
  mount()
}
byId('count').onchange = () => { byId('dataset').value = 'stress'; mount() }
byId('physics').onchange = mount
byId('fit').onclick = () => graph?.fit()
byId('reset').onclick = () => graph?.reset()
byId('pause').onclick = () => {
  if (!graph) return
  paused = !paused
  if (paused) graph.pause()
  else graph.resume()
  byId('pause').textContent = paused ? 'Resume' : 'Pause'
  diagnostics()
}
byId('focus').onclick = () => {
  if (selected) graph.focus(selected)
}
byId('pin').onclick = () => {
  if (!selected) return
  if (graph.getPosition(selected).pinned) graph.unpin(selected)
  else graph.pin(selected)
  inspect()
}
// By the time pointerup bubbles to the stage, the canvas has applied its release policy.
canvas.parentElement.addEventListener('pointerup', (event) => {
  if (event.target === canvas && selected) inspect()
})
byId('refresh').onclick = diagnostics
byId('blend').value = String(consoleLayout.blend * 100)
byId('blend-value').value = byId('blend').value + '%'
styleInputs()
showNodeSize()
byId('opacity-value').value = byId('wire-opacity').value + '%'
mount()
