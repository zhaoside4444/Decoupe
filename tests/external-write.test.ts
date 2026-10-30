import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initVault, readNote, writeNote } from '../src/main/vault'

let root = ''
const relative = 'Notes/alpha.md'

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-external-'))
  await initVault(root)
  await writeNote(root, relative, '# Alpha')
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

function local(): string {
  return path.join(root, relative.split('/').join(path.sep))
}

describe('garde d’écriture externe', () => {
  it('refuse d’écraser une note modifiée sur le disque', async () => {
    const baseline = await readNote(root, relative)
    await fs.writeFile(local(), '# Externe', 'utf8')

    await expect(
      writeNote(root, relative, '# Local', baseline)
    ).rejects.toThrow('modifiée en dehors de Decoupe')
    expect(await fs.readFile(local(), 'utf8')).toBe('# Externe')
  })

  it('refuse de recréer silencieusement une note supprimée', async () => {
    const baseline = await readNote(root, relative)
    await fs.rm(local())

    await expect(
      writeNote(root, relative, '# Local', baseline)
    ).rejects.toThrow('modifiée en dehors de Decoupe')
    await expect(fs.access(local())).rejects.toThrow()
  })

  it('permet un enregistrement forcé après le choix de l’utilisateur', async () => {
    await fs.writeFile(local(), '# Externe', 'utf8')
    await writeNote(root, relative, '# Local')
    expect(await readNote(root, relative)).toContain('# Local')
  })
})
