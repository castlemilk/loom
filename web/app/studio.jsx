'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { consoleLayout } from '../../dist/console.js'
import { buildWorkload, initialWorkload, imageURL, maxLinks, sectionAtlas } from './workload.mjs'
import { clusterLayout } from '../../dist/clusters.js'
import { createDrilldown, drilldownGroup } from '../../dist/drilldown.js'
import { createGraphIndex } from '../../dist/explore.js'
import atlasCatalog from '../../demo/atlases/catalog.json'
import { contentBytes } from '../../dist/metrics.js'
import { EncodingControls, initialEncoding, useEncodings } from './encodings'
import { maxNodeSize, minNodeSize, nodeCounts, sizeLabel, stepNodeSize } from '../../demo/node-controls.js'
import { WorkloadControls } from './workload-controls'
import { CloudCompass, PerfPanel } from './perf-panel'
import { Check, Color, InspectorSection, Range, Select } from './fields'
import { useDocument } from './editor-document'
import { DocumentComposer, EditorToolbar, MarkerProperties, NodeProperties } from './editor-tools'
import { defaultWireEffects } from '../../dist/wires.js'
import { WireControls } from './wire-controls'
import { WirePreview } from './wire-preview'
import { DrawingControls } from './drawing-controls'
import { NodeLinks, wikipediaSource } from './explore-links'
import { kindOrder, makeTheme, marker, palettes as themePresets, patterns, preset, shapes } from './appearance'
import { useGraph } from './use-graph'
import { Grouping, useGrouping } from './grouping'
import { Splitter } from './splitter'
import { DrillControls, DrillTrail, detailOptions, navigationDefaults } from './drilldown-controls'
import { artURL, docsURL, fetchGraphFile, homeURL, modelURL, studioURL } from '../site'
import { findInGraph, SettingsPanel, SettingsTabs } from './settings-tabs'
import { wireAnchor, wireForces, wireModelStyle } from './wire-study'
import { GraphPicker } from './graph-picker'

const datasets = [['sample', 'Knowledge console · excerpt'], ['sections', 'Section atlas'], ['model', 'Wire model'], ['full', 'Knowledge console · full'], ['stress', 'Generated stress graph']]
const emptyGraph = { nodes: [], links: [] }
const getAtlas = (key) => Object.hasOwn(atlasCatalog, key) ? atlasCatalog[key] : null
const modes = ['Drift', 'Lanes', 'Orbit', 'Cloud']
const simulations = [['auto', 'Automatic'], ['main', 'Main thread'], ['worker', 'Worker']]
const positioned = [['seeded', 'Positioned · movable'], ['fixed', 'Positioned · pinned']]
const directions = [['horizontal', 'Left to right'], ['vertical', 'Top to bottom']]
const routes = [['patch', 'Patch cables'], ['arc', 'Arcs'], ['straight', 'Straight lines']]
const palettes = [['console', 'Knowledge console'], ['sketchbook', 'Sketchbook'], ['ink', 'Ink'], ['parchment', 'Parchment'], ['blueprint', 'Blueprint']]
const labels = [['auto', 'Automatic'], ['focus', 'Focus only'], ['none', 'Hidden']]
const formatCount = new Intl.NumberFormat('en')
const StudioCardDialog = dynamic(() => import('./studio-card-dialog'), { ssr:false })
const percent = (value) => value + '%'
const times = (value) => value + '×'

export default function Studio({ sample }) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}><Workbench sample={sample} /></QueryClientProvider>
}

