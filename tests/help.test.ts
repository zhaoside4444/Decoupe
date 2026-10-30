import { describe, expect, it } from 'vitest'
import { parseHelpInline, parseHelpMarkdown } from '../src/shared/help'

describe('parseHelpInline', () => {
  it('retourne un seul segment sans balisage', () => {
    expect(parseHelpInline('Texte simple')).toEqual([
      { text: 'Texte simple', code: false, strong: false }
    ])
  })

  it('reconnaît le code inline', () => {
    expect(parseHelpInline('Tapez `Ctrl + K`')).toEqual([
      { text: 'Tapez ', code: false, strong: false },
      { text: 'Ctrl + K', code: true, strong: false }
    ])
  })

  it('reconnaît le gras et alterne avec le texte', () => {
    expect(parseHelpInline('**Titre** puis texte')).toEqual([
      { text: 'Titre', code: false, strong: true },
      { text: ' puis texte', code: false, strong: false }
    ])
  })

  it('gère gras et code dans la même ligne', () => {
    expect(parseHelpInline('**A** et `B`')).toEqual([
      { text: 'A', code: false, strong: true },
      { text: ' et ', code: false, strong: false },
      { text: 'B', code: true, strong: false }
    ])
  })
})

describe('parseHelpMarkdown', () => {
  const sample = [
    '# Aide — Test',
    '',
    '## Section',
    '',
    'Un paragraphe',
    'sur deux lignes.',
    '',
    '- premier',
    '- second',
    '',
    '---',
    '',
    '### Sous-section',
    '',
    'Fin.'
  ].join('\n')

  it('extrait le titre de niveau 1', () => {
    expect(parseHelpMarkdown(sample).title).toBe('Aide — Test')
  })

  it('ignore le titre dans les blocs', () => {
    const blocks = parseHelpMarkdown(sample).blocks
    expect(blocks.some((block) => block.kind === 'heading' && block.text === 'Aide — Test')).toBe(
      false
    )
  })

  it('regroupe les puces dans une seule liste', () => {
    const blocks = parseHelpMarkdown(sample).blocks
    expect(blocks).toContainEqual({ kind: 'list', items: ['premier', 'second'] })
  })

  it('joint les lignes d’un paragraphe', () => {
    const blocks = parseHelpMarkdown(sample).blocks
    expect(blocks).toContainEqual({
      kind: 'paragraph',
      text: 'Un paragraphe sur deux lignes.'
    })
  })

  it('conserve les niveaux de titre et les séparateurs', () => {
    const blocks = parseHelpMarkdown(sample).blocks
    expect(blocks).toContainEqual({ kind: 'heading', level: 2, text: 'Section' })
    expect(blocks).toContainEqual({ kind: 'heading', level: 3, text: 'Sous-section' })
    expect(blocks).toContainEqual({ kind: 'rule' })
  })

  it('utilise un titre de repli quand le document n’en a pas', () => {
    expect(parseHelpMarkdown('Simple paragraphe.').title).toBe('Aide')
  })

  it('ignore les lignes vides multiples', () => {
    const blocks = parseHelpMarkdown('\n\n\nUn seul bloc.\n\n\n').blocks
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'Un seul bloc.' }])
  })
})
