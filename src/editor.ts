import type { GraphData, GraphLink, GraphNode } from './types.js'
import { commandFields, editorSchema, linkRecord, nodeRecord, transactionFields } from './editor-schema.js'
import type { Field } from './editor-schema.js'
export { editorSchema }

export type EditorNode = Readonly<GraphNode & Record<string, unknown>>
export type EditorLink = Readonly<GraphLink & { id: string } & Record<string, unknown>>
export interface EditorData extends GraphData<EditorNode, EditorLink> { readonly [field: string]: unknown }
type Patch<T> = { changes: Partial<T> & Record<string, unknown> & { id?: never }; unset?: readonly string[] } |
  { changes?: never; unset: readonly string[] }
export type EditorOperation =
  | { op: 'node.add'; value: EditorNode }
  | { op: 'link.add'; value: EditorLink }
  | ({ op: 'node.update'; id: string } & Patch<GraphNode>)
  | ({ op: 'link.update'; id: string } & Patch<GraphLink>)
  | { op: 'node.remove'; id: string; cascade?: boolean }
  | { op: 'link.remove'; id: string }
export interface EditorTransaction { version: 1; documentId?: string; expectedRevision?: number; operations: readonly EditorOperation[] }
export interface EditorChange { op: EditorOperation['op']; id: string }
export type EditorErrorCode = 'invalid_input' | 'wrong_document' | 'stale_revision' | 'duplicate_id' | 'not_found' | 'missing_endpoint' | 'connected_node' | 'empty_history'
export type EditorReceipt = { ok: true; revision: number; changes: readonly EditorChange[] } |
  { ok: false; revision: number; error: { code: EditorErrorCode; path: string; message: string } }
export interface EditorCheckpoint { readonly version: 1; readonly documentId: string; readonly revision: number; readonly data: EditorData }
export interface EditorSnapshot extends EditorCheckpoint { readonly canUndo: boolean; readonly canRedo: boolean }
export interface EditorQuery { entity: 'node' | 'link'; text?: string; kind?: string; incidentTo?: string; offset?: number; limit?: number }

class EditError extends Error {
  constructor(readonly code: EditorErrorCode, readonly path: string, message: string) { super(message) }
}
function reject(code: EditorErrorCode, path: string, message: string): never { throw new EditError(code, path, message) }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

// Own immutable JSON values so edits, receipts and undo frames cannot be modified through caller aliases.
function copy(value: unknown, path: string, seen = new Set<object>(), importing = false): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) return value
  if (typeof value !== 'object' || !value || seen.has(value) ||
    (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
    reject('invalid_input', path, 'Expected a finite, acyclic JSON value.')
  }
  seen.add(value)
  let result
  if (Array.isArray(value)) result = Array.from(value, (item, i) => copy(item, path + '/' + i, seen, importing))
  else result = Object.fromEntries(Object.entries(value).filter(([, item]) => !importing || item !== undefined)
    .map(([key, item]) => [key, copy(item, path + '/' + key, seen, importing)]))
  seen.delete(value)
  return Object.freeze(result)
}