function Workbench({ sample }) {
  const [dataset, setDataset] = useState('sample')
  const [physics, setPhysics] = useState('auto')
  const [workload, setWorkload] = useState({ config: initialWorkload, data: null })
  const [workloadDraft, editWorkload] = useState(initialWorkload)
  const [custom, setCustom] = useState(null)
  const [tool, setTool] = useState(null), [editingLink, setEditingLink] = useState(null)
  const [placementPoint, setPlacementPoint] = useState(null)
  const [wireEnds, setWireEnds] = useState(null)
  const [wireEffects, setWireEffects] = useState(defaultWireEffects)
  const [cardRoot, setCardRoot] = useState(null)
  const [editNotice, setEditNotice] = useState('')
  const pendingView = useRef(null)
  const retainedScene = useRef(null)
  const [perf, setPerf] = useState(false)
  const [mode, setMode] = useState('drift')
  const [style, setStyle] = useState(() => preset('console'))
  const [packed, setPacked] = useState(false)
  const [gap, setGap] = useState(80)
  const [encoding, setEncoding] = useState(initialEncoding)
  const [navigation, setNavigation] = useState(navigationDefaults)
  const nodeSize = Math.round(style.nodeScale * 100)
  const defaultSize = Math.round((themePresets[style.name].nodes?.scale ?? 1) * 100)
  const [kindChoice, chooseKind] = useState('study')
  const [wireChoice, chooseWire] = useState('concept')
  const [settings, setSettings] = useState({
    blend: consoleLayout.blend, laneGap: 175, rowGap: 64, orbitGap: 80, linkDistance: 46,
    springStrength: 1, repulsion: 1, direction: 'horizontal', guides: false, pinOnDrag: false, cloudDepth: 1, autoRotate: true,
  })

  const countOptions = useMemo(() => nodeCounts.map((nodes) => ({
    value: 'count-' + nodes,
    config: { ...workload.config, nodes, degree: Math.min(workload.config.degree, Math.floor(maxLinks / nodes)) },
  })), [workload.config])
  const countOption = countOptions.find((option) => option.value === dataset)
  const stress = dataset === 'stress' || !!countOption
  const requestedAtlas = getAtlas(dataset)
  const remoteURL = requestedAtlas ? homeURL + 'examples/' + dataset + '.json'
    : dataset === 'model' ? modelURL : dataset === 'full' ? homeURL + 'graphs/knowledge.json' : null
  const remote = useQuery({
    queryKey: ['studio-graph', remoteURL], queryFn: ({ signal }) => fetchGraphFile(remoteURL, signal), enabled: !!remoteURL,
    staleTime: Infinity, gcTime: Infinity, retry: 1,
  })
  const placement = physics === 'seeded' ? 'seeded' : physics === 'fixed'
  const generated = useMemo(() => {
    if (countOption) return buildWorkload(countOption.config, placement)
    if (stress) return !placement && workload.data || buildWorkload(workload.config, placement)
    return null
  }, [stress, countOption, workload, placement])
  const atlas = useMemo(() => dataset === 'sections' ? sectionAtlas() : null, [dataset])
  const input = atlas ?? (stress ? generated : dataset === 'custom' && custom ? custom.data : remoteURL ? remote.data ?? emptyGraph : sample)
  const datasetLabel = requestedAtlas?.title ?? datasets.find(([key]) => key === dataset)?.[1] ?? (countOption ? formatCount.format(countOption.config.nodes) + ' nodes' : custom?.name ?? 'Graph')
  const model = useDocument(input, dataset, datasetLabel, setDataset)
  const source = model.data, origin = model.draft?.origin ?? dataset
  const wiki = getAtlas(origin)
  const graphIndex = useMemo(() => createGraphIndex(source), [source])
  const drill = useMemo(() => createDrilldown(source), [source])
  const snapshot = useSyncExternalStore(drill.subscribe, drill.getSnapshot, drill.getSnapshot)
  const data = useMemo(() => snapshot.data === source ? source : { ...source, ...snapshot.data }, [source, snapshot.data])
  const level = snapshot.path.at(-1)
  const palette = useMemo(() => makeTheme(style), [style])
  const grouping = useGrouping(source, data, palette, packed, wiki?.sections)
  const groupFor = useCallback((node) => {
    const term = grouping.index.primary(node.id, grouping.active.id)
    return term && drilldownGroup(term, data.nodes)
  }, [grouping.index, grouping.active.id, data.nodes])
  const openTerm = useCallback((term) => {
    if (level.kind === 'group' && term.id === level.id && term.taxonomy === level.taxonomy) return drill.back()
    return drill.openGroup(drilldownGroup(term, data.nodes))
  }, [drill, data.nodes, level])
  useEffect(() => {
    drill.setOptions({ selectAction: tool === 'link' ? 'inspect' : navigation.selectAction, openAction: navigation.openAction,
      groupAction: navigation.groupAction, groupFor, detail: detailOptions(navigation.detail),
      spread: navigation.spread, arrangement: navigation.arrangement, memberSpacing: navigation.spacing * style.nodeScale,
      expansionBlend: navigation.expansionBlend, neighborhood: { hops: navigation.hops, direction: navigation.direction } })
  }, [drill, groupFor, navigation, style.nodeScale, tool])
  const groupEnabled = tool !== 'node' && tool !== 'link' && navigation.groupAction !== 'none'
  const annotations = useMemo(() => ({ ...grouping.annotations, onOpenGroup: groupEnabled ? openTerm : undefined,
    bubbleLabels: grouping.annotations.bubbleLabels && mode !== 'lanes' && level.kind === 'overview',
    groupGesture: navigation.groupGesture, activeGroup: level.kind === 'group' ? { taxonomy: level.taxonomy, id: level.id, boundary: navigation.boundary,
      shape: level.action === 'expand' && navigation.boundary === 'outline' ? 'hull' : undefined } : undefined }),
    [grouping.annotations, groupEnabled, openTerm, navigation.groupGesture, level, navigation.boundary, mode])
  const mapped = useEncodings(data, encoding)
  const theme = useMemo(() => {
    const nodes = grouping.nativeMarkers && !mapped.radius ? palette.nodes : { ...palette.nodes, resolve: (node, degree) => {
      const base = palette.nodes?.resolve?.(node, degree)
      const term = grouping.nativeMarkers ? null : grouping.index.primary(node.id, grouping.active.id)
      return { ...base, ...(!grouping.nativeMarkers && { color: term?.color ?? palette.dim, shape: term?.shape ?? 'circle',
        ...(Object.hasOwn(style.nodes, node.kind) && style.nodes[node.kind]) }), ...mapped.radius?.(node) }
    } }
    const wires = mapped.width ? { ...palette.wires, resolve: (link, i) => ({ ...palette.wires?.resolve?.(link, i), ...mapped.width(link, i) }) } : palette.wires
    return { ...palette, nodes, wires }
  }, [palette, grouping.nativeMarkers, grouping.index, grouping.active.id, mapped.radius, mapped.width, style.nodes])
  const clusters = useMemo(() => packed ? clusterLayout(data.nodes, grouping.laneBy,
    { gap, dimensions: mode === 'cloud' ? 3 : 2, depth: settings.cloudDepth, ...(wiki && { spacing: 56, aspectRatio: 1.65 }) }) : null,
    [packed, data, grouping.laneBy, gap, mode, settings.cloudDepth, wiki])
  const showWireShape = origin === 'model' && (!!remote.data || !!model.draft) && (mode === 'cloud' || mode === 'drift')
  const overviewLayout = useMemo(() => ({ ...settings, anchor: clusters?.anchor ?? (showWireShape ? wireAnchor : null), laneBy: grouping.laneBy, laneOrder: grouping.laneOrder,
    springsByKind: origin === 'stress' || origin.startsWith('count-') || origin === 'model' ? undefined : consoleLayout.springsByKind }), [settings, origin, clusters, grouping.laneBy, grouping.laneOrder, showWireShape])
  const engine = physics === 'worker' || physics === 'main' ? physics : undefined
  const effective = useMemo(() => drill.resolveLayout(mode, overviewLayout), [drill, mode, overviewLayout, snapshot.path, snapshot.options])
  const scopeKey = JSON.stringify(snapshot.path.map(({ kind, id, taxonomy, action, hops, direction, fromOverview }) =>
    [kind, id, taxonomy, action, hops, direction, fromOverview]))
  const view = useGraph(data, engine, effective.layout, theme, effective.mode, grouping.index, annotations, drill, source, scopeKey, retainedScene, wireEffects, style.drawing)
  useEffect(() => {
    if (tool !== 'node' || !view.instance) return
    return view.instance.on('backgroundclick', ({ x, y }) => {
      setPlacementPoint(view.instance.screenToWorld(x, y))
      document.querySelector('#document-composer input')?.focus({ preventScroll: true })
    })
  }, [tool, view.instance])
  useEffect(() => {
    const pending = pendingView.current
    if (!pending || pending.data !== source) return
    pendingView.current = null
    for (const { level, selected } of pending.trail) {
      if (level.kind === 'node') {
        const from = level.fromOverview ? source : drill.getSnapshot().data
        if (!from.nodes.some((n) => n.id === level.id)) break
        const open = level.fromOverview ? drill.followNode : drill.openNeighborhood
        open(level.id, { hops: level.hops, direction: level.direction })
      } else if (level.kind === 'group') {
        const term = grouping.root.legend(level.taxonomy).find((g) => g.id === level.id)
        if (!term || !drill.openGroup(drilldownGroup(term, source.nodes), level.action)) break
      }
      if (selected === null || drill.getSnapshot().data.nodes.some((n) => n.id === selected)) drill.inspect(selected)
    }
    if (pending.selected && model.state && source.nodes.some((n) => n.id === pending.selected)) {
      if (!drill.getSnapshot().data.nodes.some((n) => n.id === pending.selected)) drill.goTo(0)
      drill.inspect(pending.selected)
    }
  }, [drill, source, grouping.root, model.state])
  const singleGroupView = level.kind === 'group' && level.action === 'isolate' && effective.mode !== 'lanes' &&
    grouping.active.id === level.taxonomy && grouping.groups.length === 1 && grouping.groups[0].id === level.id
  const lastRoute = useRef(null)
  useEffect(() => {
    if (lastRoute.current?.drill === drill && lastRoute.current.path !== snapshot.path && !document.activeElement?.closest('.member-views, #document-composer')) {
      const target = level.fromOverview ? document.querySelector('.selected-object > summary') : view.canvas.current
      target?.focus({ preventScroll: true })
    }
    lastRoute.current = { drill, path: snapshot.path }
  }, [drill, snapshot.path, level, view.canvas])
  const kinds = useMemo(() => {
    const present = new Set(data.nodes.map((node) => node.kind ?? '').filter(Boolean))
    return [...kindOrder.filter((kind) => present.has(kind)), ...[...present].filter((kind) => !kindOrder.includes(kind)).sort()]
  }, [data])
  const wireKinds = useMemo(() => [...new Set(data.links.map((link) => link.kind ?? ''))].sort(), [data])
  const kind = kinds.includes(kindChoice) ? kindChoice : kinds[0]
  const wire = wireKinds.includes(wireChoice) ? wireChoice : wireKinds[0]
  const nodeStyle = marker(theme, kind)
  const wireStyle = theme.wires.byKind[wire] ?? {}
  const selected = useMemo(() => data.nodes.find((node) => node.id === snapshot.selected), [data, snapshot.selected])
  const articleURL = wikipediaSource(selected)
  const thumbnail = imageURL(data, selected, process.env.NEXT_PUBLIC_BASE_PATH)
  const description = selected && grouping.index.describe(selected.id)
  const bytes = selected && contentBytes(selected)
  const groupNames = description?.groups.filter((term) => term.taxonomy === grouping.active.id).map((term) => term.label)
  const stats = view.stats
  const adjust = (key, value) => setSettings((old) => ({ ...old, [key]: value }))
  const paint = (key, value) => setStyle((old) => ({ ...old, [key]: value }))
  const sizeNodes = (percent) => paint('nodeScale', percent / 100)
  function paintKind(patch) {
    setStyle((old) => ({ ...old, nodes: { ...old.nodes, [kind]: { ...old.nodes[kind], ...patch } } }))
  }
  function paintWire(patch) {
    setStyle((old) => ({ ...old, wires: { ...old.wires, [wire]: { ...old.wires[wire], ...patch } } }))
  }
  function chooseTool(next, link = null) {
    if (next) {
      try { model.editor() }
      catch (error) { setEditNotice(error.message); return }
    }
    setPlacementPoint(null)
    setWireEnds(null)
    setEditingLink(link)
    setTool(next)
    setEditNotice('')
  }
  function closeTool() {
    document.getElementById('tool-' + tool)?.focus()
    chooseTool(null)
  }
  function retainScene(editor, selectedId) {
    const next = editor.getSnapshot().data
    pendingView.current = { data: next, trail: drill.getTrail(), selected: selectedId }
    const graph = view.graph.current
    if (!graph) return
    const visible = new Set(data.nodes.map((n) => n.id)), poses = new Map()
    for (const old of source.nodes) {
      if (!visible.has(old.id)) continue
      const row = editor.getNode(old.id)
      if (row && ['x', 'y', 'z', 'pinned'].every((key) => old[key] === row[key])) poses.set(old.id, graph.getPosition(old.id))
    }
    retainedScene.current = { source: next, scopeKey, poses, viewport: graph.getViewport(), paused: view.paused }
  }
  function editDocument(tx, selectedId = snapshot.selected) {
    const editor = model.editor()
    const result = model.apply(tx)
    if (!result.ok) {
      setEditNotice(result.error.path + ' ' + result.error.message)
      return result
    }
    if (result.changes.length) retainScene(editor, selectedId)
    if (tool && tool !== 'json') closeTool()
    setEditNotice(result.changes.length ? 'Saved · revision ' + result.revision : 'Already up to date')
    return result
  }
  function editHistory(action) {
    if (!model.state) return
    const editor = model.editor(), result = editor[action](model.state.revision)
    if (!result.ok) { setEditNotice(result.error.message); return }
    retainScene(editor, snapshot.selected)
    if (tool !== 'json') chooseTool(null)
    setEditNotice((action === 'undo' ? 'Undone' : 'Redone') + ' · revision ' + result.revision)
  }
  function switchDataset(next) {
    chooseTool(null)
    requestedGroup.current = requestedArticle.current = null
    pendingView.current = null
    retainedScene.current = null
    if (next !== 'stress' && !next.startsWith('count-') && ['fixed', 'seeded'].includes(physics)) setPhysics('auto')
    setDataset(next)
  }
  function pickGraph(value) {
    const base = model.drafts.find((item) => item.key === value)?.origin ?? value
    if (getAtlas(base)) {
      grouping.setActive('section')
      grouping.setBoundary({ shape: 'hull', padding: 15, fillOpacity: 0.055, pattern: 'solid' })
      grouping.setVisible(true, 'section')
      grouping.setBubblesVisible(true)
      grouping.setBubbleLabels(true)
      setMode('drift')
      setPacked(true)
      setGap(90)
      setStyle(preset('sketchbook'))
      setEncoding({ ...initialEncoding, wire: 'weight', widths: [0.7, 2] })
      setWireEffects({ ...defaultWireEffects, separation: 10 })
      setSettings((old) => ({ ...old, blend: 1, autoRotate: false, guides: false }))
      setNavigation({ ...navigationDefaults, groupAction: 'isolate', detail: 'orbit' })
    }
    if (base === 'model') {
      setMode('cloud')
      setPacked(false)
      setEncoding(initialEncoding)
      setStyle(wireModelStyle())
      grouping.setActive('kind')
      setSettings((old) => ({ ...old, ...wireForces }))
    }
    if (base === 'sections') {
      grouping.setBubbleLabels(false)
      grouping.setActive('section')
      grouping.setBoundary({ shape: 'cloud', padding: 10, fillOpacity: 0.085 })
      grouping.setVisible(true, 'section')
      setMode('cloud')
      setPacked(true)
      setEncoding({ ...initialEncoding, node: 'contentSize', wire: 'weight', radii: [3, 8], widths: [0.5, 2.5] })
      setStyle({ ...preset('ink'), opacity: 0.34, fill: 0.65, alternateSide: true,
        wires: { contains: { color: '#a9b4bd' }, cites: { pattern: 'dashed' }, replicates: { pattern: 'dotted' } } })
      setSettings((old) => ({ ...old, blend: 0.82, autoRotate: false }))
    }
    const option = countOptions.find((entry) => entry.value === value)
    if (option) editWorkload(option.config)
    else if (value === 'stress') editWorkload(workload.config)
    switchDataset(value)
  }
  const requestedGroup = useRef(null)
  const requestedArticle = useRef(null)
  function selectDataset(value) {
    if (value === 'wikispeedia' || value === 'cards') { location.assign(studioURL + value + '/'); return }
    pickGraph(value)
    const url = new URL(location.href)
    for (const param of ['example','article','group','bubbles']) url.searchParams.delete(param)
    const example = getAtlas(value) ? value : { sections: 'clusters', model: 'wire-model', full: 'full', stress: 'stress' }[value]
    if (example) url.searchParams.set('example', example)
    history.replaceState(history.state, '', url)
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const example = params.get('example')
    if (example === 'full' || example === 'stress') pickGraph(example)
    if (getAtlas(example)) {
      pickGraph(example)
      requestedGroup.current = params.get('group')
      requestedArticle.current = params.get('article')
    }
    if (example === 'wire-model') pickGraph('model')
    if (['clusters', 'drilldown', 'lanes', 'wires'].includes(example)) {
      pickGraph('sections')
      if (example === 'drilldown') requestedGroup.current = params.get('group')
      if (example === 'lanes') {
        setMode('lanes')
        setPacked(false)
        setSettings((old) => ({ ...old, blend: 1, guides: true }))
        grouping.setBubblesVisible(false)
      }
      if (example === 'wires') {
        requestedGroup.current = 'Materials'
        setWireEffects({ ...defaultWireEffects, direction: 'flow', scope: 'all', separation: 22 })
        grouping.setBubblesVisible(false)
        setEncoding((old) => ({ ...old, widths: [1, 5] }))
        setStyle((old) => ({ ...old, route: 'arc', wires: {
          contains: { color: '#d1cfc0' }, cites: { color: '#e29973', pattern: 'dashed' }, replicates: { color: '#94c9ba', pattern: 'dotted' },
        } }))
      }
    }
    if (params.get('bubbles') === 'off') grouping.setBubblesVisible(false)
  }, [])
  useEffect(() => {
    if (wiki && remote.data && grouping.active.id === 'section') {
      const term = grouping.groups.find((g) => g.id === requestedGroup.current)
      requestedGroup.current = null
      if (term) drill.openGroup(drilldownGroup(term, data.nodes), 'isolate')
      const article = requestedArticle.current
      requestedArticle.current = null
      if (article && source.nodes.some((n) => n.id === article)) drill.followNode(article)
      return
    }
    if (!requestedGroup.current || dataset !== 'sections' || grouping.active.id !== 'section') return
    const term = grouping.groups.find((group) => group.id === requestedGroup.current)
    requestedGroup.current = null
    if (term) {
      setNavigation((old) => ({ ...old, detail: 'orbit' }))
      setStyle((old) => ({ ...old, opacity: 0.6 }))
      drill.openGroup(drilldownGroup(term, data.nodes), 'isolate')
    }
  }, [dataset, grouping.active.id, grouping.groups, drill, data.nodes, remote.data, source, wiki])
  function enableClusters(on) {
    setPacked(on)
    if (on) {
      if (mode === 'lanes' || mode === 'orbit') setMode('drift')
      if (settings.blend < 0.65) adjust('blend', 0.65)
      grouping.setBoundary({ shape: 'cloud' })
    }
  }

  return <>
    <header className="shrink-0">
      <div className="identity"><a className="wordmark studio-home" href={homeURL} aria-label="Loom field guide"><img src={artURL('loom-mark.svg')} width="20" height="18" alt="" />Loom</a>
        <span className="slash" aria-hidden="true">/</span><h1>Graph studio</h1></div>
      <EditorToolbar tool={tool} choose={chooseTool} select={() => { chooseTool(null); view.canvas.current?.focus() }}
        state={model.state} history={editHistory} ready={!remoteURL || !!remote.data}/>
      <GraphPicker value={dataset} onChange={selectDataset}>
        {custom && <option value="custom">{custom.name}</option>}
        {!!model.drafts.length && <optgroup label="Edited graphs">{model.drafts.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</optgroup>}
        <optgroup label="Generated node counts">{countOptions.map(({ value, config }) =>
          <option key={value} value={value}>{formatCount.format(config.nodes)} nodes · {formatCount.format(config.nodes * config.degree)} links</option>)}</optgroup>
      </GraphPicker>
      <div className="node-sizing" role="group" aria-label="Node sizing">
        <label htmlFor="node-size">Node size</label>
        <button type="button" id="size-down" aria-label="Decrease node size" disabled={nodeSize <= minNodeSize}
          onClick={() => sizeNodes(stepNodeSize(nodeSize, -1))}>−</button>
        <input id="node-size" type="range" min={minNodeSize} max={maxNodeSize} step="1" value={nodeSize}
          aria-valuetext={sizeLabel(nodeSize)} onChange={(e) => sizeNodes(Number(e.target.value))} />
        <button type="button" id="size-up" aria-label="Increase node size" disabled={nodeSize >= maxNodeSize}
          onClick={() => sizeNodes(stepNodeSize(nodeSize, 1))}>+</button>
        <button type="button" id="size-default" aria-label="Reset node size" title={'Reset to theme size (' + sizeLabel(defaultSize) + ')'}
          onClick={() => sizeNodes(defaultSize)}><output id="size-value" htmlFor="node-size">{sizeLabel(nodeSize)}</output><span aria-hidden="true">↺</span></button>
      </div>
    </header>
    <main className="studio-workspace min-w-0">
      <section id="studio-stage" className="stage isolate" data-atlas={wiki ? origin : undefined} data-editor-tool={tool} data-member-detail={singleGroupView || undefined}
        aria-label="Graph viewport" style={{ backgroundColor: theme.bg, '--map-ink': theme.ink, '--map-bg': theme.bg }}
        onPointerUp={view.syncPin} onPointerCancel={view.syncPin} onKeyDownCapture={(event) => {
          if (event.key === 'Escape' && event.target === view.canvas.current && (tool || snapshot.path.length > 1)) {
            event.preventDefault(); event.stopPropagation()
            if (tool) closeTool()
            else drill.back()
          }
        }}>
        {wiki && <div className="atlas-title"><span>Wikipedia atlas</span><h2>{wiki.title}</h2></div>}
        {wiki && <button type="button" className="atlas-find" aria-label="Find an article" onClick={findInGraph}>Find <kbd>/</kbd></button>}
        <div className="graph-surface">
          <div ref={view.underlay} className="graph-boundaries" aria-hidden="true" />
          <canvas id="graph" ref={view.canvas} aria-describedby={[level.kind !== 'overview' && 'drill-location', selected && 'selection'].filter(Boolean).join(' ') || undefined}
            aria-label={effective.mode === 'cloud' ? '3D graph. Drag empty space or use arrow keys to orbit. Drag a node to move it. Enter opens the selection.' : 'Knowledge graph. Drag a node to move it. Arrow keys pan, plus and minus zoom. Enter opens the selection.'} />
          {tool === 'link' && <WirePreview graph={view.instance} canvas={view.canvas} nodes={data.nodes}
            ends={wireEnds} route={style.route} accent={theme.accent} background={theme.bg}/>}
          <div ref={view.layer} className="graph-annotations" style={{ '--loom-overlay-bg': theme.bezel, '--loom-overlay-ink': theme.ink }} />
        </div>
        <div id="legend" className="legend" role="group" aria-label={grouping.active.label} hidden={effective.mode === 'lanes' || singleGroupView} style={{ '--map-ink': theme.ink, '--map-bg': theme.bg }}>
          {grouping.groups.length > 0 && <span className="legend-title">{grouping.active.label}</span>}
          {grouping.groups.slice(0, 12).map((term) => {
            const item = grouping.displayStyle(term)
            const expanded = level.kind === 'group' && level.id === term.id && level.taxonomy === term.taxonomy
            const content = <><i data-shape={item.shape ?? 'circle'} style={{ '--kind': item.color }} /><span className="legend-name">{term.label}</span><small>{term.members.length}</small></>
            return groupEnabled ? <button type="button" key={term.key} data-group={term.id} onClick={() => openTerm(term)}
              aria-description={term.members.length + ' members'} aria-expanded={expanded} aria-label={(expanded ? 'Close ' : 'Open ') + term.label + ' group'}>{content}<i className="group-indicator" aria-hidden="true" /></button> :
              <span key={term.key}>{content}</span>
          })}
          {grouping.groups.length > 12 && <span>+{grouping.groups.length - 12} groups</span>}
        </div>
        {effective.mode === 'cloud' && <CloudCompass graph={view.instance} ink={theme.ink} />}
        <DrillTrail snapshot={snapshot} drill={drill} />
        {wiki && selected && !perf && <button type="button" className="atlas-inspect" onClick={() => {
          const card = document.querySelector('.selected-object')
          if (card) { card.open = true; card.querySelector('summary').focus(); card.scrollIntoView({ block: 'nearest' }) }
        }}>Inspect {selected.label ?? selected.id} <span aria-hidden="true">↗</span></button>}
        {perf && <PerfPanel graph={view.instance} data={data} paused={view.paused} onClose={() => { setPerf(false); document.getElementById('perf-toggle')?.focus() }} />}
        <div className="stage-tools">
          <button id="fit" onClick={() => view.graph.current?.fit()}>Fit view</button>
          <button id="reset" onClick={() => view.graph.current?.reset()}>Reset view</button>
          <button id="pause" onClick={view.togglePause}>{view.paused ? 'Resume' : 'Pause'}</button>
          <button id="perf-toggle" aria-pressed={perf} aria-controls="perf-panel" onClick={() => setPerf(!perf)}>Perf</button>
        </div>
        {remoteURL && !remote.data && <div role="status" className="absolute inset-x-4 top-14 mx-auto w-fit rounded-md bg-paper px-3 py-2 text-graphite shadow-md">
          {remote.isError ? <>{remote.error.message} <button onClick={() => remote.refetch()}>Retry</button></> : 'Loading the graph…'}
        </div>}
        <p id="error" role="alert" hidden={!view.error}>{view.error}</p>
      </section>
      <Splitter />
      <SettingsTabs>
        <DocumentComposer tool={tool} link={editingLink} model={model} point={placementPoint} clearPoint={() => setPlacementPoint(null)}
          selectedId={view.selected} graph={view.instance} run={editDocument} close={closeTool} onEndpoints={setWireEnds}/>
        {editNotice && <output className="document-status" aria-live="polite">{editNotice}</output>}
        {selected && <section className="selection" aria-label="Selected node">
          <InspectorSection key={selected.id} title={<span id="selection" aria-live="polite">{description?.title ?? selected.id}</span>} value={view.pinned ? 'Pinned' : selected.kind || 'Node'} initialOpen className="selected-object">
          {articleURL && <div className="article-source">{selected.summary && <p>{selected.summary}</p>}
            <a href={articleURL} target="_blank" rel="noreferrer">Read on Wikipedia <span aria-hidden="true">↗</span></a>
            {requestedAtlas && <a href={studioURL + '?' + new URLSearchParams({ example: dataset, article: selected.id })}>Article permalink</a>}</div>}
          <p id="selection-meta">{description && ((groupNames.join(', ') || grouping.index.ungrouped) + ' · ' + description.connections + (view.pinned ? ' · pinned' : ''))}</p>
          <div className="selection-tools" hidden={!selected}><button id="focus" onClick={() => selected && view.graph.current?.focus(selected.id)}>Focus node</button>
            <button id="pin" onClick={view.togglePin}>{view.pinned ? 'Release node' : 'Pin node'}</button></div>
          {selected && <div className="selection-tools drill-actions"><button id="open-neighbors" onClick={() => drill.openNeighborhood(selected.id)}>Open neighbors</button>
            <button type="button" onClick={() => setCardRoot(selected.id)}>View relationship cards</button>
            {groupEnabled && description?.groups.filter((g) => g.taxonomy === grouping.active.id).map((g) =>
              <button key={g.key} onClick={() => openTerm(g)}>{level.kind === 'group' && level.id === g.id && level.taxonomy === g.taxonomy ? 'Close' : 'Open'} {g.label}</button>)}</div>}
          <NodeLinks key={selected.id} node={selected} index={graphIndex} follow={drill.followNode} article={!!articleURL}/>
          <MarkerProperties key={JSON.stringify([selected.id, selected.markerColor, selected.markerShape])} node={selected}
            ink={grouping.nativeMarkers ? marker(theme, selected.kind).color : grouping.index.primary(selected.id, grouping.active.id)?.color ?? theme.dim}
            model={model} run={editDocument}/>
          <NodeProperties key={JSON.stringify([selected.id, selected.label, selected.kind])} node={selected} connectionsLabel={description?.connections} model={model} run={editDocument} editLink={(link) => chooseTool('link', link)} initialOpen={!articleURL}/>
          {selected && <dl className="selection-metrics">{Object.entries({ Section: selected.section,
            'Content bytes': bytes === undefined ? undefined : formatCount.format(bytes), Complexity: selected.complexity,
            ...selected.metrics }).filter(([,v]) => v != null).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          {thumbnail && <img className="selection-image" src={thumbnail} alt={description?.title ?? 'Node artwork'} />}
          {(selected?.content || (!articleURL && selected?.summary)) && <p className="selection-content">{selected.content || selected.summary}</p>}
          </InspectorSection>
        </section>}
        {cardRoot && selected?.id===cardRoot && <StudioCardDialog data={source} root={cardRoot} close={()=>setCardRoot(null)}
          inspect={id=>{setCardRoot(null);if(id!==selected.id)drill.followNode(id)}}/>}
        <SettingsPanel id="explore">
          <DrillControls dataset={dataset} snapshot={snapshot} config={navigation} setView={drill.setGroupView}
            index={graphIndex} follow={drill.followNode} atlas={wiki} group={grouping} openTerm={groupEnabled ? openTerm : undefined}
            inspect={(id, fromSearch) => { drill.inspect(id); if (fromSearch) view.canvas.current?.focus({ preventScroll: true }) }}
            select={(id) => { drill.select(id); view.canvas.current?.focus({ preventScroll: true }) }} change={(key, value) => setNavigation((old) => ({ ...old, [key]: value }))} />
        </SettingsPanel>
        <SettingsPanel id="layout"><section>
          <h2 id="settings-layout" tabIndex={-1}>{level.kind === 'overview' ? 'Layout' : 'Overview layout'}</h2>
          <Range id="blend" label="Structure" min={0} max={100} value={Math.round(settings.blend * 100)} format={percent} onChange={(v) => adjust('blend', v / 100)} />
          <div className="range-ends"><span>Force directed</span><span>Node graph</span></div>
          <div className="modes" role="group" aria-label="Force mode">{modes.map((name) =>
            <button key={name} data-mode={name.toLowerCase()} aria-pressed={mode === name.toLowerCase()} onClick={() => {
              if (name === 'Lanes' || name === 'Orbit') setPacked(false)
              setMode(name.toLowerCase())
            }}>{name}</button>
          )}</div>
          {mode === 'orbit' && <div className="orbit-settings"><p>Select a node to centre its orbit.</p>
            <Range id="orbit-gap" label="Ring spacing" min={25} max={220} value={settings.orbitGap} onChange={(v) => adjust('orbitGap', v)} /></div>}
          {mode === 'cloud' && <div className="cloud-settings">
            <Range id="cloud-depth" label="Depth spread" min={0} max={300} step={5} value={Math.round(settings.cloudDepth * 100)} format={percent} onChange={(v) => adjust('cloudDepth', v / 100)} />
            <Check id="cloud-rotate" label="Auto-rotate when idle" checked={settings.autoRotate} onChange={(v) => adjust('autoRotate', v)} /></div>}
          <Select id="direction" label="Lane direction" options={directions} value={settings.direction} onChange={(v) => adjust('direction', v)} />
          <Check id="pin-drag" label="Pin nodes after dragging" checked={settings.pinOnDrag} onChange={(v) => adjust('pinOnDrag', v)} />
          <InspectorSection title="Spacing &amp; forces" value={modes.find((m) => m.toLowerCase() === mode)} reveal={mode}>
            <Range id="lane-gap" label="Lane spacing" min={40} max={360} value={settings.laneGap} onChange={(v) => adjust('laneGap', v)} />
            <Range id="row-gap" label="Row spacing" min={16} max={160} value={settings.rowGap} onChange={(v) => adjust('rowGap', v)} />
            <Range id="link-distance" label="Link distance" min={0} max={180} value={settings.linkDistance} onChange={(v) => adjust('linkDistance', v)} />
            <Range id="spring" label="Spring strength" min={0} max={4} step={0.05} value={settings.springStrength} format={times} onChange={(v) => adjust('springStrength', v)} />
            <Range id="repulsion" label="Repulsion" min={0} max={4} step={0.05} value={settings.repulsion} format={times} onChange={(v) => adjust('repulsion', v)} />
          </InspectorSection>
        </section></SettingsPanel>
        <SettingsPanel id="groups">
          <Grouping level={level} group={grouping} packed={packed} setPacked={enableClusters} gap={gap} setGap={setGap} openTerm={groupEnabled ? openTerm : undefined} />
        </SettingsPanel>
        <SettingsPanel id="style"><section>
          <h2 id="settings-style" tabIndex={-1}>Appearance</h2>
          <Select id="theme" label="Theme" options={palettes} value={style.name} onChange={(v) => setStyle(preset(v))} />
          <DrawingControls style={style} paint={paint}/>
          <Select id="route" label="Wires" options={routes} value={style.route} onChange={(v) => paint('route', v)} />
          <Select id="wire-pattern" label="Wire stroke" options={patterns} value={style.pattern} onChange={(v) => paint('pattern', v)} />
          <WireControls effects={wireEffects} setEffects={setWireEffects} route={style.route}/>
          <EncodingControls mapped={mapped} onChange={(patch) => setEncoding((old) => ({ ...old, ...patch }))} />
          <InspectorSection title="Style controls" value={routes.find(([key]) => key === style.route)?.[1]} reveal={style.name + '/' + style.route}>
            <Range id="marker-fill" label="Marker fill" min={0} max={100} value={Math.round(100 * (style.fill ?? themePresets[style.name].nodes?.fill ?? 0.38))}
              format={percent} onChange={(value) => paint('fill', value / 100)} />
            <Select id="kind" label="Node kind" options={kinds.map((k) => [k, k])} value={kind} onChange={chooseKind} />
            <Color id="kind-color" label="Marker colour" value={nodeStyle.color} onChange={(color) => paintKind({ color })} />
            <Select id="shape" label="Marker shape" options={shapes} value={nodeStyle.shape} onChange={(shape) => paintKind({ shape })} />
            <Select id="wire-kind" label="Link kind" options={wireKinds.map((k) => [k, k || 'Untyped'])} value={wire} onChange={chooseWire} />
            <Select id="kind-pattern" label="Kind stroke" options={[[ '', 'Use wire stroke'], ...patterns]} value={wireStyle.pattern ?? ''} onChange={(v) => paintWire({ pattern: v || undefined })} />
            <Color id="wire-color" label="Link colour" value={wireStyle.color ?? theme.wires.color ?? theme.dim} onChange={(color) => paintWire({ color })} />
            <Range id="wire-width" label={mapped.width ? 'Fallback link width' : 'Link width'} min={0} max={8} step={0.1} value={wireStyle.width ?? theme.wires.width ?? 1.3} outputId="width-value" format={(v) => v + ' px'} onChange={(width) => paintWire({ width })} />
            <Range id="wire-opacity" label="Wire opacity" min={0} max={100} value={Math.round(style.opacity * 100)} outputId="opacity-value" format={percent} onChange={(v) => paint('opacity', v / 100)} />
            <Select id="labels" label="Labels" options={labels} value={style.labels} onChange={(v) => paint('labels', v)} />
            <Check id="label-sides" label="Allow labels on either side" checked={style.alternateSide} onChange={(v) => paint('alternateSide', v)} />
            <div className="checks"><Check id="artwork" label="Artwork" checked={style.artwork} onChange={(v) => paint('artwork', v)} />
              <Check id="guides" label="Lane guides" checked={settings.guides} onChange={(v) => adjust('guides', v)} />
              <Check id="grid" label="Grid" checked={style.grid} onChange={(v) => paint('grid', v)} /></div>
          </InspectorSection>
        </section></SettingsPanel>
        <WorkloadControls data={source} active={stress || dataset === 'custom'} draft={workloadDraft} edit={editWorkload}
          onGenerate={(config, next) => { setWorkload({ config, data: next }); switchDataset('stress') }}
          onLoad={(next, name) => { setCustom({ data: next, name }); switchDataset('custom') }} />
        <InspectorSection className="diagnostics" title="Simulation &amp; diagnostics" value={stats?.transport ?? physics}>
          <Select id="physics" label="Simulation" options={stress ? [...simulations, ...positioned] : simulations} value={physics} onChange={setPhysics} />
          <dl><dt>First draw submission</dt><dd id="first">{stats ? stats.firstSubmitMs.toFixed(2) + ' ms' : '—'}</dd>
            <dt>Draw calls</dt><dd id="draws">{stats?.drawCalls ?? '—'}</dd>
            <dt>Layout ticks</dt><dd id="ticks">{stats?.simTicks ?? '—'}</dd>
            <dt>Transport</dt><dd id="transport">{stats?.transport ?? '—'}</dd></dl>
          <button id="refresh" onClick={view.refresh}>Refresh counters</button>
        </InspectorSection>
      </SettingsTabs>
    </main>
    <footer className="shrink-0 flex-wrap gap-x-3 gap-y-1 py-1">
      <span id="totals" className="whitespace-nowrap tabular-nums">{formatCount.format(data.nodes.length)} {data.nodes.length === 1 ? 'node' : 'nodes'} · {formatCount.format(data.links.length)} {data.links.length === 1 ? 'link' : 'links'}</span>
      <span>{level.kind === 'group' && level.action === 'expand' ? 'Drag a member to pull its neighbors. Back collapses the group.' :
        groupEnabled && grouping.annotations.bubblesVisible && navigation.groupGesture !== 'controls' && Object.values(grouping.annotations.bubbles).some((terms) => terms === true || terms.length) ? (navigation.groupGesture === 'click' ? 'Click' : 'Double-click') + ' inside a bubble to open its group. Drag a node to move it.' :
        'Drag a node to pull its neighbors. Enter activates the selection.'}</span>
      <a className="underline underline-offset-2" href={docsURL}>SDK docs</a>
    </footer>
  </>
}
