// The same field definitions produce the published JSON Schema and validate commands.
export interface Field {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  const?: string | number
  description?: string
  minLength?: number
  minimum?: number
  maximum?: number
  minItems?: number
  minProperties?: number
  uniqueItems?: boolean
  not?: { enum: readonly string[] }
  anyOf?: { required: readonly string[] }[]
  required?: readonly string[]
  properties?: Record<string, Field | false>
  additionalProperties?: boolean | Field
  items?: Field
}

const string: Field = { type: 'string' }
const id: Field = { type: 'string', minLength: 1 }
const number: Field = { type: 'number' }
const uint: Field = { type: 'integer', minimum: 0, maximum: 0xffffffff }
const bool: Field = { type: 'boolean' }
const metrics: Field = { type: 'object', additionalProperties: number }
const nodeFields = { id, label: string, kind: string, x: number, y: number, z: number, pinned: bool, degree: uint,
  art: string, section: string, summary: string, content: string, contentSize: uint, complexity: number, metrics }
const linkFields = { id, source: id, target: id, kind: string, weight: number, metrics }

export const nodeRecord: Field = { type: 'object', required: ['id'], properties: nodeFields }
export const linkRecord: Field = { type: 'object', required: ['id', 'source', 'target'], properties: linkFields }
function command(op: string, description: string, properties: NonNullable<Field['properties']>, required: string[]): Field {
  return { type: 'object', description, required: ['op', ...required], properties: { op: { const: op }, ...properties }, additionalProperties: false }
}
function update(op: string, fields: Record<string, Field>, fixed: string[]): Field {
  const cmd = command(op, 'Set or unset fields. Identity stays stable and link endpoints must exist.', {
    id, changes: { type: 'object', minProperties: 1, properties: { ...fields, id: false } },
    unset: { type: 'array', minItems: 1, uniqueItems: true, items: { ...id, not: { enum: fixed } } },
  }, ['id'])
  return { ...cmd, anyOf: [{ required: ['changes'] }, { required: ['unset'] }] }
}
export const commandFields = {
  'node.add': command('node.add', 'Add a node with a new stable ID.', { value: nodeRecord }, ['value']),
  'node.update': update('node.update', nodeFields, ['id']),
  'node.remove': command('node.remove', 'Remove a node. Set cascade to remove incident links in the same transaction.',
    { id, cascade: bool }, ['id']),
  'link.add': command('link.add', 'Connect two existing nodes. Parallel links may have distinct IDs.', { value: linkRecord }, ['value']),
  'link.update': update('link.update', linkFields, ['id', 'source', 'target']),
  'link.remove': command('link.remove', 'Remove one link by its stable ID.', { id }, ['id']),
}
export const transactionFields: Field = { type: 'object', required: ['version', 'operations'], additionalProperties: false,
  properties: { version: { const: 1 }, documentId: id, expectedRevision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    operations: { type: 'array', minItems: 1 } } }
export const editorSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Loom editor transaction v1',
  description: 'Operations are evaluated in order and applied atomically. Read the current revision before submitting a guarded edit.',
  ...transactionFields,
  properties: { ...transactionFields.properties, operations: { type: 'array', minItems: 1, items: { oneOf: Object.values(commandFields) } } },
} as const

function freezeSchema(value: object) {
  if (Object.isFrozen(value)) return
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeSchema(child)
  Object.freeze(value)
}
freezeSchema(editorSchema)
