import workerAsset from '../.generated/notebook-compiler.json'
import { homeURL } from '../site'

export function makeNotebookCompiler() {
  let worker, sequence = 0
  function dispose() { worker?.terminate(); worker = undefined }
  function compile(source, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason)
      worker ??= new Worker(homeURL + 'playground/' + workerAsset.filename)
      const current = worker, id = ++sequence
      const timeout = setTimeout(() => failure('Type checking timed out. Try a shorter module.'), 30000)
      function cleanup() {
        clearTimeout(timeout)
        current.removeEventListener('message', result)
        current.removeEventListener('error', failed)
        signal.removeEventListener('abort', abort)
      }
      function abort() { cleanup(); reject(signal.reason) }
      function failure(message) { cleanup(); dispose(); reject(new Error(message)) }
      function failed() { failure('The TypeScript compiler could not load. Edit again to retry.') }
      function result({ data }) {
        if (data.id !== id) return
        cleanup()
        if (data.error) reject(new Error(data.error))
        else resolve(data.code)
      }
      current.addEventListener('message', result)
      current.addEventListener('error', failed)
      signal.addEventListener('abort', abort, { once: true })
      current.postMessage({ id, source })
    })
  }
  return { compile, dispose }
}

const record = v => v !== null && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v))
const text = v => typeof v === 'string' && v.trim().length > 0
export function notebookURL(path, base) {
  if (!text(path)) throw new Error('Give the image or source a URL.')
  const url = new URL(path, base)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS image or source URL.')
  return url.href
}

// TypeScript annotations cannot validate the actual result of a computation or a type assertion.
export function readNotebook(graph, base) {
  if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.links) || !record(graph.images))
    throw new Error('Export a graph with nodes, links and an images record.')
  if (graph.nodes.length > 64 || graph.links.length > 192 || Object.keys(graph.images).length > 128)
    throw new Error('This notebook fits 64 nodes, 192 links and 128 images.')
  let fields = 0
  function checkField(value, depth) {
    if (++fields > 10000 || depth > 12) throw new Error('Use smaller metadata records.')
    if (value === null || ['string', 'boolean'].includes(typeof value) || Number.isFinite(value)) return
    if (!Array.isArray(value) && !record(value)) throw new Error('Metadata must contain JSON values.')
    for (const child of Object.values(value)) checkField(child, depth + 1)
  }
  for (const [key, ref] of Object.entries(graph.images)) {
    if (!text(key) || !record(ref) || !text(ref.alt)) throw new Error('Give each image a key and alt text.')
    notebookURL(ref.src, base)
    if (ref.credit !== undefined && !text(ref.credit)) throw new Error('Use text for the image credit.')
    if (ref.sourceURL !== undefined) notebookURL(ref.sourceURL)
  }
  const ids = new Set()
  for (const node of graph.nodes) {
    if (!text(node?.id) || !text(node.label) || !text(node.kind)) throw new Error('Give each node an id, label and kind.')
    if (ids.has(node.id)) throw new Error('Duplicate node id “' + node.id + '”.')
    ids.add(node.id)
    if (node.art !== undefined && (!text(node.art) || !Object.hasOwn(graph.images, node.art))) throw new Error('Unknown image key “' + node.art + '”. Add it to images.')
    if ([node.x, node.y].some(n => n !== undefined && (!Number.isFinite(n) || Math.abs(n) > 1e6))) throw new Error('Check the coordinates of “' + node.id + '”.')
    if (node.metadata !== undefined) {
      if (!record(node.metadata)) throw new Error('Give metadata named fields.')
      checkField(node.metadata, 0)
    }
  }
  for (const link of graph.links) {
    if (!text(link?.kind)) throw new Error('Give each link a relationship kind.')
    for (const id of [link.source, link.target]) if (!ids.has(id)) throw new Error('Unknown link endpoint “' + id + '”.')
    if (link.note !== undefined && !text(link.note)) throw new Error('Use text for the link note.')
    if (link.sourceURL !== undefined) notebookURL(link.sourceURL)
  }
  return graph
}
