import { describe, expect, it } from 'vitest'
import { detectExternalChange } from '../src/shared/external'
import type { NoteSummary } from '../src/shared/types'

function note(path: string, title = 'Note'): NoteSummary {
  return {
    path,
    title,
    base: path.split('/').pop()?.replace(/\.md$/i, '') ?? path,
    space: '',
    createdAt: '2026-01-01',
    updatedAt: 1,
    excerpt: '',
    tags: []
  }
}

describe('modifications externes', () => {
  it('detecte une modification du contenu sur le disque', () => {
    expect(
      detectExternalChange(
        'Notes/alpha.md',
        [note('Notes/alpha.md')],
        '# Avant',
        '# Apres'
      )
    ).toEqual({ kind: 'modified', path: 'Notes/alpha.md' })
    expect(
      detectExternalChange(
        'Notes/alpha.md',
        [note('Notes/alpha.md')],
        '# Avant',
        '# Avant'
      )
    ).toBeNull()
  })

  it('ignore la detection sans contenu de reference', () => {
    expect(
      detectExternalChange('Notes/alpha.md', [note('Notes/alpha.md')], null, '# Apres')
    ).toBeNull()
  })

  it('reconnait un deplacement quand la note de meme base existe ailleurs', () => {
    expect(
      detectExternalChange(
        'Notes/alpha.md',
        [note('Notes/Projets/alpha.md')],
        '# Alpha',
        null
      )
    ).toEqual({
      kind: 'moved',
      path: 'Notes/alpha.md',
      movedTo: 'Notes/Projets/alpha.md'
    })
  })

  it('signale une suppression si aucune note de meme base ne reste', () => {
    expect(
      detectExternalChange('Notes/alpha.md', [note('Notes/beta.md')], '# Alpha', null)
    ).toEqual({ kind: 'deleted', path: 'Notes/alpha.md' })
  })

  it('ne devine pas un deplacement ambigu', () => {
    expect(
      detectExternalChange(
        'Notes/alpha.md',
        [note('Notes/A/alpha.md'), note('Notes/B/alpha.md')],
        '# Alpha',
        null
      )
    ).toEqual({ kind: 'deleted', path: 'Notes/alpha.md' })
  })
})