function check(value: unknown, field: Field | false, path: string) {
  if (field === false) reject('invalid_input', path, 'This field cannot be changed.')
  if (field.const !== undefined && value !== field.const) reject('invalid_input', path, 'Expected ' + field.const + '.')
  if (!field.type) return
  const valid = field.type === 'object' ? object(value) : field.type === 'array' ? Array.isArray(value) :
    field.type === 'integer' ? Number.isSafeInteger(value) : field.type === 'number' ? Number.isFinite(value) : typeof value === field.type
  if (!valid) reject('invalid_input', path, 'Expected ' + field.type + '.')
  if (typeof value === 'string' && value.length < (field.minLength ?? 0)) reject('invalid_input', path, 'Expected a nonempty string.')
  if (typeof value === 'string' && field.not?.enum.includes(value)) reject('invalid_input', path, 'Required field cannot be removed.')
  if (typeof value === 'number' && (value < (field.minimum ?? -Infinity) || value > (field.maximum ?? Infinity))) reject('invalid_input', path, 'Value outside the supported range.')
  if (Array.isArray(value)) {
    if (value.length < (field.minItems ?? 0)) reject('invalid_input', path, 'Provide at least one item.')
    if (field.uniqueItems && new Set(value).size !== value.length) reject('invalid_input', path, 'Items must be unique.')
    if (field.items) value.forEach((item, i) => check(item, field.items!, path + '/' + i))
  }
  if (!object(value)) return
  for (const key of field.required ?? []) if (!Object.hasOwn(value, key)) reject('invalid_input', path + '/' + key, 'Missing required field.')
  if (field.anyOf && !field.anyOf.some((rule) => rule.required.every((key) => Object.hasOwn(value, key)))) reject('invalid_input', path, 'Provide changes or unset.')
  if (Object.keys(value).length < (field.minProperties ?? 0)) reject('invalid_input', path, 'Provide at least one field.')
  for (const [key, item] of Object.entries(value)) {
    const spec = field.properties && Object.hasOwn(field.properties, key) ? field.properties[key] : field.additionalProperties
    if (spec === false) reject('invalid_input', path + '/' + key, 'Unexpected or immutable field.')
    if (typeof spec === 'object') check(item, spec, path + '/' + key)
  }
}

interface Version { data: EditorData; nodes: Map<string, EditorNode>; links: Map<string, EditorLink> }
function finish(metadata: object, nodes: Version['nodes'], links: Version['links']): Version {
  return { data: Object.freeze({ ...metadata, nodes: Object.freeze([...nodes.values()]), links: Object.freeze([...links.values()]) }), nodes, links }
}
function requireEndpoints(link: EditorLink, nodes: Version['nodes'], path: string) {
  for (const key of ['source', 'target'] as const) if (!nodes.has(link[key])) reject('missing_endpoint', path + '/' + key, 'Unknown node ' + link[key] + '.')
}
function initialVersion(input: GraphData): Version {
  if (!object(input) || !Array.isArray(input.nodes) || !Array.isArray(input.links)) reject('invalid_input', '', 'Expected nodes and links arrays.')
  const { nodes: inputNodes, links: inputLinks, ...rest } = input
  const nodes: Version['nodes'] = new Map(), links: Version['links'] = new Map()
  for (const [i, row] of inputNodes.entries()) {
    const path = '/nodes/' + i
    const n = copy(row, path, new Set(), true) as EditorNode
    check(n, nodeRecord, path)
    if (nodes.has(n.id)) reject('duplicate_id', path + '/id', 'Duplicate node ' + n.id + '.')
    nodes.set(n.id, n)
  }
  const reserved = new Set(inputLinks.map((row) => row?.id))
  let serial = 0
  for (const [i, row] of inputLinks.entries()) {
    const path = '/links/' + i
    if (!object(row)) reject('invalid_input', path, 'Expected a link object.')
    let record = copy(row, path, new Set(), true) as EditorLink
    if (!Object.hasOwn(record, 'id')) {
      let id
      do { id = '@link:' + serial++ } while (reserved.has(id))
      record = Object.freeze({ ...record, id })
    }
    check(record, linkRecord, path)
    const edge = record
    if (links.has(edge.id)) reject('duplicate_id', path + '/id', 'Duplicate link ' + edge.id + '.')
    requireEndpoints(edge, nodes, path)
    links.set(edge.id, edge)
  }
  return finish(copy(rest, '', new Set(), true) as object, nodes, links)
}

