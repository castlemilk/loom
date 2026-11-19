'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { consoleLayout } from '../../dist/console.js'
import { buildWorkload, initialWorkload, imageURL, maxLinks, sectionAtlas } from './workload.mjs'
import { clusterLayout } from '../../dist/clusters.js'
import { createDrilldown, drilldownGroup } from '../../dist/drilldown.js'
import { contentBytes } from '../../dist/metrics.js'
import { EncodingControls, initialEncoding, useEncodings } from './encodings'
import { maxNodeSize, minNodeSize, nodeCounts, sizeLabel, stepNodeSize } from '../../demo/node-controls.js'
import { WorkloadControls } from './workload-controls'
import { CloudCompass, PerfPanel } from './perf-panel'
import { Check, Color, Range, Select } from './fields'
import { kindOrder, makeTheme, marker, palettes as themePresets, patterns, preset } from './appearance'
import { useGraph } from './use-graph'
import { Grouping, useGrouping } from './grouping'
import { Splitter } from './splitter'
import { DrillControls, DrillTrail, detailOptions, navigationDefaults } from './drilldown-controls'
import { artURL, fetchGraphFile, homeURL, modelURL, settingsSections } from '../site'
import { wireAnchor, wireForces, wireStyle } from './wire-study'

const datasets = [['sample', 'Knowledge console · excerpt'], ['sections', 'Section atlas'], ['model', 'Wire model'], ['full', 'Knowledge console · full'], ['stress', 'Generated stress graph']]
const modes = ['Drift', 'Lanes', 'Orbit', 'Cloud']
const simulations = [['auto', 'Automatic'], ['main', 'Main thread'], ['worker', 'Worker']]
const positioned = [['seeded', 'Positioned · movable'], ['fixed', 'Positioned · pinned']]
const directions = [['horizontal', 'Left to right'], ['vertical', 'Top to bottom']]
const routes = [['patch', 'Patch cables'], ['arc', 'Arcs'], ['straight', 'Straight lines']]
const shapes = [['circle', 'Disc'], ['ring', 'Ring'], ['square', 'Square'], ['rounded-square', 'Rounded square']]
const palettes = [['console', 'Knowledge console'], ['ink', 'Ink'], ['parchment', 'Parchment'], ['blueprint', 'Blueprint']]
const labels = [['auto', 'Automatic'], ['focus', 'Focus only'], ['none', 'Hidden']]
const formatCount = new Intl.NumberFormat('en')
const percent = (value) => value + '%'
const times = (value) => value + '×'

