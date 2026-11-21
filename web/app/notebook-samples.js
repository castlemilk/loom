import { graph as saturn } from '../../docs/examples/saturn'
import { graph as cassini } from '../../docs/examples/cassini'
import sources from '../.generated/notebook-sources.json'

export const notebookSamples = {
  saturn: { title: 'Saturn system', graph: saturn, source: sources['saturn.ts'] },
  cassini: { title: 'Cassini flybys', graph: cassini, source: sources['cassini.ts'] },
}

const handoffPrefix = 'loom:orbital-draft:'
// A link carries only an opaque key. The graph stays in this browser, including across a new tab.
export function storeNotebookDraft(token, draft) {
  const cutoff = Date.now() - 24 * 3600_000
  for (const key of Object.keys(localStorage).filter(key => key.startsWith(handoffPrefix))) {
    let saved
    try { saved = JSON.parse(localStorage.getItem(key)) } catch {}
    if (!saved || saved.time < cutoff) localStorage.removeItem(key)
  }
  localStorage.setItem(handoffPrefix + token, JSON.stringify({ ...draft, time:Date.now() }))
}
export function readNotebookDraft(token) {
  const raw = localStorage.getItem(handoffPrefix + token)
  if (!raw) return null
  const draft = JSON.parse(raw)
  return draft.time >= Date.now() - 24 * 3600_000 ? draft : null
}