function edit(current: Version, input: unknown, revision: number, documentId: string) {
  check(input, transactionFields, '')
  const tx = input as EditorTransaction
  if (tx.documentId !== undefined && tx.documentId !== documentId) reject('wrong_document', '/documentId', 'Transaction belongs to a different document.')
  if (tx.expectedRevision !== undefined && tx.expectedRevision !== revision) reject('stale_revision', '/expectedRevision', 'Read revision ' + revision + ' and preview again.')
  const nodes = new Map(current.nodes), links = new Map(current.links)
  const changes: EditorChange[] = []
  for (const [i, candidate] of tx.operations.entries()) {
    const path = '/operations/' + i
    if (!object(candidate) || typeof candidate.op !== 'string' || !Object.hasOwn(commandFields, candidate.op)) reject('invalid_input', path + '/op', 'Unknown editor operation.')
    check(candidate, commandFields[candidate.op], path)
    const op = copy(candidate, path) as EditorOperation
    const isNode = op.op.startsWith('node.')
    const id = 'value' in op ? op.value.id : op.id
    const prev = (isNode ? nodes : links).get(id)
    if ('value' in op && prev) reject('duplicate_id', path + '/value/id', 'ID already exists: ' + id)
    if (!('value' in op) && !prev) reject('not_found', path + '/id', 'Unknown ID: ' + id)
    switch (op.op) {
      case 'node.add': nodes.set(id, op.value); break
      case 'link.add': requireEndpoints(op.value, nodes, path + '/value'); links.set(id, op.value); break
      case 'node.update':
      case 'link.update': {
        const fields = op.changes ?? {}, unset = op.unset ?? []
        if (unset.some((key) => Object.hasOwn(fields, key))) reject('invalid_input', path + '/unset', 'A field cannot be both set and unset.')
        if (unset.every((key) => !Object.hasOwn(prev!, key)) && Object.entries(fields).every(([key, v]) =>
          Object.hasOwn(prev!, key) && JSON.stringify(prev![key]) === JSON.stringify(v))) continue
        const row = { ...prev!, ...fields }
        for (const key of unset) delete row[key]
        if (op.op === 'node.update') nodes.set(id, Object.freeze(row))
        else {
          const edge = Object.freeze(row) as EditorLink
          requireEndpoints(edge, nodes, path + '/changes')
          links.set(id, edge)
        }
        break
      }
      case 'link.remove': links.delete(id); break
      case 'node.remove':
        for (const edge of links.values()) if (edge.source === id || edge.target === id) {
          if (!op.cascade) reject('connected_node', path, 'Remove incident links first or set cascade to true.')
          links.delete(edge.id); changes.push({ op: 'link.remove', id: edge.id })
        }
        nodes.delete(id); break
    }
    changes.push({ op: op.op, id })
  }
  return { next: changes.length ? finish(current.data, nodes, links) : current, changes }
}

const reverse: Record<EditorOperation['op'], EditorOperation['op']> = {
  'node.add': 'node.remove', 'node.remove': 'node.add', 'node.update': 'node.update',
  'link.add': 'link.remove', 'link.remove': 'link.add', 'link.update': 'link.update',
}

