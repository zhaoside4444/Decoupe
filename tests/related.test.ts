import { describe, expect, it } from 'vitest'
import type { NoteSummary } from '../src/shared/types'
import { findRelatedNotes, formatRelationReason } from '../src/shared/related'

function createNote(
  path: string,
  options: Partial<NoteSummary> = {}
): NoteSummary {
  const base = path.replace(/^.*\//, '').replace(/\.md$/i, '')
  return {
    path,
    title: options.title || base,
    base,
    space: options.space || '',
    createdAt: options.createdAt || '2026-10-01',
    updatedAt: options.updatedAt || 1000,
    excerpt: options.excerpt || '',
    tags: options.tags || [],
    links: options.links || [],
    pinned: options.pinned
  }
}

describe('suggestion des notes liées (findRelatedNotes)', () => {
  it('exclut la note courante des résultats', () => {
    const notes: NoteSummary[] = [
      createNote('Notes/Current.md', { tags: ['dev', 'react'] }),
      createNote('Notes/Other.md', { tags: ['dev'] })
    ]

    const related = findRelatedNotes({
      currentPath: 'Notes/Current.md',
      currentTags: ['dev', 'react'],
      currentLinks: [],
      notes
    })

    expect(related).toHaveLength(1)
    expect(related[0].path).toBe('Notes/Other.md')
  })

  it('suggère des notes partageant des tags et classe par score', () => {
    const notes: NoteSummary[] = [
      createNote('Notes/OneTag.md', { tags: ['dev'], updatedAt: 1000 }),
      createNote('Notes/TwoTags.md', { tags: ['dev', 'react'], updatedAt: 1000 }),
      createNote('Notes/NoMatch.md', { tags: ['cooking'], updatedAt: 1000 })
    ]

    const related = findRelatedNotes({
      currentPath: 'Notes/Current.md',
      currentTags: ['dev', 'react', 'typescript'],
      notes
    })

    expect(related).toHaveLength(2)
    expect(related[0].path).toBe('Notes/TwoTags.md')
    expect(related[0].sharedTags).toEqual(['dev', 'react'])
    expect(related[1].path).toBe('Notes/OneTag.md')
    expect(related[1].sharedTags).toEqual(['dev'])
  })

  it('suggère des notes partageant des cibles de liens wiki', () => {
    const notes: NoteSummary[] = [
      createNote('Notes/Architecture.md', { links: ['database', 'security'] }),
      createNote('Notes/Random.md', { links: ['recipe'] })
    ]

    const related = findRelatedNotes({
      currentPath: 'Notes/Current.md',
      currentTags: [],
      currentLinks: ['database', 'cache'],
      notes
    })

    expect(related).toHaveLength(1)
    expect(related[0].path).toBe('Notes/Architecture.md')
    expect(related[0].sharedLinks).toEqual(['database'])
  })

  it('détecte les liens directs (sortants ou entrants)', () => {
    const notes: NoteSummary[] = [
      createNote('Notes/Target.md', { base: 'Target', links: [] }),
      createNote('Notes/Backlinker.md', { links: ['current'] })
    ]

    const related = findRelatedNotes({
      currentPath: 'Notes/Current.md',
      currentBase: 'Current',
      currentTags: [],
      currentLinks: ['target'],
      notes
    })

    expect(related).toHaveLength(2)
    const paths = related.map((r) => r.path)
    expect(paths).toContain('Notes/Target.md')
    expect(paths).toContain('Notes/Backlinker.md')
    expect(related.every((r) => r.isDirectLink)).toBe(true)
  })

  it('combine les scores (tags + liens + liens directs + même espace)', () => {
    const notes: NoteSummary[] = [
      createNote('Projet/FullMatch.md', {
        space: 'Projet',
        tags: ['web'],
        links: ['lib', 'current']
      }),
      createNote('Perso/PartialMatch.md', {
        space: 'Perso',
        tags: ['web']
      })
    ]

    const related = findRelatedNotes({
      currentPath: 'Projet/Current.md',
      currentBase: 'Current',
      currentTags: ['web'],
      currentLinks: ['lib'],
      notes
    })

    expect(related).toHaveLength(2)
    expect(related[0].path).toBe('Projet/FullMatch.md')
    expect(related[0].score).toBeGreaterThan(related[1].score)
  })

  it('respecte la limite maxResults', () => {
    const notes = Array.from({ length: 10 }, (_, i) =>
      createNote(`Notes/Note${i}.md`, { tags: ['common'], updatedAt: i })
    )

    const related = findRelatedNotes({
      currentPath: 'Notes/Current.md',
      currentTags: ['common'],
      notes,
      maxResults: 3
    })

    expect(related).toHaveLength(3)
  })

  it('retourne un tableau vide s’il n’y a aucun lien ni tag en commun', () => {
    const notes = [
      createNote('Notes/A.md', { tags: ['a'], links: ['x'] }),
      createNote('Notes/B.md', { tags: ['b'], links: ['y'] })
    ]

    const related = findRelatedNotes({
      currentPath: 'Notes/Current.md',
      currentTags: ['c'],
      currentLinks: ['z'],
      notes
    })

    expect(related).toEqual([])
  })
})

describe('formatage des raisons de lien (formatRelationReason)', () => {
  it('formate correctement les différents motifs de lien', () => {
    expect(
      formatRelationReason({
        path: 'a.md',
        title: 'A',
        base: 'A',
        space: '',
        updatedAt: 0,
        excerpt: '',
        score: 10,
        sharedTags: ['dev', 'react'],
        sharedLinks: ['api'],
        isDirectLink: false
      })
    ).toBe('2 tags et 1 lien en commun')

    expect(
      formatRelationReason({
        path: 'a.md',
        title: 'A',
        base: 'A',
        space: '',
        updatedAt: 0,
        excerpt: '',
        score: 4,
        sharedTags: ['design'],
        sharedLinks: [],
        isDirectLink: false
      })
    ).toBe('1 tag en commun (#design)')

    expect(
      formatRelationReason({
        path: 'a.md',
        title: 'A',
        base: 'A',
        space: '',
        updatedAt: 0,
        excerpt: '',
        score: 4,
        sharedTags: [],
        sharedLinks: ['doc'],
        isDirectLink: false
      })
    ).toBe('1 lien en commun ([[doc]])')

    expect(
      formatRelationReason({
        path: 'a.md',
        title: 'A',
        base: 'A',
        space: '',
        updatedAt: 0,
        excerpt: '',
        score: 4,
        sharedTags: [],
        sharedLinks: [],
        isDirectLink: true
      })
    ).toBe('Lien direct')
  })
})
