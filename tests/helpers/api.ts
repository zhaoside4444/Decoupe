import { vi } from 'vitest'
import type { AppApi } from '../../src/shared/api'
import type { BackupEntry, BackupOverview, BackupSettings } from '../../src/shared/types'

export const sampleBackup: BackupEntry = {
  id: 'backup-1',
  createdAt: Date.UTC(2026, 9, 30, 10, 0),
  reason: 'Sauvegarde manuelle',
  size: 2048
}

export const sampleOverview: BackupOverview = {
  entries: [sampleBackup],
  settings: { enabled: true, intervalHours: 24, retention: 10 },
  directory: 'C:\\Decoupe\\backups'
}

/**
 * Installe un `window.api` minimal pour les composants qui appellent l'IPC.
 * Les méthodes non surchargées renvoient des valeurs neutres.
 */
export function installApi(overrides: Partial<Record<keyof AppApi, unknown>> = {}) {
  const api = {
    backupOverview: vi.fn(async () => sampleOverview),
    createBackup: vi.fn(async () => sampleBackup),
    restoreBackup: vi.fn(async () => {}),
    deleteBackup: vi.fn(async () => {}),
    updateBackupSettings: vi.fn(async (settings: BackupSettings) => settings),
    exportVault: vi.fn(async () => null)
  } as unknown as Record<string, ReturnType<typeof vi.fn>>

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) api[key] = value as ReturnType<typeof vi.fn>
  }

  Object.defineProperty(window, 'api', { value: api, configurable: true, writable: true })
  return api
}
