// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
  serializerCtx
} from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm, insertTableCommand } from '@milkdown/kit/preset/gfm'
import { $prose, callCommand } from '@milkdown/kit/utils'
import type { EditorView } from '@milkdown/kit/prose/view'
import {
  createTablePaddingPlugin,
  ensureTablePadding,
  stripTableBoundaryPadding
} from '../src/renderer/src/table-edit'

const tableMarkdown = '| A | B |\n| - | - |\n| 1 | 2 |'
const paddingPlugin = $prose(() => createTablePaddingPlugin())

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
    .use(paddingPlugin)
    .create()
  return { editor, view: editor.action((ctx) => ctx.get(editorViewCtx)) }
}

function childTypes(view: EditorView): string[] {
  const types: string[] = []
  view.state.doc.forEach((node) => types.push(node.type.name))
  return types
}

function serialize(editor: Editor, view: EditorView): string {
  return editor.action((ctx) => ctx.get(serializerCtx)(view.state.doc))
}

describe('paragraphes autour des tableaux', () => {
  it('encadre un tableau seul par deux paragraphes', async () => {
    const { editor, view } = await makeEditor(tableMarkdown)
    expect(childTypes(view)).toEqual(['table'])

    expect(ensureTablePadding(view)).toBe(true)
    expect(childTypes(view)).toEqual(['paragraph', 'table', 'paragraph'])
    view.state.doc.check()

    expect(ensureTablePadding(view)).toBe(false)
    expect(childTypes(view)).toEqual(['paragraph', 'table', 'paragraph'])

    const markdown = stripTableBoundaryPadding(serialize(editor, view))
    expect(markdown).toBe(`${tableMarkdown}\n`)
  })

  it('ajoute un paragraphe final à un tableau en fin de note', async () => {
    const { view } = await makeEditor(`Intro\n\n${tableMarkdown}`)
    expect(childTypes(view)).toEqual(['paragraph', 'table'])

    expect(ensureTablePadding(view)).toBe(true)
    expect(childTypes(view)).toEqual(['paragraph', 'table', 'paragraph'])
    view.state.doc.check()
  })

  it('encadre automatiquement un tableau inséré dans une note vide', async () => {
    const { editor, view } = await makeEditor('')
    expect(childTypes(view)).toEqual(['paragraph'])

    editor.action(callCommand(insertTableCommand.key, { row: 2, col: 2 }))
    expect(childTypes(view)).toEqual(['paragraph', 'table', 'paragraph'])
    view.state.doc.check()

    const markdown = stripTableBoundaryPadding(serialize(editor, view))
    expect(markdown.startsWith('|')).toBe(true)
  })

  it('permet de saisir du texte avant et après le tableau', async () => {
    const { editor, view } = await makeEditor(tableMarkdown)
    ensureTablePadding(view)

    view.dispatch(view.state.tr.insertText('Avant', 1))
    const end = view.state.doc.content.size - 1
    view.dispatch(view.state.tr.insertText('Après', end))

    expect(serialize(editor, view)).toContain('Avant')
    expect(serialize(editor, view)).toContain('Après')
    const markdown = stripTableBoundaryPadding(serialize(editor, view))
    expect(markdown).toBe(`Avant\n\n${tableMarkdown}\n\nAprès\n`)
    view.state.doc.check()
  })
})

describe('stripTableBoundaryPadding', () => {
  it('retire le <br /> qui protège le paragraphe vide avant un tableau', () => {
    expect(stripTableBoundaryPadding(`<br />\n\n${tableMarkdown}\n`)).toBe(`${tableMarkdown}\n`)
  })

  it('conserve un <br /> qui ne précède pas un tableau', () => {
    expect(stripTableBoundaryPadding('<br />\n\nUn paragraphe\n')).toBe('<br />\n\nUn paragraphe\n')
  })

  it('laisse un document sans tableau inchangé', () => {
    expect(stripTableBoundaryPadding('Texte\n')).toBe('Texte\n')
  })
})
