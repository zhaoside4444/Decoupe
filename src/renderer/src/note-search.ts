import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

export interface NoteSearchMatch {
  from: number
  to: number
}

export interface NoteSearchState {
  query: string
  matches: NoteSearchMatch[]
  active: number
}

export interface NoteSearchMeta {
  query: string | null
  active?: number
}

const EMPTY: NoteSearchState = { query: '', matches: [], active: -1 }

export const noteSearchKey = new PluginKey<NoteSearchState>('decoupe-note-search')

interface FoldedText {
  value: string
  /** Pour chaque caractère replié, son index dans le texte d'origine. */
  offsets: number[]
}

/**
 * Replie un texte pour comparer sans tenir compte de la casse ni des accents.
 * Les offsets conservent la correspondance avec le texte d'origine, nécessaire
 * pour positionner les surlignages ProseMirror.
 */
function fold(text: string): FoldedText {
  let value = ''
  const offsets: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    const folded = text[index]
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    for (let offset = 0; offset < folded.length; offset += 1) {
      value += folded[offset]
      offsets.push(index)
    }
  }
  return { value, offsets }
}

export function findTextMatches(text: string, query: string): NoteSearchMatch[] {
  const needle = fold(query).value.trim()
  if (!needle) return []

  const { value, offsets } = fold(text)
  const matches: NoteSearchMatch[] = []
  let index = value.indexOf(needle)
  while (index !== -1) {
    matches.push({
      from: offsets[index],
      to: offsets[index + needle.length - 1] + 1
    })
    index = value.indexOf(needle, index + needle.length)
  }
  return matches
}

export function findDocumentMatches(doc: PMNode, query: string): NoteSearchMatch[] {
  if (!query.trim()) return []
  const matches: NoteSearchMatch[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const match of findTextMatches(node.text, query)) {
      matches.push({ from: pos + match.from, to: pos + match.to })
    }
  })
  return matches
}

function clampActive(active: number, total: number): number {
  if (total === 0) return -1
  return Math.min(Math.max(active, 0), total - 1)
}

export function createNoteSearchPlugin(): Plugin<NoteSearchState> {
  return new Plugin<NoteSearchState>({
    key: noteSearchKey,
    state: {
      init: () => EMPTY,
      apply(tr, previous, _oldState, newState) {
        const meta = tr.getMeta(noteSearchKey) as NoteSearchMeta | undefined
        if (meta) {
          if (!meta.query || !meta.query.trim()) return EMPTY
          const matches = findDocumentMatches(newState.doc, meta.query)
          return {
            query: meta.query,
            matches,
            active: clampActive(meta.active ?? 0, matches.length)
          }
        }
        if (!tr.docChanged || !previous.query) return previous
        const matches = findDocumentMatches(newState.doc, previous.query)
        return {
          query: previous.query,
          matches,
          active: clampActive(previous.active, matches.length)
        }
      }
    },
    props: {
      decorations(state) {
        const search = noteSearchKey.getState(state)
        if (!search || !search.query || !search.matches.length) return null
        return DecorationSet.create(
          state.doc,
          search.matches.map((match, index) =>
            Decoration.inline(match.from, match.to, {
              class: index === search.active ? 'note-search-match is-active' : 'note-search-match'
            })
          )
        )
      }
    }
  })
}