function SettingsNav() {
  return <nav className="settings-nav" aria-label="Graph settings">
    {settingsSections.map(({ id, label }) => <a key={id} href={'#settings-' + id}>
      <img className="settings-art" src={artURL(id + '.webp')} width="35" height="35" alt="" />{label}
    </a>)}
  </nav>
}

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
  const remoteURL = dataset === 'model' ? modelURL : dataset === 'full' ? homeURL + 'graphs/knowledge.json' : null
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
  const source = atlas ?? (stress ? generated : dataset === 'custom' && custom ? custom.data : remote.data ?? sample)
  const drill = useMemo(() => createDrilldown(source), [source])
  const snapshot = useSyncExternalStore(drill.subscribe, drill.getSnapshot, drill.getSnapshot)
  const data = useMemo(() => snapshot.data === source ? source : { ...source, ...snapshot.data }, [source, snapshot.data])
  const level = snapshot.path.at(-1)
  const palette = useMemo(() => makeTheme(style), [style])
  const grouping = useGrouping(source, data, palette, packed)
  const groupFor = useCallback((node) => {
    const term = grouping.index.primary(node.id, grouping.active.id)
    return term && drilldownGroup(term, data.nodes)
  }, [grouping.index, grouping.active.id, data.nodes])
  const openTerm = useCallback((term) => {
    if (level.kind === 'group' && term.id === level.id && term.taxonomy === level.taxonomy) return drill.back()
    return drill.openGroup(drilldownGroup(term, data.nodes))
  }, [drill, data.nodes, level])
  useEffect(() => {
    drill.setOptions({ selectAction: navigation.selectAction, openAction: navigation.openAction,
      groupAction: navigation.groupAction, groupFor, detail: detailOptions(navigation.detail),
      spread: navigation.spread, arrangement: navigation.arrangement, memberSpacing: navigation.spacing * style.nodeScale,
      expansionBlend: navigation.expansionBlend, neighborhood: { hops: navigation.hops, direction: navigation.direction } })
  }, [drill, groupFor, navigation, style.nodeScale])
  const groupEnabled = navigation.groupAction !== 'none'
  const annotations = useMemo(() => ({ ...grouping.annotations, onOpenGroup: groupEnabled ? openTerm : undefined,
    groupGesture: navigation.groupGesture, activeGroup: level.kind === 'group' ? { taxonomy: level.taxonomy, id: level.id, boundary: navigation.boundary,
      shape: level.action === 'expand' && navigation.boundary === 'outline' ? 'hull' : undefined } : undefined }),
    [grouping.annotations, groupEnabled, openTerm, navigation.groupGesture, level, navigation.boundary])
  const mapped = useEncodings(data, encoding)
  const theme = useMemo(() => {
    const nodes = grouping.nativeMarkers && !mapped.radius ? palette.nodes : { ...palette.nodes, resolve: (node, degree) => {
      const base = palette.nodes?.resolve?.(node, degree)
      const term = grouping.nativeMarkers ? null : grouping.index.primary(node.id, grouping.active.id)
      return { ...base, ...(!grouping.nativeMarkers && { color: term?.color ?? palette.dim, shape: term?.shape ?? 'circle' }), ...mapped.radius?.(node) }
    } }
    const wires = mapped.width ? { ...palette.wires, resolve: (link, i) => ({ ...palette.wires?.resolve?.(link, i), ...mapped.width(link, i) }) } : palette.wires
    return { ...palette, nodes, wires }
  }, [palette, grouping.nativeMarkers, grouping.index, grouping.active.id, mapped.radius, mapped.width])
  const clusters = useMemo(() => packed ? clusterLayout(data.nodes, grouping.laneBy,
    { gap, dimensions: mode === 'cloud' ? 3 : 2, depth: settings.cloudDepth }) : null,
    [packed, data, grouping.laneBy, gap, mode, settings.cloudDepth])
  const showWireShape = dataset === 'model' && !!remote.data && (mode === 'cloud' || mode === 'drift')
  const overviewLayout = useMemo(() => ({ ...settings, anchor: clusters?.anchor ?? (showWireShape ? wireAnchor : null), laneBy: grouping.laneBy, laneOrder: grouping.laneOrder,
    springsByKind: stress || dataset === 'model' ? undefined : consoleLayout.springsByKind }), [settings, stress, clusters, grouping.laneBy, grouping.laneOrder, dataset, showWireShape])
  const engine = physics === 'worker' || physics === 'main' ? physics : undefined
  const effective = useMemo(() => drill.resolveLayout(mode, overviewLayout), [drill, mode, overviewLayout, snapshot.path, snapshot.options])
  const view = useGraph(data, engine, effective.layout, theme, effective.mode, grouping.index, annotations, drill)
  const singleGroupView = level.kind === 'group' && level.action === 'isolate' && effective.mode !== 'lanes' &&
    grouping.active.id === level.taxonomy && grouping.groups.length === 1 && grouping.groups[0].id === level.id
  const lastRoute = useRef(null)
  useEffect(() => {
    if (lastRoute.current?.drill === drill && lastRoute.current.path !== snapshot.path && !document.activeElement?.closest('.member-views')) {
      view.canvas.current?.focus({ preventScroll: true })
    }
    lastRoute.current = { drill, path: snapshot.path }
  }, [drill, snapshot.path, view.canvas])
  const kinds = useMemo(() => {
    const present = new Set(data.nodes.map((node) => node.kind ?? '').filter(Boolean))
    return [...kindOrder.filter((kind) => present.has(kind)), ...[...present].filter((kind) => !kindOrder.includes(kind)).sort()]
  }, [data])
  const wireKinds = useMemo(() => [...new Set(data.links.map((link) => link.kind ?? ''))].sort(), [data])
  const kind = kinds.includes(kindChoice) ? kindChoice : kinds[0]
  const wire = wireKinds.includes(wireChoice) ? wireChoice : wireKinds[0]
  const nodeStyle = marker(theme, kind)
  const wireStyle = theme.wires.byKind[wire] ?? {}
  const selected = useMemo(() => data.nodes.find((node) => node.id === view.selected), [data, view.selected])
  const thumbnail = imageURL(data, selected, process.env.NEXT_PUBLIC_BASE_PATH)
  const description = selected && grouping.index.describe(selected.id)
  const bytes = selected && contentBytes(selected)
  const groupNames = description?.groups.filter((term) => term.taxonomy === grouping.active.id).map((term) => term.label)
  const stats = view.stats
  const adjust = (key, value) => setSettings((old) => ({ ...old, [key]: value }))
  const paint = (key, value) => setStyle((old) => ({ ...old, [key]: value }))
  const sizeNodes = (percent) => paint('nodeScale', percent / 100)
  function paintKind(patch) {
    setStyle((old) => ({ ...old, nodes: { ...old.nodes, [kind]: { ...nodeStyle, ...patch } } }))
  }
  function paintWire(patch) {
    setStyle((old) => ({ ...old, wires: { ...old.wires, [wire]: { ...old.wires[wire], ...patch } } }))
  }
  function switchDataset(next) {
    if (next !== 'stress' && !next.startsWith('count-') && ['fixed', 'seeded'].includes(physics)) setPhysics('auto')
    setDataset(next)
  }
  function pickGraph(value) {
    if (value === 'model') {
      setMode('cloud')
      setPacked(false)
      setEncoding(initialEncoding)
      setStyle(wireStyle())
      grouping.setActive('kind')
      setSettings((old) => ({ ...old, ...wireForces }))
    }
    if (value === 'sections') {
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
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const example = params.get('example')
    if (example === 'wire-model') pickGraph('model')
    if (['clusters', 'drilldown', 'lanes', 'wires'].includes(example)) {
      if (example === 'drilldown') requestedGroup.current = params.get('group')
      pickGraph('sections')
      if (example === 'lanes') {
        setMode('lanes')
        setPacked(false)
        setSettings((old) => ({ ...old, blend: 1, guides: true }))
        grouping.setBubblesVisible(false)
      }
      if (example === 'wires') {
        requestedGroup.current = 'Materials'
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
    if (!requestedGroup.current || dataset !== 'sections' || grouping.active.id !== 'section') return
    const term = grouping.groups.find((group) => group.id === requestedGroup.current)
    requestedGroup.current = null
    if (term) {
      setNavigation((old) => ({ ...old, detail: 'orbit' }))
      setStyle((old) => ({ ...old, opacity: 0.6 }))
      drill.openGroup(drilldownGroup(term, data.nodes), 'isolate')
    }
  }, [dataset, grouping.active.id, grouping.groups, drill, data.nodes])
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
      <label className="dataset">Graph<select id="dataset" value={dataset} onChange={(e) => pickGraph(e.target.value)}>
        {datasets.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        {custom && <option value="custom">{custom.name}</option>}
        <optgroup label="Generated node counts">{countOptions.map(({ value, config }) =>
          <option key={value} value={value}>{formatCount.format(config.nodes)} nodes · {formatCount.format(config.nodes * config.degree)} links</option>)}</optgroup>
      </select></label>
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
      <section id="studio-stage" className="stage isolate" data-member-detail={singleGroupView || undefined} aria-label="Graph viewport" style={{ backgroundColor: theme.bg }}
        onPointerUp={view.syncPin} onPointerCancel={view.syncPin} onKeyDownCapture={(event) => {
          if (event.key === 'Escape' && event.target === view.canvas.current && snapshot.path.length > 1) {
            event.preventDefault(); event.stopPropagation(); drill.back()
          }
        }}>
        <div className="graph-surface">
          <div ref={view.underlay} className="graph-boundaries" aria-hidden="true" />
          <canvas id="graph" ref={view.canvas} aria-describedby={[level.kind !== 'overview' && 'drill-location', selected && 'selection'].filter(Boolean).join(' ') || undefined}
            aria-label={effective.mode === 'cloud' ? '3D graph. Drag empty space or use arrow keys to orbit. Drag a node to move it. Enter opens the selection.' : 'Knowledge graph. Drag a node to move it. Arrow keys pan, plus and minus zoom. Enter opens the selection.'} />
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
      <aside id="studio-controls" aria-label="Graph controls" className="min-w-0 min-[701px]:overscroll-contain">
        <SettingsNav />
        <DrillControls dataset={dataset} snapshot={snapshot} config={navigation} setView={drill.setGroupView}
          inspect={(id, fromSearch) => { drill.inspect(id); if (fromSearch) view.canvas.current?.focus({ preventScroll: true }) }}
          select={(id) => { drill.select(id); view.canvas.current?.focus({ preventScroll: true }) }} change={(key, value) => setNavigation((old) => ({ ...old, [key]: value }))} />
        <section className="selection" aria-label="Selected node" hidden={!selected}>
          <h2 id="selection" aria-live="polite">{description?.title ?? 'Select a node to inspect its links.'}</h2>
          <p id="selection-meta">{description && ((groupNames.join(', ') || grouping.index.ungrouped) + ' · ' + description.connections + (view.pinned ? ' · pinned' : ''))}</p>
          <div className="selection-tools" hidden={!selected}><button id="focus" onClick={() => selected && view.graph.current?.focus(selected.id)}>Focus node</button>
            <button id="pin" onClick={view.togglePin}>{view.pinned ? 'Release node' : 'Pin node'}</button></div>
          {selected && <div className="selection-tools drill-actions"><button id="open-neighbors" onClick={() => drill.openNeighborhood(selected.id)}>Open neighbors</button>
            {groupEnabled && description?.groups.filter((g) => g.taxonomy === grouping.active.id).map((g) =>
              <button key={g.key} onClick={() => openTerm(g)}>{level.kind === 'group' && level.id === g.id && level.taxonomy === g.taxonomy ? 'Close' : 'Open'} {g.label}</button>)}</div>}
          {selected && <dl className="selection-metrics">{Object.entries({ Section: selected.section,
            'Content bytes': bytes === undefined ? undefined : formatCount.format(bytes), Complexity: selected.complexity,
            ...selected.metrics }).filter(([,v]) => v != null).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          {thumbnail && <img className="selection-image" src={thumbnail} alt={description?.title ?? 'Node artwork'} />}
          {(selected?.content || selected?.summary) && <p className="selection-content">{selected.content || selected.summary}</p>}
        </section>
        <section><h2 id="settings-layout" tabIndex={-1}>{level.kind === 'overview' ? 'Layout' : 'Overview layout'}</h2>
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
          <details><summary>Spacing &amp; forces</summary>
            <Range id="lane-gap" label="Lane spacing" min={40} max={360} value={settings.laneGap} onChange={(v) => adjust('laneGap', v)} />
            <Range id="row-gap" label="Row spacing" min={16} max={160} value={settings.rowGap} onChange={(v) => adjust('rowGap', v)} />
            <Range id="link-distance" label="Link distance" min={0} max={180} value={settings.linkDistance} onChange={(v) => adjust('linkDistance', v)} />
            <Range id="spring" label="Spring strength" min={0} max={4} step={0.05} value={settings.springStrength} format={times} onChange={(v) => adjust('springStrength', v)} />
            <Range id="repulsion" label="Repulsion" min={0} max={4} step={0.05} value={settings.repulsion} format={times} onChange={(v) => adjust('repulsion', v)} />
          </details>
        </section>
        <Grouping level={level} group={grouping} packed={packed} setPacked={enableClusters} gap={gap} setGap={setGap} openTerm={groupEnabled ? openTerm : undefined} />
        <section><h2 id="settings-style" tabIndex={-1}>Appearance</h2>
          <Select id="theme" label="Theme" options={palettes} value={style.name} onChange={(v) => setStyle(preset(v))} />
          <Select id="route" label="Wires" options={routes} value={style.route} onChange={(v) => paint('route', v)} />
          <Select id="wire-pattern" label="Wire stroke" options={patterns} value={style.pattern} onChange={(v) => paint('pattern', v)} />
          <EncodingControls mapped={mapped} onChange={(patch) => setEncoding((old) => ({ ...old, ...patch }))} />
          <details><summary>Style controls</summary>
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
          </details>
        </section>
        <WorkloadControls data={source} active={stress || dataset === 'custom'} draft={workloadDraft} edit={editWorkload}
          onGenerate={(config, next) => { setWorkload({ config, data: next }); switchDataset('stress') }}
          onLoad={(next, name) => { setCustom({ data: next, name }); switchDataset('custom') }} />
        <details className="diagnostics"><summary>Simulation &amp; diagnostics</summary>
          <Select id="physics" label="Simulation" options={stress ? [...simulations, ...positioned] : simulations} value={physics} onChange={setPhysics} />
          <dl><dt>First draw submission</dt><dd id="first">{stats ? stats.firstSubmitMs.toFixed(2) + ' ms' : '—'}</dd>
            <dt>Draw calls</dt><dd id="draws">{stats?.drawCalls ?? '—'}</dd>
            <dt>Layout ticks</dt><dd id="ticks">{stats?.simTicks ?? '—'}</dd>
            <dt>Transport</dt><dd id="transport">{stats?.transport ?? '—'}</dd></dl>
          <button id="refresh" onClick={view.refresh}>Refresh counters</button>
        </details>
      </aside>
    </main>
    <footer className="shrink-0 flex-wrap gap-x-3 gap-y-1 py-1">
      <span id="totals" className="whitespace-nowrap tabular-nums">{formatCount.format(data.nodes.length)} {data.nodes.length === 1 ? 'node' : 'nodes'} · {formatCount.format(data.links.length)} {data.links.length === 1 ? 'link' : 'links'}</span>
      <span>{level.kind === 'group' && level.action === 'expand' ? 'Drag a member to pull its neighbors. Back collapses the group.' :
        groupEnabled && grouping.annotations.bubblesVisible && navigation.groupGesture !== 'controls' && Object.values(grouping.annotations.bubbles).some((terms) => terms === true || terms.length) ? (navigation.groupGesture === 'click' ? 'Click' : 'Double-click') + ' inside a bubble to open its group. Drag a node to move it.' :
        'Drag a node to pull its neighbors. Enter activates the selection.'}</span>
      <a className="underline underline-offset-2" href="https://github.com/castlemilk/loom#drilldowns-and-group-interactions">TypeScript API</a>
    </footer>
  </>
}
