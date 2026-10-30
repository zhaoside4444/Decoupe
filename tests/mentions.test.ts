import { describe, expect, it } from 'vitest'
import type { NoteSummary } from '../src/shared/types'
import { findPlainMentions, groupMentions, MIN_MENTION_LENGTH } from '../src/shared/mentions'

function note(
  path: string,
  title = '',
  tags: string[] = [],
  updatedAt = 0
): NoteSummary {
  const base = path.split('/').pop()!.replace(/\.md$/i, '')
  return {
    path,
    base,
    title: title || base,
    space: path.includes('/') ? path.split('/').slice(1, -1).join('/') : '',
    createdAt: '2026-10-01',
    updatedAt,
    excerpt: '',
    tags
  }
}

const notes = [
  note('Notes/Facture.md', 'Facture matériel', [], 40),
  note('Notes/Idées.md', 'Idées', [], 30),
  note('Notes/Cana.md', 'Cana', [], 20),
  note('Notes/Mmm.md', 'Mmm', [], 10),
  note('Notes/Beta.md', 'Beta', [], 5)
]

describe('détection des mentions non liées', () => {
  it('détecte les titres cités dans le corps, sans tenir compte de la casse', () => {
    const markdown = '# Titre\n\nRelire le facture matériel avant lundi.'
    const mentions = findPlainMentions(markdown, notes, 'Notes/Source.md')
    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toMatchObject({
      base: 'Facture',
      title: 'Facture matériel',
      alias: 'facture matériel',
      index: markdown.indexOf('facture matériel'),
      length: 'facture matériel'.length
    })
    expect(mentions[0]?.snippet).toContain('facture matériel')
  })

  it('accepte les titres de 4 caractères et refuse les mots trop courts', () => {
    expect(MIN_MENTION_LENGTH).toBe(4)
    const markdown = 'La liste cite Cana puis Mmm vite.'
    const mentions = findPlainMentions(markdown, notes, 'Notes/Source.md')
    expect(mentions.map((mention) => mention.title)).toEqual(['Cana'])
  })

  it('ne capture pas un mot intégré dans un plus long', () => {
    const markdown = 'Facturation materiel et materiau.'
    expect(findPlainMentions(markdown, notes, 'Notes/Source.md')).toEqual([])
  })

  it('ignore le code, les liens wiki existants, les liens markdown et les URLs', () => {
    const markdown = [
      '# Titre',
      '',
      '- code : `facture matériel`',
      '- wiki : [[Facture|facture matériel]]',
      '- md : [voir](https://x.y/facture)',
      '- url : https://x.y/facture',
      '',
      '```',
      'facture matériel',
      '```'
    ].join('\n')
    expect(findPlainMentions(markdown, notes, 'Notes/Source.md')).toEqual([])
  })

  it('ignore le frontmatter', () => {
    const markdown = '---\ntags: [a]\n---\n\n# Aide\n\nPensée liée aux Idées maintenant.'
    const source = findPlainMentions(markdown, notes, 'Notes/Aide.md')
    expect(source.map((mention) => mention.title)).toEqual(['Idées'])
  })

  it('ignore la note courante et les notes de même base', () => {
    expect(findPlainMentions('Relire les Idées.', notes, 'Notes/Idées.md')).toEqual([])
    expect(findPlainMentions('Relire Beta.', notes, 'Notes/Autre/Beta.md')).toEqual([])
  })

  it('regroupe les occurrences par note et compte les répétitions', () => {
    const markdown =
      'Le facture matériel revient. Autre paragraphe avec facture matériel encore.'
    const mentions = findPlainMentions(markdown, notes, 'Notes/Source.md')
    expect(mentions).toHaveLength(2)
    const groups = groupMentions(mentions)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      base: 'Facture',
      title: 'Facture matériel',
      count: 2
    })
    expect(groups[0]?.snippet).toContain('facture matériel')
  })
})
