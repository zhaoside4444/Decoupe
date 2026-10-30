import { describe, expect, it } from 'vitest'
import type { NoteSummary } from '../src/shared/types'
import { hasExactWikiNote, suggestWikiNotes } from '../src/shared/wiki-suggestions'

function note(
  path: string,
  title: string,
  space: string,
  updatedAt: number
): NoteSummary {
  return {
    path,
    title,
    base: path.replace(/^Notes\//, '').replace(/\.md$/, ''),
    space,
    createdAt: '2026-10-01',
    updatedAt,
    excerpt: '',
    tags: []
  }
}

const notes = [
  note('Notes/Projet-Alpha.md', 'Projet Alpha', 'Projets', 10),
  note('Notes/Idee.md', 'Idée de note', 'Projets', 30),
  note('Notes/Reunion.md', 'Réunion équipe', 'Travail', 20),
  note('Notes/Archive.md', 'Archive', '', 40)
]

describe('suggestions de wiki-liens', () => {
  it('propose les notes récentes quand la requête est vide', () => {
    expect(suggestWikiNotes(notes, '', 'Notes/Autre.md').map((entry) => entry.path)).toEqual([
      'Notes/Archive.md',
      'Notes/Idee.md',
      'Notes/Reunion.md',
      'Notes/Projet-Alpha.md'
    ])
  })

  it('recherche dans le titre, la base et l’espace', () => {
    expect(
      suggestWikiNotes(notes, 'projet', 'Notes/Autre.md').map((entry) => entry.path)
    ).toContain('Notes/Projet-Alpha.md')

    expect(
      suggestWikiNotes(notes, 'travail', 'Notes/Autre.md').map((entry) => entry.path)
    ).toEqual(['Notes/Reunion.md'])

    expect(
      suggestWikiNotes(notes, 'projets ide', 'Notes/Autre.md').map((entry) => entry.path)
    ).toEqual(['Notes/Idee.md'])
  })

  it('accepte les recherches avec une barre oblique', () => {
    expect(
      suggestWikiNotes(notes, 'projets/idee', 'Notes/Autre.md').map((entry) => entry.path)
    ).toEqual(['Notes/Idee.md'])
  })

  it('priorise les correspondances exactes puis les préfixes', () => {
    const result = suggestWikiNotes(notes, 'projet alpha', 'Notes/Autre.md')
    expect(result[0].path).toBe('Notes/Projet-Alpha.md')
  })

  it('exclut la note courante et respecte la limite', () => {
    const result = suggestWikiNotes(notes, '', 'Notes/Idee.md', 2)
    expect(result.map((entry) => entry.path)).toEqual(['Notes/Archive.md', 'Notes/Reunion.md'])
    expect(suggestWikiNotes(notes, 'alpha', 'Notes/Projet-Alpha.md')).toEqual([])
  })

  it('ignore les accents dans la recherche et les correspondances exactes', () => {
    const accented = [note('Notes/xyz.md', 'Déjà vu', 'Études', 5)]
    expect(suggestWikiNotes(accented, 'deja etudes', 'Notes/Autre.md')).toEqual(accented)
    expect(hasExactWikiNote(accented, 'deja vu', 'Notes/Autre.md')).toBe(true)
  })

  it('détecte une note existante par titre ou base', () => {
    expect(hasExactWikiNote(notes, 'Projet Alpha', 'Notes/Autre.md')).toBe(true)
    expect(hasExactWikiNote(notes, 'projet-alpha', 'Notes/Autre.md')).toBe(true)
    expect(hasExactWikiNote(notes, 'Projet', 'Notes/Autre.md')).toBe(false)
    expect(hasExactWikiNote(notes, 'Projet Alpha', 'Notes/Projet-Alpha.md')).toBe(false)
  })
})
