import { createEditor, editorSchema, type EditorReceipt } from 'loom-core/editor'

// A tool host can advertise this schema for both preview and apply.
export const guardedTransactionSchema = {
  ...editorSchema,
  required: ['version', 'documentId', 'expectedRevision', 'operations'],
}

export function graphTools(editor: ReturnType<typeof createEditor>) {
  function guarded(run: (value: unknown) => EditorReceipt, input: unknown): EditorReceipt {
    for (const key of ['documentId', 'expectedRevision']) {
      if (typeof input !== 'object' || input === null || !Object.hasOwn(input, key)) {
        return {
          ok: false, revision: editor.describe().revision,
          error: { code: 'invalid_input', path: '/' + key, message: 'Supply ' + key + ' from describe().' },
        }
      }
    }
    return run(input)
  }

  return {
    describe: editor.describe,
    findNodes: (text: string, offset = 0) =>
      editor.query({ entity: 'node', text, offset, limit: 8 }),
    linksForNode: (id: string, offset = 0) =>
      editor.query({ entity: 'link', incidentTo: id, offset, limit: 8 }),
    readLink: (id: string) => editor.getLink(id) ?? null,
    preview: (input: unknown) => guarded(editor.preview, input),
    apply: (input: unknown) => guarded(editor.apply, input),
  }
}
