'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createWireGraph } from '../../dist/wires.js'
import { attachAnnotations } from '../../dist/taxonomy.js'
import { imageURL } from './workload.mjs'

export function useGraph(data, engine, layout, theme, mode, taxonomy, annotationOptions, drill, source, scopeKey, retainedScene, wireEffects) {
  const canvas = useRef(null)
  const layer = useRef(null)
  const underlay = useRef(null)
  const annotations = useRef(null)
  const graph = useRef(null)
  const [instance, setInstance] = useState(null)
  const applied = useRef(null)
  const [selected, select] = useState(null)
  const [pinned, setPinned] = useState(false)
  const [paused, setPaused] = useState(false)
  const pausedOwner = useRef(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const base = process.env.NEXT_PUBLIC_BASE_PATH

  const create = useEffectEvent((element, dataset, sim) => {
    const saved = retainedScene.current
    const restore = saved?.source === source && saved.scopeKey === scopeKey
    const nodes = restore ? dataset.nodes.map((n) => saved.poses.has(n.id) ? { ...n, ...saved.poses.get(n.id) } : n) : dataset.nodes
    const instance = createWireGraph(element, {
      ...dataset, nodes, layout, theme, mode, sim, wireEffects, transparentBackground: true, workerURL: base + '/layout-worker.js',
      art: { urlFor: (node) => imageURL(dataset, node, base) },
    })
    try {
      if (restore) {
        instance.setViewport(saved.viewport)
        if (saved.paused) pausedOwner.current = drill
        retainedScene.current = null
      }
      annotations.current = attachAnnotations(instance, layer.current, taxonomy, { ...annotationOptions, underlay: underlay.current })
    } catch (error) {
      instance.destroy()
      throw error
    }
    applied.current = { layout, theme, mode, taxonomy, annotationOptions, wireEffects }
    return instance
  })

  useEffect(() => {
    const element = canvas.current
    select(null)
    setPinned(false)
    setStats(null)
    setError('')
    let instance
    try {
      instance = create(element, data, engine)
    } catch (cause) {
      setInstance(null)
      setError(cause.message)
      return
    }
    graph.current = instance
    const keepPaused = pausedOwner.current === drill
    setPaused(keepPaused)
    if (keepPaused) instance.pause()
    setInstance(instance)
    element.dataset.ready = 'true'
    instance.on('hover', (id) => element.toggleAttribute('data-node', id !== null))
    instance.on('select', (id) => {
      select(id)
      setPinned(id !== null && instance.getPosition(id).pinned)
      setStats(instance.stats())
    })
    const detach = drill.bind(instance, data)
    setStats(instance.stats())
    const frame = requestAnimationFrame(() => setStats(instance.stats()))
    return () => {
      cancelAnimationFrame(frame)
      detach()
      instance.destroy()
      annotations.current = null
      graph.current = null
      applied.current = null
      element.removeAttribute('data-ready')
      element.removeAttribute('data-node')
    }
  }, [data, engine, drill])

  useEffect(() => {
    const current = graph.current, previous = applied.current
    if (!current || !previous) return
    if (previous.layout !== layout) current.setLayout(layout)
    if (previous.theme !== theme) current.setTheme(theme)
    if (previous.mode !== mode) current.setMode(mode)
    if (previous.wireEffects !== wireEffects) current.setWireEffects(wireEffects)
    if (previous.taxonomy !== taxonomy) annotations.current.setIndex(taxonomy)
    if (previous.annotationOptions !== annotationOptions) annotations.current.setOptions(annotationOptions)
    applied.current = { layout, theme, mode, taxonomy, annotationOptions, wireEffects }
  }, [layout, theme, mode, taxonomy, annotationOptions, wireEffects])

  function syncPin() {
    if (selected && graph.current) setPinned(graph.current.getPosition(selected).pinned)
  }
  function togglePin() {
    if (!selected || !graph.current) return
    if (graph.current.getPosition(selected).pinned) graph.current.unpin(selected)
    else graph.current.pin(selected)
    syncPin()
  }
  function togglePause() {
    if (!graph.current) return
    if (paused) graph.current.resume()
    else graph.current.pause()
    pausedOwner.current = paused ? null : drill
    setPaused(!paused)
    setStats(graph.current.stats())
  }
  function refresh() {
    if (graph.current) setStats(graph.current.stats())
  }
  return { graph, instance, canvas, layer, underlay, selected, pinned, paused, error, stats, syncPin, togglePin, togglePause, refresh }
}
