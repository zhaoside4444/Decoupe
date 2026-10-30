import { describe, expect, it } from 'vitest'
import type { NoteSummary } from '../src/shared/types'
import {
  buildTimelineData,
  chapterFromFrontmatter,
  strongestRelation
} from '../src/shared/timeline'

function note(path: string, title: string, tags: string[] = [], space = ''): NoteSummary {
  return {
    path,
    base: path.split('/').pop()!.replace(/\.md$/i, ''),
    title,
    space,
    createdAt: '2026-10-01',
    updatedAt: 1000,
    excerpt: '',
    tags
  }
}

describe('chapterFromFrontmatter', () => {
  it('extrait le numéro de chapitre', () => {
    expect(chapterFromFrontmatter('---\nchapter: 3\n---')).toBe(3)
    expect(chapterFromFrontmatter('---\nchapitre: 12\n---')).toBe(12)
    expect(chapterFromFrontmatter('---\nchapter: "5"\n---')).toBe(5)
  })

  it('renvoie null si absent', () => {
    expect(chapterFromFrontmatter('---\ntags: [a]\n---')).toBeNull()
    expect(chapterFromFrontmatter('')).toBeNull()
  })
})

describe('buildTimelineData', () => {
  it('identifie les personnages et chapitres par tags', () => {
    const notes = [
      note('Notes/Perso/Alice.md', 'Alice', ['personnage']),
      note('Notes/Perso/Bob.md', 'Bob', ['personnage']),
      note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre']),
      note('Notes/Chap/Ch2.md', 'Chapitre 2', ['chapitre'])
    ]
    const contents = new Map<string, string>([
      ['Notes/Perso/Alice.md', '# Alice'],
      ['Notes/Perso/Bob.md', '# Bob'],
      ['Notes/Chap/Ch1.md', '# Chapitre 1\n\n[[Alice]] apparaît ici.'],
      ['Notes/Chap/Ch2.md', '# Chapitre 2\n\n[[Bob]] et [[Alice]] sont présents.']
    ])

    const data = buildTimelineData(notes, contents)
    expect(data.characters).toHaveLength(2)
    expect(data.chapters).toHaveLength(2)

    const aliceAppearances = data.appearances.get('alice')
    expect(aliceAppearances?.has(0)).toBe(true)
    expect(aliceAppearances?.has(1)).toBe(true)

    const bobAppearances = data.appearances.get('bob')
    expect(bobAppearances?.has(0)).toBe(false)
    expect(bobAppearances?.has(1)).toBe(true)
  })

  it('trie les chapitres par numéro de frontmatter', () => {
    const notes = [
      note('Notes/Perso/Alice.md', 'Alice', ['personnage']),
      note('Notes/Chap/Ch2.md', 'Chapitre 2', ['chapitre']),
      note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre'])
    ]
    const contents = new Map<string, string>([
      ['Notes/Perso/Alice.md', '# Alice'],
      ['Notes/Chap/Ch2.md', '---\nchapter: 2\n---\n\n# Chapitre 2\n\n[[Alice]]'],
      ['Notes/Chap/Ch1.md', '---\nchapter: 1\n---\n\n# Chapitre 1\n\n[[Alice]]']
    ])

    const data = buildTimelineData(notes, contents)
    expect(data.chapters[0].title).toBe('Chapitre 1')
    expect(data.chapters[1].title).toBe('Chapitre 2')
  })

  it('renvoie des données vides si pas de personnages ou chapitres', () => {
    const notes = [note('Notes/Note.md', 'Note', ['divers'])]
    const contents = new Map<string, string>([['Notes/Note.md', '# Note']])
    const data = buildTimelineData(notes, contents)
    expect(data.characters).toHaveLength(0)
    expect(data.chapters).toHaveLength(0)
  })

  it('identifie les personnages par espace', () => {
    const notes = [
      note('Notes/Personnages/Hero.md', 'Héro', [], 'Personnages'),
      note('Notes/Chapitres/Ch1.md', 'Chapitre 1', [], 'Chapitres')
    ]
    const contents = new Map<string, string>([
      ['Notes/Personnages/Hero.md', '# Héro'],
      ['Notes/Chapitres/Ch1.md', '# Chapitre 1\n\n[[Héro]]']
    ])

    const data = buildTimelineData(notes, contents)
    expect(data.characters).toHaveLength(1)
    expect(data.chapters).toHaveLength(1)
  })

  it('extrait un résumé du chapitre sans frontmatter ni titre', () => {
    const notes = [
      note('Notes/Perso/Alice.md', 'Alice', ['personnage']),
      note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre'])
    ]
    const contents = new Map<string, string>([
      ['Notes/Perso/Alice.md', '# Alice'],
      [
        'Notes/Chap/Ch1.md',
        '---\nchapter: 1\ntags: [chapitre]\n---\n\n# Chapitre 1\n\nLa pluie tombe sur **le port**.\nAlice attend [[Bob]] sur le quai.'
      ]
    ])

    const data = buildTimelineData(notes, contents)
    expect(data.chapters[0].snippet).toBe('La pluie tombe sur le port. Alice attend Bob sur le quai.')
    expect(data.chapters[0].snippet).not.toContain('chapter:')
    expect(data.chapters[0].snippet).not.toContain('#')
  })

  it('ne produit pas de résumé pour un chapitre vide', () => {
    const notes = [
      note('Notes/Perso/Alice.md', 'Alice', ['personnage']),
      note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre'])
    ]
    const contents = new Map<string, string>([
      ['Notes/Perso/Alice.md', '# Alice'],
      ['Notes/Chap/Ch1.md', '# Chapitre 1']
    ])

    const data = buildTimelineData(notes, contents)
    expect(data.chapters[0].snippet).toBe('')
  })
})

