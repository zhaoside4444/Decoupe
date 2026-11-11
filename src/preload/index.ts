import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppApi } from '../shared/api'
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
  VaultInfo,
  VaultOrder
} from '../shared/types'

const api: AppApi = {
  getConfig: () => ipcRenderer.invoke(IPC.getConfig) as Promise<{ vault: VaultInfo | null }>,
  createVault: () => ipcRenderer.invoke(IPC.createVault) as Promise<VaultInfo | null>,
  openVault: (root?: string) =>
    ipcRenderer.invoke(IPC.openVault, root) as Promise<VaultInfo | null>,
  revealVault: () => ipcRenderer.invoke(IPC.revealVault) as Promise<void>,

  listNotes: () => ipcRenderer.invoke(IPC.listNotes) as Promise<NoteSummary[]>,
  listSpaces: () => ipcRenderer.invoke(IPC.listSpaces) as Promise<Space[]>,
  readOrder: () => ipcRenderer.invoke(IPC.readOrder) as Promise<VaultOrder>,
  writeOrder: (order: VaultOrder) =>
    ipcRenderer.invoke(IPC.writeOrder, order) as Promise<void>,
  readNote: (path: string) => ipcRenderer.invoke(IPC.readNote, path) as Promise<string>,
  writeNote: (path: string, content: string, expectedContent?: string) =>
    ipcRenderer.invoke(IPC.writeNote, path, content, expectedContent) as Promise<string>,
  createNote: (space: string, content: string) =>
    ipcRenderer.invoke(IPC.createNote, space, content) as Promise<CreatedNote>,
  trashNote: (path: string) => ipcRenderer.invoke(IPC.trashNote, path) as Promise<TrashedNote>,
  restoreNote: (trashPath: string, path: string) =>
    ipcRenderer.invoke(IPC.restoreNote, trashPath, path) as Promise<void>,
  moveNote: (path: string, space: string) =>
    ipcRenderer.invoke(IPC.moveNote, path, space) as Promise<{ path: string }>,
  searchNotes: (query: string) =>
    ipcRenderer.invoke(IPC.searchNotes, query) as Promise<NoteSummary[]>,
  listBacklinks: (path: string) =>
    ipcRenderer.invoke(IPC.listBacklinks, path) as Promise<BacklinkEntry[]>,
  saveImage: (dataUrl: string) =>
    ipcRenderer.invoke(IPC.saveImage, dataUrl) as Promise<SavedImage>,
  exportImage: (dataUrl: string, suggestedName: string) =>
    ipcRenderer.invoke(IPC.exportImage, dataUrl, suggestedName) as Promise<string | null>,
  cleanLinks: (fromBases: string[], toBase: string | null, toTitle?: string) =>
    ipcRenderer.invoke(IPC.cleanLinks, fromBases, toBase, toTitle) as Promise<LinkCleanup[]>,
  renameTag: (from: string, to: string) =>
    ipcRenderer.invoke(IPC.renameTag, from, to) as Promise<TagChange[]>,
  deleteTag: (tag: string) => ipcRenderer.invoke(IPC.deleteTag, tag) as Promise<TagChange[]>,

  createSpace: (name: string) => ipcRenderer.invoke(IPC.createSpace, name) as Promise<void>,
  renameSpace: (from: string, to: string) =>
    ipcRenderer.invoke(IPC.renameSpace, from, to) as Promise<void>,
  trashSpace: (name: string) =>
    ipcRenderer.invoke(IPC.trashSpace, name) as Promise<TrashedSpace>,
  restoreSpace: (trashPath: string, name: string) =>
    ipcRenderer.invoke(IPC.restoreSpace, trashPath, name) as Promise<void>,

  listTrash: () => ipcRenderer.invoke(IPC.listTrash) as Promise<TrashItem[]>,
  restoreTrash: (path: string) =>
    ipcRenderer.invoke(IPC.restoreTrash, path) as Promise<TrashRestoreResult>,
  deleteTrash: (path: string) => ipcRenderer.invoke(IPC.deleteTrash, path) as Promise<void>,

  backupOverview: () =>
    ipcRenderer.invoke(IPC.backupOverview) as Promise<BackupOverview>,
  createBackup: (reason?: string) =>
    ipcRenderer.invoke(IPC.createBackup, reason) as Promise<BackupEntry>,
  restoreBackup: (id: string) =>
    ipcRenderer.invoke(IPC.restoreBackup, id) as Promise<void>,
  deleteBackup: (id: string) => ipcRenderer.invoke(IPC.deleteBackup, id) as Promise<void>,
  updateBackupSettings: (settings: BackupSettings) =>
    ipcRenderer.invoke(IPC.updateBackupSettings, settings) as Promise<BackupSettings>,
  exportVault: () => ipcRenderer.invoke(IPC.exportVault) as Promise<string | null>,
  exportPdf: (html: string, suggestedName: string) =>
    ipcRenderer.invoke(IPC.exportPdf, html, suggestedName) as Promise<string | null>,
  openPath: (filePath: string) => ipcRenderer.invoke(IPC.openPath, filePath) as Promise<void>,

  closeCapture: () => ipcRenderer.invoke(IPC.closeCapture) as Promise<void>,
  onVaultChanged: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.vaultChanged, listener)
    return () => ipcRenderer.removeListener(IPC.vaultChanged, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
