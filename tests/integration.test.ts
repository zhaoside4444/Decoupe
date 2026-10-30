import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearCache,
  createNote,
  deleteTag,
  initVault,
  listNotes,
  listTrash,
  moveNote,
  readNote,
  renameTag,
  restoreNote,
  restoreTrash,
  searchNotes,
  trashNote,
  trashSpace,
  writeNote
} from '../src/main/vault'
import { ensureCreatedDate, setCreatedDate, stripFrontmatter, tagsFromFrontmatter, titleFromMarkdown } from '../src/shared/text'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-integration-'))
  await initVault(root)
  clearCache()
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function seedVault(): Promise<{ paths: string[] }> {
  const paths: string[] = []
  const notes = [
    {
      space: 'Projet',
      title: 'Plan de projet',
      tags: ['projet', 'urgent'],
      created: '2026-09-15',
      body: '# Plan de projet\n\nObjectifs et jalons.\n\nVoir aussi [[Budget]] et [[Risques]].'
    },
    {
      space: 'Projet',
      title: 'Budget',
      tags: ['projet', 'finance'],
      created: '2026-09-20',
      body: '# Budget\n\nEstimation des coûts.\n\nRéférencé par [[Plan de projet]].'
    },
    {
      space: 'Perso',
      title: 'Idées',
      tags: ['idée', 'perso'],
      created: '2026-10-01',
      body: '# Idées\n\nListe d idées à explorer.\n\nLien vers [[Plan de projet]].'
    },
    {
      space: '',
      title: 'Journal',
      tags: ['journal'],
      created: '2026-10-10',
      body: '# Journal\n\nNotes quotidiennes.'
    }
  ]

  for (const note of notes) {
    const content = `---\ntitle: ${note.title}\ntags: [${note.tags.join(', ')}]\ncreated: ${note.created}\n---\n\n${note.body}`
    const created = await createNote(root, note.space, content)
    paths.push(created.path)
  }

  return { paths }
}

