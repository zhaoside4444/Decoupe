// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { $prose } from '@milkdown/kit/utils'
import {
  createNoteSearchPlugin,
  findDocumentMatches,
  findTextMatches,
  noteSearchKey
} from '../src/renderer/src/note-search'

const searchPlugin = $prose(() => createNoteSearchPlugin())

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
    .use(searchPlugin)
    .create()
  return { editor, view: editor.action((ctx) => ctx.get(editorViewCtx)) }
}

describe('findTextMatches', () => {
  it('ignore la casse et les accents', () => {
    expect(findTextMatches('Élodie et éLODIE', 'elodie')).toEqual([
      { from: 0, to: 6 },
      { from: 10, to: 16 }
    ])
    expect(findTextMatches('café', 'CAFE')).toEqual([{ from: 0, to: 4 }])
  })

  it('conserve les espaces de la requête', () => {
    expect(findTextMatches('Le café noir', 'café noir')).toEqual([{ from: 3, to: 12 }])
  })

  it('ne chevauche pas les occurrences', () => {
    expect(findTextMatches('aaaa', 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 }
    ])
  })

  it('retourne un tableau vide sans correspondance ou sans requête', () => {
    expect(findTextMatches('Alice', 'bob')).toEqual([])
    expect(findTextMatches('Alice', '   ')).toEqual([])
  })
})

describe('findDocumentMatches', () => {
  it('parcourt le texte, les titres et les cellules de tableau', async () => {
    const { view } = await makeEditor(
      '# Chapitre\n\nAlice et Bob.\n\n| Alice | X |\n| - | - |\n| Bob | Alice |'
    )

    expect(findDocumentMatches(view.state.doc, 'alice')).toHaveLength(3)
    expect(findDocumentMatches(view.state.doc, 'bob')).toHaveLength(2)
    expect(findDocumentMatches(view.state.doc, '')).toEqual([])
  })
})

describe('plugin de recherche dans la note', () => {
  it('surligne les occurrences et suit l’occurrence courante', async () => {
    const { view } = await makeEditor('Alice écrit. Alice relit. Alice corrige.')

    view.dispatch(view.state.tr.setMeta(noteSearchKey, { query: 'alice' }))
    const state = noteSearchKey.getState(view.state)
    expect(state?.matches).toHaveLength(3)
    expect(state?.active).toBe(0)

    const decorations = view.dom.querySelectorAll('.note-search-match')
    expect(decorations).toHaveLength(3)
    expect(view.dom.querySelectorAll('.note-search-match.is-active')).toHaveLength(1)

    view.dispatch(view.state.tr.setMeta(noteSearchKey, { query: 'alice', active: 2 }))
    expect(noteSearchKey.getState(view.state)?.active).toBe(2)
    expect(
      view.dom.querySelectorAll('.note-search-match.is-active')[0]?.textContent
    ).toBe('Alice')
  })

  it('recalcule les occurrences après une modification du document', async () => {
    const { view } = await makeEditor('Alice écrit.')
    view.dispatch(view.state.tr.setMeta(noteSearchKey, { query: 'alice' }))
    expect(noteSearchKey.getState(view.state)?.matches).toHaveLength(1)

    view.dispatch(view.state.tr.insertText(' Alice', view.state.doc.content.size - 1))
    expect(noteSearchKey.getState(view.state)?.matches).toHaveLength(2)
    view.state.doc.check()
  })

  it('efface la recherche quand la requête est vide', async () => {
    const { view } = await makeEditor('Alice écrit.')
    view.dispatch(view.state.tr.setMeta(noteSearchKey, { query: 'alice' }))
    view.dispatch(view.state.tr.setMeta(noteSearchKey, { query: null }))

    expect(noteSearchKey.getState(view.state)?.matches).toEqual([])
    expect(view.dom.querySelectorAll('.note-search-match')).toHaveLength(0)
  })
})
