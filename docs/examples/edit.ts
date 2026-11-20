import { createEditor, restoreEditor, type EditorTransaction } from 'loom-core/editor'

export function addFilter() {
  const doc = createEditor({ nodes: [{ id: 'mixer' }], links: [] })
  const { documentId, revision } = doc.describe()
  const edit = {
    version: 1, documentId, expectedRevision: revision,
    operations: [
      { op: 'node.add', value: { id: 'filter', label: 'Filter' } },
      { op: 'link.add', value: { id: 'signal', source: 'mixer', target: 'filter' } },
    ],
  } satisfies EditorTransaction

  const preview = doc.preview(edit)
  if (!preview.ok) throw new Error(preview.error.path + ' ' + preview.error.message)
  const receipt = doc.apply(edit)
  if (!receipt.ok) throw new Error(receipt.error.code)

  const reopened = restoreEditor(JSON.parse(JSON.stringify(doc.checkpoint())))
  return { receipt, link: reopened.getLink('signal'), revision: reopened.describe().revision }
}
