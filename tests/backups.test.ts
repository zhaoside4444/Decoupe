import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  backupDirectory,
  createBackup,
  deleteBackup,
  exportVault,
  listBackups,
  normalizeBackupSettings,
  restoreBackup
} from '../src/main/backups'
import { initVault, trashNote } from '../src/main/vault'

let root = ''
let storage = ''
let outside = ''

const settings = { enabled: true, intervalHours: 24, retention: 10 }

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-backup-'))
  storage = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-backup-store-'))
  outside = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-backup-export-'))
  await initVault(root)
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
  await fs.rm(storage, { recursive: true, force: true })
  await fs.rm(outside, { recursive: true, force: true })
})

function local(relative: string): string {
  return path.join(root, relative.split('/').join(path.sep))
}

async function writeNote(relative: string, content: string): Promise<void> {
  const full = local(relative)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf8')
}

async function delay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 8))
}

describe('sauvegardes locales', () => {
  it('cree un instantane complet et le liste', async () => {
    await writeNote('Notes/Projets/alpha.md', '# Alpha\n\nVersion initiale')
    await fs.mkdir(local('attachments'), { recursive: true })
    await fs.writeFile(local('attachments/image.png'), Buffer.from([1, 2, 3, 4]))
    await trashNote(root, 'Notes/Projets/alpha.md')
    await writeNote('Notes/Projets/alpha.md', '# Alpha\n\nVersion courante')

    const entry = await createBackup(root, storage, settings, 'Test manuel')
    expect(entry.reason).toBe('Test manuel')
    expect(entry.size).toBeGreaterThan(0)
    expect(entry.createdAt).toBeGreaterThan(0)

    const entries = await listBackups(root, storage)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(entry)
    expect(backupDirectory(root, storage)).toContain(path.basename(storage))

    const manifest = JSON.parse(
      await fs.readFile(
        path.join(backupDirectory(root, storage), entry.id, 'manifest.json'),
        'utf8'
      )
    ) as { version: number; reason: string; sourcePath: string }
    expect(manifest.version).toBe(1)
    expect(manifest.reason).toBe('Test manuel')
    expect(manifest.sourcePath).toBe(path.resolve(root))
    expect(await fs.readFile(local('attachments/image.png'))).toEqual(
      Buffer.from([1, 2, 3, 4])
    )
  })

  it('restaure une sauvegarde en conservant les fichiers hors vault', async () => {
    await writeNote('Notes/alpha.md', '# Avant')
    await writeNote('Notes/beta.md', '# Beta')
    const entry = await createBackup(root, storage, settings, 'Avant modification')

    await writeNote('Notes/alpha.md', '# Apres')
    await writeNote('Notes/gamma.md', '# Gamma')
    await fs.writeFile(local('libre.txt'), 'hors vault', 'utf8')

    await restoreBackup(root, storage, entry.id, settings)

    expect(await fs.readFile(local('Notes/alpha.md'), 'utf8')).toBe('# Avant')
    expect(await fs.readFile(local('Notes/beta.md'), 'utf8')).toBe('# Beta')
    await expect(fs.access(local('Notes/gamma.md'))).rejects.toThrow()
    expect(await fs.readFile(local('libre.txt'), 'utf8')).toBe('hors vault')

    const entries = await listBackups(root, storage)
    expect(entries.some((item) => item.reason === 'Avant restauration')).toBe(true)
  })

  it('applique la retention apres une sauvegarde', async () => {
    await writeNote('Notes/alpha.md', '# Alpha')
    await createBackup(root, storage, { ...settings, retention: 2 }, 'Un')
    await delay()
    await createBackup(root, storage, { ...settings, retention: 2 }, 'Deux')
    await delay()
    await createBackup(root, storage, { ...settings, retention: 2 }, 'Trois')

    const entries = await listBackups(root, storage)
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.reason)).toEqual(['Trois', 'Deux'])
  })

  it('supprime une sauvegarde et exporte le vault hors de celui-ci', async () => {
    await writeNote('Notes/alpha.md', '# Alpha')
    await fs.mkdir(local('attachments'), { recursive: true })
    await fs.writeFile(local('attachments/image.png'), Buffer.from([9, 8, 7]))
    const entry = await createBackup(root, storage, settings, 'A garder')

    const exported = await exportVault(root, outside)
    expect(path.dirname(exported)).toBe(path.resolve(outside))
    expect(await fs.readFile(path.join(exported, 'Notes/alpha.md'), 'utf8')).toBe(
      '# Alpha'
    )
    expect(await fs.readFile(path.join(exported, 'attachments/image.png'))).toEqual(
      Buffer.from([9, 8, 7])
    )
    await expect(exportVault(root, path.join(root, 'export'))).rejects.toThrow(
      'en dehors du vault'
    )

    await deleteBackup(root, storage, entry.id)
    expect(await listBackups(root, storage)).toEqual([])
  })

  it('normalise les reglages de sauvegarde', () => {
    expect(normalizeBackupSettings(null)).toEqual({
      enabled: true,
      intervalHours: 24,
      retention: 10
    })
    expect(
      normalizeBackupSettings({ enabled: false, intervalHours: 0, retention: 500 })
    ).toEqual({ enabled: false, intervalHours: 1, retention: 100 })
  })
})