/** A document session shared by UI controls and JSON clients. No DOM or renderer is required. */
export function createEditor<T extends GraphData>(data: T, { historyLimit = 32, documentId = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, '0')).join('') } = {}) {
  return session(data, documentId, 0, historyLimit)
}
/** Restore JSON readback and revision. Undo history belongs to the original session. */
export function restoreEditor(checkpoint: unknown, { historyLimit = 32 } = {}) {
  if (!object(checkpoint) || checkpoint.version !== 1 || typeof checkpoint.documentId !== 'string' ||
      !Number.isSafeInteger(checkpoint.revision) || Number(checkpoint.revision) < 0) reject('invalid_input', '', 'Invalid v1 editor checkpoint.')
  return session(checkpoint.data as GraphData, checkpoint.documentId, Number(checkpoint.revision), historyLimit)
}
function session(data: GraphData, documentId: string, revision: number, historyLimit: number) {
  if (typeof documentId !== 'string' || !documentId) throw new RangeError('documentId must be a nonempty string.')
  if (!Number.isSafeInteger(historyLimit) || historyLimit < 0) throw new RangeError('historyLimit must be a nonnegative integer.')
  let current = initialVersion(data)
  type Frame = { version: Version; changes: readonly EditorChange[] }
  const past: Frame[] = [], future: Frame[] = [], listeners = new Set<() => void>()
  const checkpoint = (): EditorCheckpoint => Object.freeze({ version: 1, documentId, revision, data: current.data })
  const snapshot = (): EditorSnapshot => Object.freeze({ ...checkpoint(), canUndo: !!past.length, canRedo: !!future.length })
  let state = snapshot()
  const failure = (error: EditError): EditorReceipt => ({ ok: false, revision, error: { code: error.code, path: error.path, message: error.message } })
  function publish(next: Version) {
    current = next
    revision++
    state = snapshot()
    for (const fn of [...listeners]) fn()
  }
  function submit(transaction: unknown, commit: boolean): EditorReceipt {
    let result: ReturnType<typeof edit>
    try { result = edit(current, transaction, revision, documentId) }
    catch (error) { if (error instanceof EditError) return failure(error); throw error }
    const changes = Object.freeze(result.changes.map((change) => Object.freeze(change)))
    const resultRevision = revision + Number(commit && changes.length > 0)
    if (commit && changes.length) {
      if (historyLimit) {
        past.push({ version: current, changes })
        if (past.length > historyLimit) past.shift()
      }
      future.length = 0
      publish(result.next)
    }
    return { ok: true, revision: resultRevision, changes }
  }
  function travel(back: boolean, expectedRevision?: number): EditorReceipt {
    if (expectedRevision !== undefined && expectedRevision !== revision) return failure(new EditError('stale_revision', '/expectedRevision', 'Read the current revision before changing history.'))
    const from = back ? past : future, to = back ? future : past
    const frame = from.pop()
    if (!frame) return failure(new EditError('empty_history', '', back ? 'Nothing to undo.' : 'Nothing to redo.'))
    to.push({ version: current, changes: frame.changes })
    const nextRevision = revision + 1
    publish(frame.version)
    return { ok: true, revision: nextRevision, changes: back ? [...frame.changes].reverse().map(({ op, id }) => ({ id, op: reverse[op] })) : frame.changes }
  }
  function query({ entity, text = '', kind, incidentTo, offset = 0, limit = 25 }: EditorQuery) {
    if (!['node', 'link'].includes(entity) || !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || (incidentTo !== undefined && entity !== 'link')) throw new RangeError('Invalid query. Use a page size from 1 to 100 and incidentTo only for links.')
    const term = text.toLowerCase()
    const items: { id: string; kind?: string; label?: string; source?: string; target?: string }[] = []
    let total = 0
    for (const item of entity === 'node' ? current.nodes.values() : current.links.values()) {
      const edge = item as EditorLink, node = item as EditorNode
      if ((kind !== undefined && item.kind !== kind) || (incidentTo !== undefined && edge.source !== incidentTo && edge.target !== incidentTo)) continue
      if (term && !(entity === 'node' ? [item.id, node.label, item.kind] : [item.id, edge.source, edge.target, item.kind]).some(v => v?.toLowerCase().includes(term))) continue
      if (total++ < offset || items.length >= limit) continue
      items.push(entity === 'node' ? { id: item.id, label: node.label, kind: item.kind } : { id: item.id, source: edge.source, target: edge.target, kind: item.kind })
    }
    return { revision, total, items, nextOffset: offset + items.length < total ? offset + items.length : null }
  }
  return {
    getSnapshot: () => state, checkpoint,
    describe: () => ({ version: 1 as const, documentId, revision, nodes: current.nodes.size, links: current.links.size, canUndo: state.canUndo,
      canRedo: state.canRedo, operations: Object.keys(commandFields) }),
    getNode: (id: string) => current.nodes.get(id), getLink: (id: string) => current.links.get(id), query,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    preview: (input: unknown) => submit(input, false), apply: (input: unknown) => submit(input, true),
    transact: (operations: readonly EditorOperation[], expectedRevision = revision) =>
      submit({ version: 1, documentId, expectedRevision, operations }, true),
    undo: (expectedRevision?: number) => travel(true, expectedRevision), redo: (expectedRevision?: number) => travel(false, expectedRevision),
  }
}
