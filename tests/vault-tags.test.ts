import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteTag,
  initVault,
  listNotes,
  renameTag,
  searchNotes,
  writeNote as saveNote
} from '../src/main/vault'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-tags-'))
  await initVault(root)
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function writeNote(name: string, content: string): Promise<string> {
  const relative = `Notes/${name}.md`
  await fs.writeFile(path.join(root, relative), content, 'utf8')
  return relative
}

describe('opérations globales sur les tags', () => {
  it('renomme un tag dans toutes les notes concernées', async () => {
    const alpha = await writeNote(
      'alpha',
      '---\ntitle: Alpha\ntags: [Projet, Idée]\n---\n\n# Alpha\n\nCorps'
    )
    const beta = await writeNote(
      'beta',
      '---\ntags: [projet]\n---\n\n# Beta\n\nAutre'
    )
    await writeNote('gamma', '---\ntags: [client]\n---\n\n# Gamma')

    const changes = await renameTag(root, 'PROJET', 'Client')
    expect(changes.map((change) => change.path).sort()).toEqual([alpha, beta].sort())

    const notes = await listNotes(root)
    const alphaNote = notes.find((note) => note.path === alpha)
    const betaNote = notes.find((note) => note.path === beta)
    expect(alphaNote?.tags).toEqual(['Client', 'Idée'])
    expect(betaNote?.tags).toEqual(['Client'])
    expect((await searchNotes(root, '#client')).length).toBe(3)
    expect(await searchNotes(root, '#projet')).toEqual([])

    const restored = changes.find((change) => change.path === alpha)
    expect(restored?.content).toContain('tags: [Projet, Idée]')
  })

  it('supprime un tag sans toucher aux autres tags ni au corps', async () => {
    const note = await writeNote(
      'alpha',
      '---\ntags: [a, b]\ncreated: 2024-01-02\n---\n\n# Alpha\n\nCorps intact'
    )

    const changes = await deleteTag(root, 'A')
    expect(changes).toHaveLength(1)
    const content = await fs.readFile(path.join(root, note), 'utf8')
    expect(content).toBe(
      '---\ntags: [b]\ncreated: 2024-01-02\n---\n\n# Alpha\n\nCorps intact'
    )
    expect((await searchNotes(root, '#a')).length).toBe(0)
    expect((await searchNotes(root, '#b')).length).toBe(1)
  })

  it('ne modifie rien quand le tag est absent', async () => {
    await writeNote('alpha', '---\ntags: [a]\n---\n\nCorps')
    expect(await renameTag(root, 'absent', 'b')).toEqual([])
    expect(await deleteTag(root, 'absent')).toEqual([])
  })
})

describe('date de création', () => {
  it('conserve la date de création lors d’une sauvegarde', async () => {
    const note = await writeNote(
      'archive',
      '---\ncreated: 2024-01-02\ntags: [a]\n---\n\n# Archive\n\nAncien'
    )
    await writeNote('recent', '---\ncreated: 2026-10-23\n---\n\n# Récent')

    expect((await listNotes(root)).find((item) => item.path === note)?.createdAt).toBe(
      '2024-01-02'
    )

    await saveNote(root, note, '# Archive\n\nNouveau contenu sans frontmatter')
    const saved = await fs.readFile(path.join(root, note), 'utf8')
    expect(saved).toContain('created: 2024-01-02')
    expect((await listNotes(root)).find((item) => item.path === note)?.createdAt).toBe(
      '2024-01-02'
    )
  })

  it('conserve la date de création lors d’une annulation', async () => {
    const note = await writeNote('legacy', '---\ntags: [a]\n---\n\n# Legacy')
    const before = (await listNotes(root)).find((item) => item.path === note)?.createdAt
    const changes = await deleteTag(root, 'a')
    expect(changes).toHaveLength(1)

    await saveNote(root, note, changes[0].content)
    expect((await listNotes(root)).find((item) => item.path === note)?.createdAt).toBe(
      before
    )
  })

  it('filtre la recherche par date de création', async () => {
    const old = await writeNote('old', '---\ncreated: 2024-01-02\n---\n\n# Old')
    await writeNote('new', '---\ncreated: 2026-10-23\n---\n\n# New')

    expect((await searchNotes(root, 'date:2024-01-02')).map((note) => note.path)).toEqual([
      old
    ])
    expect(await searchNotes(root, 'date:2024-01-02 #absent')).toEqual([])
    expect(await searchNotes(root, 'date:2024-01-02 #tag')).toEqual([])
  })
})
