import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findWikiLinks, wikiLinkSnippet } from '../src/shared/text'
import { initVault, listBacklinks, writeNote } from '../src/main/vault'

describe('analyse des wiki-liens', () => {
  it('extrait les cibles et les alias', () => {
    const matches = findWikiLinks('Voir [[Cible]] puis [[cible|la cible]] et [[Autre|détail]].')
    expect(matches.map((match) => match.target)).toEqual(['Cible', 'cible', 'Autre'])
    expect(matches.map((match) => match.label)).toEqual([null, 'la cible', 'détail'])
  })

  it('produit un extrait lisible autour du lien', () => {
    const markdown = '# Titre\n\nUne phrase avec [[Cible|la cible]] au milieu.'
    const match = findWikiLinks(markdown)[0]
    const snippet = wikiLinkSnippet(markdown, match.index, match.length)
    expect(snippet).toContain('Une phrase avec la cible au milieu.')
    expect(snippet).not.toContain('[[')
  })
})

describe('liens entrants', () => {
  let root = ''
  let target = ''

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-backlinks-'))
    await initVault(root)
    target = 'Notes/Cible.md'
    await writeNote(root, target, '# Cible\n\nContenu de référence.')
    await writeNote(root, 'Notes/Source.md', '# Source\n\nVoir [[Cible]] et [[cible|la cible]].')
    await writeNote(
      root,
      'Notes/Projets/Projet.md',
      '# Projet\n\nRéférence [[Cible|la cible principale]].'
    )
    await writeNote(root, 'Notes/Autre.md', '# Autre\n\n[[Sans rapport]]')
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('liste les notes qui pointent vers la cible, sans doublon', async () => {
    const entries = await listBacklinks(root, target)
    expect(entries.map((entry) => entry.path).sort()).toEqual([
      'Notes/Projets/Projet.md',
      'Notes/Source.md'
    ])
    const source = entries.find((entry) => entry.path === 'Notes/Source.md')
    expect(source).toMatchObject({
      base: 'Source',
      title: 'Source',
      space: '',
      occurrences: 2
    })
    expect(source?.snippet).toContain('Voir Cible et la cible.')
    const project = entries.find((entry) => entry.path === 'Notes/Projets/Projet.md')
    expect(project?.space).toBe('Projets')
  })

  it('ignore les liens de la note vers elle-même et les liens absents', async () => {
    await writeNote(root, target, '# Cible\n\nAuto-référence [[Cible]].')
    const entries = await listBacklinks(root, target)
    expect(entries.some((entry) => entry.path === target)).toBe(false)
    expect(entries).toHaveLength(2)
  })

  it('reflète une modification des liens après réécriture', async () => {
    await writeNote(root, 'Notes/Autre.md', '# Autre\n\nNouveau [[Cible]].')
    expect(await listBacklinks(root, target)).toHaveLength(3)

    await writeNote(root, 'Notes/Source.md', '# Source\n\nPlus de lien.')
    const entries = await listBacklinks(root, target)
    expect(entries.map((entry) => entry.path).sort()).toEqual([
      'Notes/Autre.md',
      'Notes/Projets/Projet.md'
    ])
  })

  it('retourne une liste vide pour une cible sans lien entrant', async () => {
    await writeNote(root, 'Notes/Seule.md', '# Seule\n\nPersonne ne me cite.')
    expect(await listBacklinks(root, 'Notes/Seule.md')).toEqual([])
  })
})
