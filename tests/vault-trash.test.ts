import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createSpace,
  deleteTrash,
  initVault,
  listTrash,
  restoreTrash,
  trashNote,
  trashSpace
} from '../src/main/vault'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-trash-'))
  await initVault(root)
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function local(relative: string): string {
  return path.join(root, relative.split('/').join(path.sep))
}

async function writeNote(relative: string, content: string): Promise<void> {
  const full = local(relative)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf8')
}

describe('corbeille visible', () => {
  it('liste une note supprimée et la restaure à son emplacement d’origine', async () => {
    await writeNote('Notes/Projets/alpha.md', '---\ncreated: 2024-01-02\n---\n\n# Alpha\n\nCorps')
    const { trashPath } = await trashNote(root, 'Notes/Projets/alpha.md')

    const items = await listTrash(root)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'note',
      name: 'alpha.md',
      title: 'Alpha',
      originalPath: 'Notes/Projets/alpha.md'
    })
    expect(items[0].deletedAt).toBeGreaterThan(0)

    const restored = await restoreTrash(root, trashPath)
    expect(restored.path).toBe('Notes/Projets/alpha.md')
    expect(await fs.readFile(local('Notes/Projets/alpha.md'), 'utf8')).toContain('# Alpha')
    expect(await listTrash(root)).toEqual([])
    await expect(fs.access(`${local(trashPath)}.meta.json`)).rejects.toThrow()
  })

  it('restaure sous un autre nom si l’emplacement est déjà occupé', async () => {
    await writeNote('Notes/Projets/alpha.md', '# Ancienne')
    const { trashPath } = await trashNote(root, 'Notes/Projets/alpha.md')
    await writeNote('Notes/Projets/alpha.md', '# Nouvelle')

    const restored = await restoreTrash(root, trashPath)
    expect(restored.path).toBe('Notes/Projets/alpha-2.md')
    expect(await fs.readFile(local('Notes/Projets/alpha-2.md'), 'utf8')).toContain(
      '# Ancienne'
    )
  })

  it('restaure les anciens éléments sans métadonnées dans la boîte d’entrée', async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const trashPath = `.decoupe/corbeille/${stamp}-legacy.md`
    await writeNote(trashPath, '# Legacy')

    const items = await listTrash(root)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'note',
      title: 'legacy',
      originalPath: null
    })

    const restored = await restoreTrash(root, trashPath)
    expect(restored.path).toBe('Notes/legacy.md')
    expect(await fs.readFile(local('Notes/legacy.md'), 'utf8')).toBe('# Legacy')
  })

  it('liste et restaure un dossier sans écraser celui qui a été recréé', async () => {
    await createSpace(root, 'Projets')
    await writeNote('Notes/Projets/alpha.md', '# Alpha')
    const { trashPath } = await trashSpace(root, 'Projets')

    const items = await listTrash(root)
    expect(items[0]).toMatchObject({
      kind: 'space',
      name: 'Projets',
      title: 'Projets',
      originalPath: 'Notes/Projets'
    })

    await createSpace(root, 'Projets')
    const restored = await restoreTrash(root, trashPath)
    expect(restored.path).toBe('Notes/Projets-2')
    expect(await fs.readFile(local('Notes/Projets-2/alpha.md'), 'utf8')).toBe('# Alpha')
  })

  it('supprime définitivement un élément et ses métadonnées', async () => {
    await createSpace(root, 'Projets')
    await writeNote('Notes/Projets/alpha.md', '# Alpha')
    const { trashPath } = await trashSpace(root, 'Projets')

    await deleteTrash(root, trashPath)
    expect(await listTrash(root)).toEqual([])
    await expect(fs.access(local(trashPath))).rejects.toThrow()
    await expect(fs.access(`${local(trashPath)}.meta.json`)).rejects.toThrow()
  })
})
