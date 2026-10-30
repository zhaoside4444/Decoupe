import { createHash, randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { BackupEntry, BackupSettings } from '../shared/types'
import { ATTACHMENTS_DIR, META_DIR, NOTES_DIR } from './vault'

const MANAGED_DIRS = [NOTES_DIR, ATTACHMENTS_DIR, META_DIR]
const MANIFEST = 'manifest.json'

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: true,
  intervalHours: 24,
  retention: 10
}

interface Manifest {
  version: 1
  id: string
  createdAt: number
  reason: string
  size: number
  sourcePath: string
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizeBackupSettings(
  value: Partial<BackupSettings> | null | undefined
): BackupSettings {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : true,
    intervalHours: clamp(value?.intervalHours ?? 24, 1, 720),
    retention: clamp(value?.retention ?? 10, 1, 100)
  }
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'sauvegarde'
}

function vaultKey(root: string): string {
  const resolved = path.resolve(root)
  const hash = createHash('sha256')
    .update(resolved.toLowerCase())
    .digest('hex')
    .slice(0, 12)
  const name =
    path
      .basename(resolved)
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(0, 40) || 'vault'
  return `${name}-${hash}`
}

export function backupDirectory(root: string, storageRoot: string): string {
  return path.join(storageRoot, vaultKey(root))
}

function entryDirectory(root: string, storageRoot: string, id: string): string {
  if (!id || path.basename(id) !== id || id === '.' || id === '..' || id.startsWith('.')) {
    throw new Error('Sauvegarde introuvable.')
  }
  return path.join(backupDirectory(root, storageRoot), id)
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function pathSize(target: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await fs.readdir(target, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(target, entry.name)
    if (entry.isDirectory()) total += await pathSize(full)
    else if (entry.isFile()) {
      try {
        total += (await fs.stat(full)).size
      } catch {
        // Le fichier a pu disparaître pendant le calcul.
      }
    }
  }
  return total
}

async function copyManaged(root: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true })
  for (const name of MANAGED_DIRS) {
    const source = path.join(root, name)
    if (!(await pathExists(source))) continue
    await fs.cp(source, path.join(target, name), {
      recursive: true,
      filter: (item) => !path.basename(item).startsWith('.tmp-')
    })
  }
}

function toEntry(manifest: Manifest): BackupEntry {
  return {
    id: manifest.id,
    createdAt: manifest.createdAt,
    reason: manifest.reason,
    size: manifest.size
  }
}

async function readManifest(directory: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(path.join(directory, MANIFEST), 'utf8')
    const parsed = JSON.parse(raw) as Partial<Manifest>
    if (
      parsed.version !== 1 ||
      typeof parsed.id !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.reason !== 'string' ||
      typeof parsed.size !== 'number'
    ) {
      return null
    }
    return {
      version: 1,
      id: parsed.id,
      createdAt: parsed.createdAt,
      reason: parsed.reason,
      size: parsed.size,
      sourcePath: typeof parsed.sourcePath === 'string' ? parsed.sourcePath : ''
    }
  } catch {
    return null
  }
}

export async function listBackups(
  root: string,
  storageRoot: string
): Promise<BackupEntry[]> {
  const directory = backupDirectory(root, storageRoot)
  let names: string[]
  try {
    names = await fs.readdir(directory)
  } catch {
    return []
  }
  const entries: BackupEntry[] = []
  for (const name of names) {
    if (name.startsWith('.')) continue
    const manifest = await readManifest(path.join(directory, name))
    if (!manifest || manifest.id !== name) continue
    entries.push(toEntry(manifest))
  }
  return entries.sort(
    (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)
  )
}

async function enforceRetention(
  root: string,
  storageRoot: string,
  retention: number
): Promise<void> {
  const directory = backupDirectory(root, storageRoot)
  const entries = await listBackups(root, storageRoot)
  for (const entry of entries.slice(
    normalizeBackupSettings({ retention }).retention
  )) {
    await fs.rm(path.join(directory, entry.id), { recursive: true, force: true })
  }
}

export async function createBackup(
  root: string,
  storageRoot: string,
  settings: BackupSettings,
  reason = 'Sauvegarde manuelle'
): Promise<BackupEntry> {
  const directory = backupDirectory(root, storageRoot)
  await fs.mkdir(directory, { recursive: true })

  const now = Date.now()
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-')
  const suffix = randomBytes(3).toString('hex')
  const id = `${stamp}-${slugify(reason)}-${suffix}`
  const target = path.join(directory, id)
  const temporary = path.join(directory, `.tmp-${id}`)

  await fs.rm(temporary, { recursive: true, force: true })
  try {
    const snapshot = path.join(temporary, 'vault')
    await copyManaged(root, snapshot)
    const manifest: Manifest = {
      version: 1,
      id,
      createdAt: now,
      reason: reason.trim().slice(0, 120) || 'Sauvegarde manuelle',
      size: await pathSize(snapshot),
      sourcePath: path.resolve(root)
    }
    await fs.writeFile(
      path.join(temporary, MANIFEST),
      JSON.stringify(manifest, null, 2),
      'utf8'
    )
    await fs.rename(temporary, target)
    await enforceRetention(root, storageRoot, settings.retention)
    return toEntry(manifest)
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

export async function deleteBackup(
  root: string,
  storageRoot: string,
  id: string
): Promise<void> {
  const target = entryDirectory(root, storageRoot, id)
  if (!(await pathExists(path.join(target, MANIFEST)))) {
    throw new Error('Sauvegarde introuvable.')
  }
  await fs.rm(target, { recursive: true, force: true })
}

export async function restoreBackup(
  root: string,
  storageRoot: string,
  id: string,
  settings: BackupSettings
): Promise<void> {
  const source = path.join(entryDirectory(root, storageRoot, id), 'vault')
  if (!(await pathExists(source))) throw new Error('Sauvegarde introuvable.')

  const staging = path.join(
    backupDirectory(root, storageRoot),
    `.restore-${Date.now()}-${randomBytes(4).toString('hex')}`
  )
  try {
    await fs.cp(source, staging, {
      recursive: true,
      filter: (item) => !path.basename(item).startsWith('.tmp-')
    })
    await createBackup(root, storageRoot, settings, 'Avant restauration')

    await fs.mkdir(root, { recursive: true })
    for (const name of MANAGED_DIRS) {
      await fs.rm(path.join(root, name), { recursive: true, force: true })
    }
    for (const name of MANAGED_DIRS) {
      const saved = path.join(staging, name)
      if (await pathExists(saved)) {
        await fs.cp(saved, path.join(root, name), { recursive: true })
      }
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function uniqueExportDirectory(destination: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  let target = path.join(destination, `Decoupe-export-${stamp}`)
  let counter = 2
  while (await pathExists(target)) {
    target = path.join(destination, `Decoupe-export-${stamp}-${counter}`)
    counter += 1
  }
  return target
}

export async function exportVault(root: string, destination: string): Promise<string> {
  const source = path.resolve(root)
  const target = path.resolve(destination)
  const relative = path.relative(source, target)
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('Choisissez un dossier en dehors du vault.')
  }
  const directory = await uniqueExportDirectory(target)
  await fs.mkdir(directory, { recursive: true })
  try {
    await copyManaged(source, directory)
    return directory
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}
