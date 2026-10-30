import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initVault, searchNotes } from '../src/main/vault'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-search-'))
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

describe('recherche enrichie', () => {
  it('classe les résultats par titre, tags puis contenu', async () => {
    const alpha = await writeNote(
      'alpha',
      '---\ntags: [client]\n---\n\n# Facture projet\n\nCorps'
    )
    const beta = await writeNote(
      'beta',
      '---\ntags: [facture]\n---\n\n# Beta\n\nDétails'
    )
    const gamma = await writeNote(
      'gamma',
      '---\ntags: [archives]\n---\n\n# Gamma\n\nUne note sur la facture puis une autre facture.'
    )

    const results = await searchNotes(root, 'facture')
    expect(results.map((note) => note.path)).toEqual([alpha, beta, gamma])

    const title = results.find((note) => note.path === alpha)
    expect(title?.match).toEqual({
      field: 'title',
      occurrences: 1,
      snippet: 'Corps'
    })
    const tags = results.find((note) => note.path === beta)
    expect(tags?.match).toEqual({
      field: 'tags',
      occurrences: 1,
      snippet: 'Détails'
    })
    const content = results.find((note) => note.path === gamma)
    expect(content?.match).toEqual({
      field: 'content',
      occurrences: 2,
      snippet: 'Une note sur la facture puis une autre facture.'
    })
  })

  it('compte les correspondances dans le titre et le contenu', async () => {
    await writeNote(
      'alpha',
      '---\ncreated: 2026-10-01\n---\n\n# Facture\n\nUne facture et une autre facture, puis une troisième facture.'
    )
    const result = (await searchNotes(root, 'facture'))[0]
    expect(result?.match?.field).toBe('title')
    expect(result?.match?.occurrences).toBe(4)
    expect(result?.match?.snippet).toContain('Une facture et une autre facture')
  })

  it('filtre par une plage de dates de création', async () => {
    const alpha = await writeNote(
      'alpha',
      '---\ncreated: 2026-10-05\n---\n\n# Alpha'
    )
    await writeNote('beta', '---\ncreated: 2026-09-10\n---\n\n# Beta')
    await writeNote('gamma', '---\ncreated: 2026-11-01\n---\n\n# Gamma')

    const results = await searchNotes(root, 'date:2026-10-01..2026-10-31')
    expect(results.map((note) => note.path)).toEqual([alpha])
    expect(results[0]?.match).toBeUndefined()
  })

  it('ignore le code et la syntaxe des listes dans les extraits', async () => {
    const note = await writeNote(
      'alpha',
      '# Alpha\n\n- Une liste avec facture\n\n```\nfacture\n```'
    )
    const result = (await searchNotes(root, 'facture'))[0]
    expect(result?.match?.occurrences).toBe(1)
    expect(result?.match?.snippet).toBe('Une liste avec facture')
    expect(note).toBe('Notes/alpha.md')
  })
})