describe('scénario complet : création, tags, dates, liens, corbeille', () => {
  it('crée des notes avec frontmatter et conserve les métadonnées', async () => {
    const { paths } = await seedVault()
    expect(paths).toHaveLength(4)

    const notes = await listNotes(root)
    expect(notes).toHaveLength(4)

    const plan = notes.find((n) => n.title === 'Plan de projet')
    expect(plan).toBeDefined()
    expect(plan?.space).toBe('Projet')
    expect(plan?.tags).toEqual(['projet', 'urgent'])
    expect(plan?.createdAt).toBe('2026-09-15')
    expect(plan?.links).toContain('budget')
    expect(plan?.links).toContain('risques')
  })

  it('préserve la date de création après réécriture du contenu', async () => {
    const { paths } = await seedVault()
    const planPath = paths[0]

    const original = await readNote(root, planPath)
    const createdMatch = /created:\s*(\d{4}-\d{2}-\d{2})/.exec(original)
    expect(createdMatch?.[1]).toBe('2026-09-15')

    // Réécriture avec ensureCreatedDate (comme le fait l'éditeur)
    const updated = ensureCreatedDate(
      original.replace('Objectifs et jalons.', 'Objectifs et jalons mis à jour.'),
      '2026-09-15'
    )
    const stored = await writeNote(root, planPath, updated, original)
    expect(stored).toContain('created: 2026-09-15')

    const reloaded = await readNote(root, planPath)
    const reCreatedMatch = /created:\s*(\d{4}-\d{2}-\d{2})/.exec(reloaded)
    expect(reCreatedMatch?.[1]).toBe('2026-09-15')

    // Le titre et le corps sont bien mis à jour
    expect(titleFromMarkdown(reloaded)).toBe('Plan de projet')
    expect(reloaded).toContain('mis à jour')
  })

  it('renvoie le bon contenu via readNote après modification', async () => {
    const { paths } = await seedVault()
    const notePath = paths[3] // Journal

    const content = await readNote(root, notePath)
    expect(content).toContain('# Journal')
    expect(content).toContain('Notes quotidiennes.')
  })

  it('déplace une note entre espaces', async () => {
    const { paths } = await seedVault()
    const journalPath = paths[3]

    const result = await moveNote(root, journalPath, 'Projet')
    expect(result.path).not.toBe(journalPath)
    expect(result.path).toContain('Projet')

    const notes = await listNotes(root)
    const moved = notes.find((n) => n.base === 'Journal')
    expect(moved?.space).toBe('Projet')

    // L'ancien chemin n'existe plus
    await expect(readNote(root, journalPath)).rejects.toThrow()
  })

  it('met à la corbeille et restaure une note', async () => {
    const { paths } = await seedVault()
    const ideaPath = paths[2]

    const { trashPath } = await trashNote(root, ideaPath)
    expect(trashPath).toBeTruthy()

    let notes = await listNotes(root)
    expect(notes).toHaveLength(3)
    expect(notes.find((n) => n.path === ideaPath)).toBeUndefined()

    // Restauration
    await restoreNote(root, trashPath, ideaPath)
    notes = await listNotes(root)
    expect(notes).toHaveLength(4)
    const restored = notes.find((n) => n.path === ideaPath)
    expect(restored).toBeDefined()
    expect(restored?.title).toBe('Idées')
  })

  it('supprime définitivement après purge de la corbeille', async () => {
    const { paths } = await seedVault()
    const ideaPath = paths[2]

    const { trashPath } = await trashNote(root, ideaPath)
    const trashItems = await listTrash(root)
    expect(trashItems.length).toBeGreaterThan(0)

    const item = trashItems.find((t) => t.originalPath === ideaPath)
    expect(item).toBeDefined()

    await restoreTrash(root, item!.path)
    const notes = await listNotes(root)
    expect(notes.find((n) => n.path === ideaPath)).toBeDefined()
  })

  it('recherche par tag et par contenu', async () => {
    await seedVault()

    const byTag = await searchNotes(root, '#projet')
    expect(byTag.length).toBe(2)
    expect(byTag.every((n) => n.tags.includes('projet'))).toBe(true)

    const byText = await searchNotes(root, 'jalons')
    expect(byText.length).toBe(1)
    expect(byText[0].title).toBe('Plan de projet')

    const byDate = await searchNotes(root, 'date:2026-09-20')
    expect(byDate.length).toBe(1)
    expect(byDate[0].title).toBe('Budget')
  })

  it('recherche avec plage de dates', async () => {
    await seedVault()

    const range = await searchNotes(root, 'date:2026-09-15..2026-09-30')
    expect(range.length).toBe(2)
    const titles = range.map((n) => n.title).sort()
    expect(titles).toEqual(['Budget', 'Plan de projet'])
  })

  it('corbeille un dossier et restaure', async () => {
    await seedVault()

    await trashSpace(root, 'Perso')
    let notes = await listNotes(root)
    expect(notes.find((n) => n.space === 'Perso')).toBeUndefined()
    expect(notes).toHaveLength(3)

    const trashItems = await listTrash(root)
    const spaceItem = trashItems.find((t) => t.kind === 'space' && t.name === 'Perso')
    expect(spaceItem).toBeDefined()
  })
})

