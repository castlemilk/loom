'use client'

import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { consoleLayout } from '../../dist/console.js'
import { fixture } from '../../demo/fixture.js'
import { Check, Color, Range, Select } from './fields'
import { kindOrder, makeTheme, marker, preset } from './appearance'
import { useGraph } from './use-graph'

const datasets = [['sample', 'Knowledge console · excerpt'], ['full', 'Knowledge console · full'], ['stress', 'Generated stress graph']]
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

async function fetchKnowledge({ signal }) {
  const response = await fetch(process.env.NEXT_PUBLIC_BASE_PATH + '/graphs/knowledge.json', { signal })
  if (!response.ok) throw new Error('Could not load the full graph (HTTP ' + response.status + ').')
  return response.json()
}

export default function Studio({ sample }) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}><Workbench sample={sample} /></QueryClientProvider>
}

function Workbench({ sample }) {
  const [dataset, setDataset] = useState('sample')
  const [physics, setPhysics] = useState('auto')
  const [count, setCount] = useState(180)
  const [countInput, setCountInput] = useState(180)
  const [mode, setMode] = useState('drift')
  const [style, setStyle] = useState(() => preset('console'))
  const [kindChoice, chooseKind] = useState('study')
  const [wireChoice, chooseWire] = useState('concept')
  const [settings, setSettings] = useState({
    blend: consoleLayout.blend, laneGap: 175, rowGap: 64, linkDistance: 46,
    springStrength: 1, repulsion: 1, direction: 'horizontal', guides: false, pinOnDrag: false,
  })

  const stress = dataset === 'stress'
  const full = useQuery({
    queryKey: ['knowledge-console', 'full'], queryFn: fetchKnowledge, enabled: dataset === 'full',
    staleTime: Infinity, gcTime: Infinity, retry: 1,
  })
  const generated = useMemo(() => stress ? fixture(count, physics === 'seeded' ? 'seeded' : physics === 'fixed') : null, [stress, count, physics])
  const data = stress ? generated : dataset === 'full' && full.data ? full.data : sample
  const theme = useMemo(() => makeTheme(style), [style])
  const layout = useMemo(() => ({ ...settings, springsByKind: stress ? undefined : consoleLayout.springsByKind }), [settings, stress])
  const engine = physics === 'worker' || physics === 'main' ? physics : undefined
  const view = useGraph(data, engine, layout, theme, mode)
  const kinds = useMemo(() => {
    const present = new Set(data.nodes.map((node) => node.kind))
    return kindOrder.filter((kind) => present.has(kind))
  }, [data])
  const wireKinds = useMemo(() => [...new Set(data.links.map((link) => link.kind ?? ''))].sort(), [data])
  const kind = kinds.includes(kindChoice) ? kindChoice : kinds[0]
  const wire = wireKinds.includes(wireChoice) ? wireChoice : wireKinds[0]
  const nodeStyle = marker(theme, kind)
  const wireStyle = theme.wires.byKind[wire] ?? {}
  const selected = useMemo(() => data.nodes.find((node) => node.id === view.selected), [data, view.selected])
  const degree = useMemo(() => selected ? data.links.filter((link) => link.source === selected.id || link.target === selected.id).length : 0, [data, selected])
  const stats = view.stats
  const adjust = (key, value) => setSettings((old) => ({ ...old, [key]: value }))
  const paint = (key, value) => setStyle((old) => ({ ...old, [key]: value }))
  function paintKind(patch) {
    setStyle((old) => ({ ...old, nodes: { ...old.nodes, [kind]: { ...nodeStyle, ...patch } } }))
  }
  function paintWire(patch) {
    setStyle((old) => ({ ...old, wires: { ...old.wires, [wire]: { ...old.wires[wire], ...patch } } }))
  }
  function switchDataset(next) {
    if (next !== 'stress' && ['fixed', 'seeded'].includes(physics)) setPhysics('auto')
    setDataset(next)
  }

  return <>
    <header className="shrink-0">
      <div className="identity"><span className="wordmark"><i aria-hidden="true" />Loom</span>
        <span className="slash" aria-hidden="true">/</span><h1>Graph studio</h1></div>
      <label className="dataset">Graph<select id="dataset" value={dataset} onChange={(e) => switchDataset(e.target.value)}>
        {datasets.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
    </header>
    <main className="min-w-0 min-[701px]:grid-cols-[minmax(0,1fr)_300px]">
      <section className="stage isolate" aria-label="Graph viewport" onPointerUp={view.syncPin} onPointerCancel={view.syncPin}>
        <canvas id="graph" ref={view.canvas} aria-label="Knowledge graph. Drag a node to move it. Arrow keys pan, plus and minus zoom." />
        <div id="legend" className="legend" aria-label="Node kinds" style={{ '--map-ink': theme.ink, '--map-bg': theme.bg }}>
          {kinds.map((name) => {
            const item = marker(theme, name)
            return <span key={name}><i data-shape={item.shape} style={{ '--kind': item.color }} />{name}</span>
          })}
        </div>
        <div className="stage-tools">
          <button id="fit" onClick={() => view.graph.current?.fit()}>Fit view</button>
          <button id="reset" onClick={() => view.graph.current?.reset()}>Reset view</button>
          <button id="pause" onClick={view.togglePause}>{view.paused ? 'Resume' : 'Pause'}</button>
        </div>
        {dataset === 'full' && !full.data && <div role="status" className="absolute inset-x-4 top-14 mx-auto w-fit rounded-md bg-paper px-3 py-2 text-graphite shadow-md">
          {full.isError ? <>{full.error.message} <button onClick={() => full.refetch()}>Retry</button></> : 'Loading the full graph…'}
        </div>}
        <p id="error" role="alert" hidden={!view.error}>{view.error}</p>
      </section>
      <aside aria-label="Graph controls" className="min-w-0 min-[701px]:overscroll-contain">
        <section><h2>Layout</h2>
          <Range id="blend" label="Structure" min={0} max={100} value={Math.round(settings.blend * 100)} format={percent} onChange={(v) => adjust('blend', v / 100)} />
          <div className="range-ends"><span>Force directed</span><span>Node graph</span></div>
          <div className="modes" role="group" aria-label="Force mode">{modes.map((name) =>
            <button key={name} data-mode={name.toLowerCase()} aria-pressed={mode === name.toLowerCase()} onClick={() => setMode(name.toLowerCase())}>{name}</button>
          )}</div>
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
        <section><h2>Appearance</h2>
          <Select id="theme" label="Theme" options={palettes} value={style.name} onChange={(v) => setStyle(preset(v))} />
          <Select id="route" label="Wires" options={routes} value={style.route} onChange={(v) => paint('route', v)} />
          <Range id="node-size" label="Node scale" min={30} max={300} value={Math.round(style.nodeScale * 100)} outputId="size-value" format={(v) => (v / 100).toFixed(2) + '×'} onChange={(v) => paint('nodeScale', v / 100)} />
          <details><summary>Style controls</summary>
            <Select id="kind" label="Node kind" options={kinds.map((k) => [k, k])} value={kind} onChange={chooseKind} />
            <Color id="kind-color" label="Marker colour" value={nodeStyle.color} onChange={(color) => paintKind({ color })} />
            <Select id="shape" label="Marker shape" options={shapes} value={nodeStyle.shape} onChange={(shape) => paintKind({ shape })} />
            <Select id="wire-kind" label="Link kind" options={wireKinds.map((k) => [k, k || 'Untyped'])} value={wire} onChange={chooseWire} />
            <Color id="wire-color" label="Link colour" value={wireStyle.color ?? theme.wires.color ?? theme.dim} onChange={(color) => paintWire({ color })} />
            <Range id="wire-width" label="Link width" min={0} max={8} step={0.1} value={wireStyle.width ?? theme.wires.width ?? 1.3} outputId="width-value" format={(v) => v + ' px'} onChange={(width) => paintWire({ width })} />
            <Range id="wire-opacity" label="Wire opacity" min={0} max={100} value={Math.round(style.opacity * 100)} outputId="opacity-value" format={percent} onChange={(v) => paint('opacity', v / 100)} />
            <Select id="labels" label="Labels" options={labels} value={style.labels} onChange={(v) => paint('labels', v)} />
            <div className="checks"><Check id="artwork" label="Artwork" checked={style.artwork} onChange={(v) => paint('artwork', v)} />
              <Check id="guides" label="Lane guides" checked={settings.guides} onChange={(v) => adjust('guides', v)} />
              <Check id="grid" label="Grid" checked={style.grid} onChange={(v) => paint('grid', v)} /></div>
          </details>
        </section>
        <section className="selection"><h2>Selection</h2>
          <p id="selection" aria-live="polite">{selected?.label ?? 'Select a node to inspect its links.'}</p>
          <p id="selection-meta">{selected && (selected.kind + ' · ' + degree + (degree === 1 ? ' link' : ' links') + (view.pinned ? ' · pinned' : ''))}</p>
          <div className="selection-tools" hidden={!selected}><button id="focus" onClick={() => selected && view.graph.current?.focus(selected.id)}>Focus node</button>
            <button id="pin" onClick={view.togglePin}>{view.pinned ? 'Release node' : 'Pin node'}</button></div>
        </section>
        <details className="diagnostics"><summary>Simulation &amp; diagnostics</summary>
          <Select id="physics" label="Simulation" options={stress ? [...simulations, ...positioned] : simulations} value={physics} onChange={setPhysics} />
          {stress && <div className="mt-3"><label htmlFor="count">Nodes <output id="countLabel">{formatCount.format(countInput)}</output></label>
            <input id="count" type="range" min={100} max={25000} step={10} value={countInput}
              onChange={(e) => setCountInput(Number(e.target.value))}
              onPointerUp={(e) => setCount(Number(e.currentTarget.value))} onKeyUp={(e) => setCount(Number(e.currentTarget.value))}
              onBlur={(e) => setCount(Number(e.currentTarget.value))} /></div>}
          <dl><dt>First draw submission</dt><dd id="first">{stats ? stats.firstSubmitMs.toFixed(2) + ' ms' : '—'}</dd>
            <dt>Draw calls</dt><dd id="draws">{stats?.drawCalls ?? '—'}</dd>
            <dt>Layout ticks</dt><dd id="ticks">{stats?.simTicks ?? '—'}</dd>
            <dt>Transport</dt><dd id="transport">{stats?.transport ?? '—'}</dd></dl>
          <button id="refresh" onClick={view.refresh}>Refresh counters</button>
        </details>
      </aside>
    </main>
    <footer className="shrink-0 flex-wrap gap-x-3 gap-y-1 py-1">
      <span id="totals" className="whitespace-nowrap tabular-nums">{formatCount.format(data.nodes.length)} nodes · {formatCount.format(data.links.length)} links</span>
      <span>Drag a node to pull its neighbours. Drag the background to pan.</span>
    </footer>
  </>
}
