import type {
  BacklinkEntry,
  BackupEntry,
  BackupOverview,
  BackupSettings,
  CreatedNote,
  LinkCleanup,
  NoteSummary,
  SavedImage,
  Space,
  TagChange,
  TrashedNote,
  TrashedSpace,
  TrashItem,
  TrashRestoreResult,
  VaultInfo
} from './types'

export interface AppApi {
  getConfig: () => Promise<{ vault: VaultInfo | null }>
  createVault: () => Promise<VaultInfo | null>
  openVault: () => Promise<VaultInfo | null>
  revealVault: () => Promise<void>

  listNotes: () => Promise<NoteSummary[]>
  listSpaces: () => Promise<Space[]>
  readNote: (path: string) => Promise<string>
  writeNote: (
    path: string,
    content: string,
    expectedContent?: string
  ) => Promise<string>
  createNote: (space: string, content: string) => Promise<CreatedNote>
  trashNote: (path: string) => Promise<TrashedNote>
  restoreNote: (trashPath: string, path: string) => Promise<void>
  moveNote: (path: string, space: string) => Promise<{ path: string }>
  searchNotes: (query: string) => Promise<NoteSummary[]>
  listBacklinks: (path: string) => Promise<BacklinkEntry[]>
  saveImage: (dataUrl: string) => Promise<SavedImage>
  cleanLinks: (
    fromBases: string[],
    toBase: string | null,
    toTitle?: string
  ) => Promise<LinkCleanup[]>
  renameTag: (from: string, to: string) => Promise<TagChange[]>
  deleteTag: (tag: string) => Promise<TagChange[]>

  createSpace: (name: string) => Promise<void>
  renameSpace: (from: string, to: string) => Promise<void>
  trashSpace: (name: string) => Promise<TrashedSpace>
  restoreSpace: (trashPath: string, name: string) => Promise<void>

  listTrash: () => Promise<TrashItem[]>
  restoreTrash: (path: string) => Promise<TrashRestoreResult>
  deleteTrash: (path: string) => Promise<void>

  backupOverview: () => Promise<BackupOverview>
  createBackup: (reason?: string) => Promise<BackupEntry>
  restoreBackup: (id: string) => Promise<void>
  deleteBackup: (id: string) => Promise<void>
  updateBackupSettings: (settings: BackupSettings) => Promise<BackupSettings>
  exportVault: () => Promise<string | null>
  exportPdf: (html: string, suggestedName: string) => Promise<string | null>
  exportImage: (dataUrl: string, suggestedName: string) => Promise<string | null>
  openPath: (filePath: string) => Promise<void>

  closeCapture: () => Promise<void>
  onVaultChanged: (callback: () => void) => () => void
}

export const IPC = {
  getConfig: 'config:get',
  createVault: 'vault:create',
  openVault: 'vault:open',
  revealVault: 'vault:reveal',
  listNotes: 'notes:list',
  listSpaces: 'spaces:list',
  readNote: 'notes:read',
  writeNote: 'notes:write',
  createNote: 'notes:create',
  trashNote: 'notes:trash',
  restoreNote: 'notes:restore',
  moveNote: 'notes:move',
  searchNotes: 'notes:search',
  listBacklinks: 'notes:backlinks',
  saveImage: 'images:save',
  cleanLinks: 'notes:clean-links',
  renameTag: 'tags:rename',
  deleteTag: 'tags:delete',
  createSpace: 'spaces:create',
  renameSpace: 'spaces:rename',
  trashSpace: 'spaces:trash',
  restoreSpace: 'spaces:restore',
  listTrash: 'trash:list',
  restoreTrash: 'trash:restore',
  deleteTrash: 'trash:delete',
  backupOverview: 'backup:overview',
  createBackup: 'backup:create',
  restoreBackup: 'backup:restore',
  deleteBackup: 'backup:delete',
  updateBackupSettings: 'backup:settings',
  exportVault: 'backup:export',
  exportPdf: 'pdf:export',
  exportImage: 'image:export',
  openPath: 'shell:open-path',
  closeCapture: 'capture:close',
  vaultChanged: 'vault:changed'
} as const