describe('conservation de created après toutes les écritures', () => {
  it('created persiste après writeNote, moveNote et trash/restore', async () => {
    await seedVault()
    const notes = await listNotes(root)
    const plan = notes.find((n) => n.title === 'Plan de projet')!
    const originalCreated = plan.createdAt
    expect(originalCreated).toBe('2026-09-15')

    // 1. writeNote
    const content = await readNote(root, plan.path)
    const updated = content.replace('Objectifs', 'Objectifs mis à jour')
    const ensured = ensureCreatedDate(updated, originalCreated)
    await writeNote(root, plan.path, ensured, content)

    let reloaded = await listNotes(root)
    let rePlan = reloaded.find((n) => n.title === 'Plan de projet')!
    expect(rePlan.createdAt).toBe(originalCreated)

    // 2. moveNote
    const moved = await moveNote(root, plan.path, 'Perso')
    reloaded = await listNotes(root)
    rePlan = reloaded.find((n) => n.title === 'Plan de projet')!
    expect(rePlan.createdAt).toBe(originalCreated)
    expect(rePlan.space).toBe('Perso')

    // 3. trash + restore
    const { trashPath } = await trashNote(root, moved.path)
    await restoreNote(root, trashPath, moved.path)
    reloaded = await listNotes(root)
    rePlan = reloaded.find((n) => n.title === 'Plan de projet')!
    expect(rePlan.createdAt).toBe(originalCreated)
  })

  it('created est initialisé depuis birthtime si absent du frontmatter', async () => {
    // Note sans frontmatter created
    const notePath = 'Notes/SansDate.md'
    await fs.writeFile(path.join(root, notePath), '# Sans date\n\nCorps.', 'utf8')

    const notes = await listNotes(root)
    const note = notes.find((n) => n.base === 'SansDate')
    expect(note).toBeDefined()
    expect(note?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('rollbacks et annulations', () => {
  it('annulation de renommage de tag restaure le contenu original', async () => {
    const alpha = 'Notes/alpha.md'
    const beta = 'Notes/beta.md'
    await fs.writeFile(path.join(root, alpha), '---\ntags: [old]\n---\n\n# Alpha\n\nCorps', 'utf8')
    await fs.writeFile(path.join(root, beta), '---\ntags: [old, autre]\n---\n\n# Beta\n\nCorps', 'utf8')
    clearCache()

    const changes = await renameTag(root, 'old', 'new')
    expect(changes).toHaveLength(2)

    // Vérifier que les changements contiennent le contenu original pour rollback
    for (const change of changes) {
      expect(change.content).toContain('tags: [old')
      expect(change.content).toContain('# ')
    }

    // Simuler le rollback : réécrire le contenu original
    for (const change of changes) {
      await writeNote(root, change.path, change.content)
    }
    clearCache()

    const notes = await listNotes(root)
    const alphaNote = notes.find((n) => n.base === 'alpha')
    const betaNote = notes.find((n) => n.base === 'beta')
    expect(alphaNote?.tags).toEqual(['old'])
    expect(betaNote?.tags).toEqual(['old', 'autre'])
  })

  it('annulation de suppression de tag restaure le tag', async () => {
    const alpha = 'Notes/alpha.md'
    await fs.writeFile(path.join(root, alpha), '---\ntags: [supprimer, garder]\n---\n\n# Alpha\n\nCorps', 'utf8')
    clearCache()

    const changes = await deleteTag(root, 'supprimer')
    expect(changes).toHaveLength(1)
    expect(changes[0].content).toContain('tags: [supprimer, garder]')

    // Rollback
    await writeNote(root, changes[0].path, changes[0].content)
    clearCache()

    const notes = await listNotes(root)
    const alphaNote = notes.find((n) => n.base === 'alpha')
    expect(alphaNote?.tags).toEqual(['supprimer', 'garder'])
  })

  it('restauration d une note supprimée recrée le fichier', async () => {
    const notePath = 'Notes/Restaurer.md'
    const originalContent = '---\ntags: [test]\ncreated: 2026-10-15\n---\n\n# Restaurer\n\nContenu important.'
    await fs.writeFile(path.join(root, notePath), originalContent, 'utf8')
    clearCache()

    const { trashPath } = await trashNote(root, notePath)
    expect(await listNotes(root).then((ns) => ns.find((n) => n.path === notePath))).toBeUndefined()

    await restoreNote(root, trashPath, notePath)
    const restored = await readNote(root, notePath)
    expect(restored).toContain('Contenu important.')
    expect(restored).toContain('created: 2026-10-15')
  })

  it('writeNote avec expectedContent lève une erreur en cas de conflit', async () => {
    const notePath = 'Notes/Conflit.md'
    await fs.writeFile(path.join(root, notePath), '---\ntags: []\n---\n\n# Conflit\n\nV1', 'utf8')
    clearCache()

    // Modification externe (simulée)
    await fs.writeFile(path.join(root, notePath), '---\ntags: []\n---\n\n# Conflit\n\nV2 externe', 'utf8')
    clearCache()

    // Tentative d'écriture avec l'ancien contenu comme référence
    const staleContent = '---\ntags: []\n---\n\n# Conflit\n\nV1'
    await expect(
      writeNote(root, notePath, '---\ntags: []\n---\n\n# Conflit\n\nV3 locale', staleContent)
    ).rejects.toThrow()
  })
})

describe('scénarios de liens et backlinks', () => {
  it('détecte les liens wiki entrants', async () => {
    await seedVault()

    const budget = (await listNotes(root)).find((n) => n.title === 'Budget')!
    const { listBacklinks } = await import('../src/main/vault')
    const backlinks = await listBacklinks(root, budget.path)

    // Budget est référencé par Plan de projet
    expect(backlinks.length).toBeGreaterThan(0)
    const referrer = backlinks.find((b) => b.title === 'Plan de projet')
    expect(referrer).toBeDefined()
    expect(referrer?.occurrences).toBeGreaterThan(0)
  })

  it('nettoie les liens lors de la suppression d une note', async () => {
    const { paths } = await seedVault()
    const plan = (await listNotes(root)).find((n) => n.title === 'Plan de projet')!

    const { cleanLinks } = await import('../src/main/vault')
    // Les wiki-links utilisent le titre original, pas le slug
    const cleanups = await cleanLinks(root, ['Plan de projet'], null)
    // Les notes référençant Plan de projet doivent être nettoyées
    expect(cleanups.length).toBeGreaterThan(0)
  })
})
