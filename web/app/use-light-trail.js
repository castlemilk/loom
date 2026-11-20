'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchGraphFile, homeURL } from '../site'

export const pageSize = 3
export const pageStart = index => Math.floor(index / pageSize) * pageSize

export function useLightTrail(initial, beforeMove) {
  const [visits, setVisits] = useState(() => [{ study: initial, incoming: 1, outgoing: 0, reading: 'outgoing' }])
  const [status, setStatus] = useState(null)
  const cache = useRef(new Map()), pending = useRef(null)
  const current = visits.at(-1)
  useEffect(() => () => pending.current?.abort(), [])

  function cancel() {
    pending.current?.abort()
    pending.current = null
    setStatus(null)
  }
  function replace(frame) {
    setVisits(prior => [...prior.slice(0, -1), frame])
  }
  async function withNeighborhood(id, name, apply) {
    cancel()
    const controller = new AbortController()
    pending.current = controller
    try {
      let study = cache.current.get(id)
      if (!study) {
        setStatus({ message: 'Opening ' + name + '…' })
        study = await fetchGraphFile(homeURL + 'graphs/light-path/v1/' + id + '.json', controller.signal)
        if (controller.signal.aborted) return
        if (study.id !== id) throw new Error('Unexpected neighborhood')
        cache.current.set(id, study)
      }
      apply(study)
      setStatus(null)
    } catch {
      if (!controller.signal.aborted) {
        cache.current.delete(id)
        setStatus({ message: 'Couldn’t load the links for ' + name + '.', retry: () => withNeighborhood(id, name, apply) })
      }
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }
  function inspect(side, index) {
    cancel()
    replace({ ...current, [side]: index, reading: side })
  }
  function turnPage(side) {
    const { study } = current
    const next = pageStart(current[side]) + pageSize
    const index = next < study.totals[side] ? next : 0
    function show(full) { replace({ ...current, study: full, [side]: index, reading: side }) }
    if (study[side].length === study.totals[side]) { cancel(); show(study) }
    else withNeighborhood(study.id, study.hub, show)
  }
  function explore(side, index, previous = current) {
    const branch = current.study[side][index]
    if (branch.edge === current.arrivalEdge) {
      returnTo(visits.length - 2, branch.edge)
      return
    }
    withNeighborhood(branch.id, branch.name, study => {
      // Carry the exact arrival edge across the change of viewpoint, including
      // reciprocal links and articles with neighbors in just one direction.
      const arrival = side === 'incoming' ? 'outgoing' : 'incoming'
      const arrivedAt = study[arrival].findIndex(item => item.edge === branch.edge)
      if (arrivedAt < 0) throw new Error('Missing arrival link')
      const onward = study[side].findIndex(item => item.id !== current.study.id)
      beforeMove(study.id, branch.edge)
      const frame = { study, arrivalEdge: branch.edge, [arrival]: arrivedAt, [side]: Math.max(0, onward), reading: arrival }
      setVisits(prior => [...prior.slice(0, -1), previous, frame])
    })
  }
  function returnTo(index, edge) {
    cancel()
    beforeMove(visits[index].study.id, edge)
    setVisits(prior => prior.slice(0, index + 1))
  }
  return { visits, current, status, inspect, explore, turnPage, returnTo }
}