describe('types de relation', () => {
  const baseNotes = [
    note('Notes/Perso/Alice.md', 'Alice', ['personnage']),
    note('Notes/Perso/Bob.md', 'Bob', ['personnage'])
  ]

  function singleChapter(
    tags: string[],
    body: string
  ): ReturnType<typeof buildTimelineData> {
    const notes = [...baseNotes, note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre', ...tags])]
    return buildTimelineData(
      notes,
      new Map<string, string>([
        ['Notes/Perso/Alice.md', '# Alice'],
        ['Notes/Perso/Bob.md', '# Bob'],
        ['Notes/Chap/Ch1.md', `# Chapitre 1\n\n${body}`]
      ])
    )
  }

  it('détecte un lien wiki direct', () => {
    const data = singleChapter([], '[[Alice]] entre.')
    expect(data.relations.get('alice')?.get(0)).toEqual(['link'])
    expect(data.relations.get('bob')?.get(0)).toBeUndefined()
  })

  it('détecte un tag partagé entre personnage et chapitre', () => {
    const notes = [
      note('Notes/Perso/Alice.md', 'Alice', ['personnage', 'enquete']),
      note('Notes/Perso/Bob.md', 'Bob', ['personnage']),
      note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre', 'enquete'])
    ]
    const data = buildTimelineData(
      notes,
      new Map<string, string>([
        ['Notes/Perso/Alice.md', '# Alice'],
        ['Notes/Perso/Bob.md', '# Bob'],
        ['Notes/Chap/Ch1.md', '# Chapitre 1\n\nUne scène de nuit.']
      ])
    )
    expect(data.relations.get('alice')?.get(0)).toEqual(['tag'])
    expect(data.relations.get('bob')?.get(0)).toBeUndefined()
  })

  it('détecte un tag de chapitre égal au nom du personnage', () => {
    const data = singleChapter(['alice'], 'Une scène de nuit.')
    expect(data.relations.get('alice')?.get(0)).toEqual(['tag'])
  })

  it('détecte une mention en texte brut sans lien', () => {
    const data = singleChapter([], 'Alice traverse la cour.')
    expect(data.relations.get('alice')?.get(0)).toEqual(['mention'])
    expect(data.appearances.get('alice')?.has(0)).toBe(true)
  })

  it('ignore une mention partielle (borne de mot)', () => {
    const data = singleChapter([], 'Alicia traverse la cour.')
    expect(data.appearances.get('alice')?.has(0)).toBe(false)
  })

  it('ignore les mentions dans le code et les liens', () => {
    const data = singleChapter([], '`Bob` et https://exemple.test/Bob, puis [[Alice]]')
    expect(data.relations.get('alice')?.get(0)).toEqual(['link'])
    expect(data.appearances.get('bob')?.has(0)).toBe(false)
  })

  it('cumule les relations et garde la plus forte en tête de priorité', () => {
    const notes = [
      note('Notes/Perso/Alice.md', 'Alice', ['personnage', 'enquete']),
      note('Notes/Chap/Ch1.md', 'Chapitre 1', ['chapitre', 'enquete'])
    ]
    const data = buildTimelineData(
      notes,
      new Map<string, string>([
        ['Notes/Perso/Alice.md', '# Alice'],
        ['Notes/Chap/Ch1.md', '# Chapitre 1\n\n[[Alice]] interroge Alice.']
      ])
    )
    const relations = data.relations.get('alice')?.get(0) ?? []
    expect(relations).toContain('link')
    expect(relations).toContain('tag')
    expect(strongestRelation(relations)).toBe('link')
  })
})

describe('strongestRelation', () => {
  it('respecte la priorité lien > tag > mention', () => {
    expect(strongestRelation(['mention', 'tag'])).toBe('tag')
    expect(strongestRelation(['tag', 'link'])).toBe('link')
    expect(strongestRelation(['mention'])).toBe('mention')
  })

  it('renvoie null sans relation', () => {
    expect(strongestRelation(undefined)).toBeNull()
    expect(strongestRelation([])).toBeNull()
  })
})
