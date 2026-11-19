'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createGraph } from '../../dist/index.js'
import { attachAnnotations } from '../../dist/taxonomy.js'

export function useGraph(data, engine, layout, theme, mode, taxonomy, annotationOptions) {
  const canvas = useRef(null)
  const layer = useRef(null)
  const annotations = useRef(null)
  const graph = useRef(null)
  const applied = useRef(null)
  const [selected, select] = useState(null)
  const [pinned, setPinned] = useState(false)
  const [paused, setPaused] = useState(false)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const base = process.env.NEXT_PUBLIC_BASE_PATH

  const create = useEffectEvent((element, dataset, sim) => {
    const instance = createGraph(element, {
      ...dataset, layout, theme, mode, sim, workerURL: base + '/layout-worker.js',
      art: { urlFor: (node) => dataset.artwork?.[node.art] ? base + '/' + dataset.artwork[node.art] : undefined },
    })
    try {
      annotations.current = attachAnnotations(instance, layer.current, taxonomy, annotationOptions)
    } catch (error) {
      instance.destroy()
      throw error
    }
    applied.current = { layout, theme, mode, taxonomy, annotationOptions }
    return instance
  })

  useEffect(() => {
    const element = canvas.current
    select(null)
    setPinned(false)
    setPaused(false)
    setStats(null)
    setError('')
    let instance
    try {
      instance = create(element, data, engine)
    } catch (cause) {
      setError(cause.message)
      return
    }
    graph.current = instance
    element.dataset.ready = 'true'
    instance.on('hover', (id) => element.toggleAttribute('data-node', id !== null))
    instance.on('open', (id) => instance.focus(id))
    instance.on('select', (id) => {
      select(id)
      setPinned(id !== null && instance.getPosition(id).pinned)
      setStats(instance.stats())
    })
    setStats(instance.stats())
    const frame = requestAnimationFrame(() => setStats(instance.stats()))
    return () => {
      cancelAnimationFrame(frame)
      instance.destroy()
      annotations.current = null
      graph.current = null
      applied.current = null
      element.removeAttribute('data-ready')
      element.removeAttribute('data-node')
    }
  }, [data, engine])

  useEffect(() => {
    const current = graph.current, previous = applied.current
    if (!current || !previous) return
    if (previous.layout !== layout) current.setLayout(layout)
    if (previous.theme !== theme) current.setTheme(theme)
    if (previous.mode !== mode) current.setMode(mode)
    if (previous.taxonomy !== taxonomy) annotations.current.setIndex(taxonomy)
    if (previous.annotationOptions !== annotationOptions) annotations.current.setOptions(annotationOptions)
    applied.current = { layout, theme, mode, taxonomy, annotationOptions }
  }, [layout, theme, mode, taxonomy, annotationOptions])

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
    setPaused(!paused)
    setStats(graph.current.stats())
  }
  function refresh() {
    if (graph.current) setStats(graph.current.stats())
  }
  return { graph, canvas, layer, selected, pinned, paused, error, stats, syncPin, togglePin, togglePause, refresh }
}
