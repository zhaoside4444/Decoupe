import { describe, expect, it } from 'vitest'
import type { NoteSummary } from '../src/shared/types'
import { SORT_MODES, sortNotes, type NoteSortMode } from '../src/shared/sort'
import {
  foldName,
  pinnedFromFrontmatter,
  setFrontmatterPinned,
  setPinned,
  stripFrontmatter,
  tagsFromFrontmatter
} from '../src/shared/text'

describe('épinglage via frontmatter', () => {
  it('lit les valeurs pinned (true, oui, explicit false)', () => {
    expect(pinnedFromFrontmatter('---\npinned: true\n---')).toBe(true)
    expect(pinnedFromFrontmatter('---\npinned: OUI\n---')).toBe(true)
    expect(pinnedFromFrontmatter('---\npinned: "true"\n---')).toBe(true)
    expect(pinnedFromFrontmatter('---\npinned: 1\n---')).toBe(true)
    expect(pinnedFromFrontmatter('---\npinned: false\n---')).toBe(false)
    expect(pinnedFromFrontmatter('---\npinned: nope\n---')).toBe(false)
    expect(pinnedFromFrontmatter('---\ntags: [a]\n---')).toBe(false)
  })

  it('ajoute pinned dans un frontmatter existant sans toucher aux tags', () => {
    const markdown =
      '---\ntags: [Musique, Chansons]\npinned: false\n---\n\n# Titre\n\nCorps.'
    const next = setPinned(markdown, true)
    expect(next).toBe(
      '---\ntags: [Musique, Chansons]\npinned: true\n---\n\n# Titre\n\nCorps.'
    )
  })

  it('crée un frontmatter pour une note sans entête', () => {
    expect(setPinned('Corps brut.', true)).toBe('---\npinned: true\n---\n\nCorps brut.')
  })

  it('retire pinned à la désépinglée et supprime un frontmatter devenu vide', () => {
    const markdown = '---\npinned: true\n---\n\n# Titre\n\nCorps.'
    const off = setPinned(markdown, false)
    expect(off).toBe('# Titre\n\nCorps.')

    const mixed = '---\ntags: [a]\npinned: true\n---\n\nCorps.'
    const offMixed = setPinned(mixed, false)
    expect(stripFrontmatter(offMixed).frontmatter)
      .toBe('---\ntags: [a]\n---')
    expect(tagsFromFrontmatter(offMixed)).toEqual(['a'])
    expect(pinnedFromFrontmatter(offMixed)).toBe(false)
  })

  it('setFrontmatterPinned ne duplique pas la ligne et reste idempotent', () => {
    const once = setFrontmatterPinned('', true)
    const twice = setFrontmatterPinned(once, true)
    expect(twice).toBe(once)
    expect(pinnedFromFrontmatter(twice)).toBe(true)
  })
})

function summary(
  path: string,
  title: string,
  createdAt: string,
  updatedAt: number,
  pinned = false
): NoteSummary {
  const space = path.includes('/') ? path.split('/')[1] : ''
  return {
    path,
    base: path.split('/').pop()!.replace(/\.md$/i, ''),
    title,
    space,
    createdAt,
    updatedAt,
    excerpt: '',
    tags: [],
    pinned
  }
}

describe('tri des notes', () => {
  const notes = [
    summary('Notes/a.md', 'Éclair', '2026-10-02', 100),
    summary('Notes/b.md', 'banane', '2026-10-03', 200),
    summary('Notes/c.md', 'Chocolat', '2026-10-01', 300, true),
    summary('Notes/d.md', 'Abricot', '2026-10-04', 50)
  ]

  it('place les épinglées en tête quel que soit le mode', () => {
    for (const mode of SORT_MODES as NoteSortMode[]) {
      const sorted = sortNotes(notes, mode)
      expect(sorted[0]?.path).toBe('Notes/c.md')
      expect(sorted[0]?.pinned).toBe(true)
    }
  })

  it('trie de façon immuable', () => {
    const copy = [...notes]
    sortNotes(notes, 'modified')
    expect(notes).toEqual(copy)
  })

  it('trie par modification décroissante', () => {
    expect(
      sortNotes(notes, 'modified').slice(1).map((note) => note.title)
    ).toEqual(['banane', 'Éclair', 'Abricot'])
  })

  it('trie par création décroissante', () => {
    expect(
      sortNotes(notes, 'created').slice(1).map((note) => note.title)
    ).toEqual(['Abricot', 'banane', 'Éclair'])
  })

  it('trie par titre, insensible à la casse et aux accents', () => {
    expect(foldName('Éclair')).toBe(foldName('eclair'))
    expect(
      sortNotes(notes, 'title').slice(1).map((note) => note.title)
    ).toEqual(['Abricot', 'banane', 'Éclair'])
    expect(sortNotes(notes, 'title').map((note) => note.title)[0]).toBe(
      'Chocolat'
    )
  })
})
