import type { Node as PMNode } from '@milkdown/kit/prose/model'
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction
} from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

function tablePaddingTransaction(state: EditorState): Transaction | null {
  const { doc, schema } = state
  const paragraph = schema.nodes.paragraph
  if (!paragraph) return null

  const missingBefore = doc.firstChild?.type.name === 'table'
  const missingAfter = doc.lastChild?.type.name === 'table'
  if (!missingBefore && !missingAfter) return null

  const tr = state.tr
  if (missingAfter) tr.insert(doc.content.size, paragraph.create())
  if (missingBefore) tr.insert(0, paragraph.create())
  return tr
}

/**
 * Garantit qu'un paragraphe vide encadre un tableau placé en tout début ou en
 * toute fin de note. Sans lui, le tableau occupe la seule position du document
 * et il devient impossible d'y ajouter du texte avant ou après.
 */
export function ensureTablePadding(view: EditorView): boolean {
  const tr = tablePaddingTransaction(view.state)
  if (!tr) return false
  view.dispatch(tr.scrollIntoView())
  return true
}

export function createTablePaddingPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('decoupe-table-padding'),
    appendTransaction: (transactions, _oldState, newState) => {
      if (!transactions.some((transaction) => transaction.docChanged)) return null
      return tablePaddingTransaction(newState)
    }
  })
}

const LEADING_EMPTY_LINE = /^(?:[ \t]*<br\s*\/?>[ \t]*\r?\n\s*)+(?=\|)/i

/**
 * Retire le `<br />` que le sérialiseur Markdown ajoute pour conserver le
 * paragraphe vide placé avant un tableau. Le paragraphe est recréé à
 * l'ouverture de la note, le fichier reste donc du Markdown propre.
 */
export function stripTableBoundaryPadding(markdown: string): string {
  return markdown.replace(LEADING_EMPTY_LINE, '')
}

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
