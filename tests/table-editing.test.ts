// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import {
  addColAfterCommand,
  addRowAfterCommand,
  deleteSelectedCellsCommand,
  gfm,
  selectColCommand,
  selectRowCommand
} from '@milkdown/kit/preset/gfm'
import { callCommand } from '@milkdown/kit/utils'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

const tableMarkdown = '| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |'

async function makeEditor(markdown: string) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
    })
    .use(commonmark)
    .use(gfm)
    .create()
  return { editor, view: editor.action((ctx) => ctx.get(editorViewCtx)) }
}

function selectCell(view: EditorView, rowIndex: number, colIndex: number): void {
  let target = -1
  let currentRow = -1
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table_header_row' || node.type.name === 'table_row') {
      currentRow += 1
      if (currentRow === rowIndex) {
        let currentCol = -1
        node.descendants((child, childPos) => {
          if (child.type.name === 'table_header' || child.type.name === 'table_cell') {
            currentCol += 1
            if (currentCol === colIndex && target < 0) target = pos + 1 + childPos + 1
          }
          return true
        })
      }
    }
    return true
  })
  if (target < 0) throw new Error('Cellule introuvable')
  view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(target))))
}

function tableInfo(view: EditorView) {
  const table = view.state.doc.firstChild
  return {
    rows: table?.childCount ?? 0,
    cols: table?.firstChild?.childCount ?? 0,
    firstRow: table?.firstChild?.type.name ?? ''
  }
}

describe('édition réelle des tableaux Milkdown', () => {
  it('supprime une ligne de contenu en conservant l’en-tête', async () => {
    const { editor, view } = await makeEditor(tableMarkdown)

    selectCell(view, 1, 0)
    editor.action(callCommand(selectRowCommand.key, { index: 1 }))
    editor.action(callCommand(deleteSelectedCellsCommand.key))

    expect(tableInfo(view)).toMatchObject({ rows: 2, firstRow: 'table_header_row' })
    view.state.doc.check()

    editor.action(callCommand(addRowAfterCommand.key))
    editor.action(callCommand(addColAfterCommand.key))

    expect(tableInfo(view)).toMatchObject({
      rows: 3,
      cols: 4,
      firstRow: 'table_header_row'
    })
    view.state.doc.check()
  })

  it('enchaîne suppression de ligne, suppression de colonne et ajouts', async () => {
    const { editor, view } = await makeEditor(tableMarkdown)

    selectCell(view, 1, 0)
    editor.action(callCommand(selectRowCommand.key, { index: 1 }))
    editor.action(callCommand(deleteSelectedCellsCommand.key))
    view.state.doc.check()

    selectCell(view, 1, 1)
    editor.action(callCommand(selectColCommand.key, { index: 1 }))
    editor.action(callCommand(deleteSelectedCellsCommand.key))
    view.state.doc.check()

    expect(tableInfo(view)).toMatchObject({
      rows: 2,
      cols: 2,
      firstRow: 'table_header_row'
    })

    editor.action(callCommand(addRowAfterCommand.key))
    editor.action(callCommand(addColAfterCommand.key))
    view.state.doc.check()

    expect(tableInfo(view)).toMatchObject({
      rows: 3,
      cols: 3,
      firstRow: 'table_header_row'
    })
  })
})
