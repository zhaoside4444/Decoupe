import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

/**
 * Supprime la ligne d'en-tête d'un tableau GFM tout en gardant un tableau valide :
 * la première ligne de contenu est promue au rang d'en-tête, puis supprimée de son
 * ancienne position. Le schéma Milkdown exige en effet un en-tête suivi d'au moins
 * une ligne de contenu.
 */
export function promoteTableHeader(view: EditorView): boolean {
  const { state } = view
  const { $from } = state.selection

  let tableDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth
      break
    }
  }
  if (tableDepth < 0) return false

  const table = $from.node(tableDepth)
  if (table.childCount <= 2) return false

  const headerRow = table.child(0)
  const promoted = table.child(1)
  const headerRowType = state.schema.nodes.table_header_row
  const headerCellType = state.schema.nodes.table_header
  if (!headerRowType || !headerCellType) return false

  const cells: PMNode[] = []
  for (let index = 0; index < promoted.childCount; index += 1) {
    const cell = promoted.child(index)
    cells.push(headerCellType.create(cell.attrs, cell.content, cell.marks))
  }
  const replacement = headerRowType.create(promoted.attrs, cells)

  const headerStart = $from.before(tableDepth) + 1
  const tr = state.tr
  tr.replaceWith(headerStart, headerStart + headerRow.nodeSize, replacement)
  const promotedStart = headerStart + replacement.nodeSize
  tr.delete(promotedStart, promotedStart + promoted.nodeSize)
  const cursor = Math.min(headerStart + 2, tr.doc.content.size)
  tr.setSelection(TextSelection.near(tr.doc.resolve(cursor), 1))
  view.dispatch(tr.scrollIntoView())
  return true
}
