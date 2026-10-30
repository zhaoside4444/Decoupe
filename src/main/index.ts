import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, net, protocol, shell } from 'electron'
import { existsSync, promises as fs, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC } from '../shared/api'
import type { BackupSettings, VaultInfo } from '../shared/types'
import * as backups from './backups'
import * as vault from './vault'

interface Config {
  vaultPath: string | null
  backup?: Partial<BackupSettings>
}

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let vaultPath: string | null = null
let watcher: FSWatcher | null = null
let notifyTimer: NodeJS.Timeout | null = null
let backupSettings: BackupSettings = backups.DEFAULT_BACKUP_SETTINGS
let backupTimer: NodeJS.Timeout | null = null
let backupDelayTimer: NodeJS.Timeout | null = null

const isDev = !!process.env['ELECTRON_RENDERER_URL']

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function configFile(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(configFile(), 'utf8')
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<Config>
    return {
      vaultPath: typeof parsed.vaultPath === 'string' ? parsed.vaultPath : null,
      backup:
        parsed.backup && typeof parsed.backup === 'object' ? parsed.backup : undefined
    }
  } catch {
    return { vaultPath: null }
  }
}

async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(
    configFile(),
    JSON.stringify({ ...config, backup: config.backup ?? backupSettings }, null, 2),
    'utf8'
  )
}

function backupStorageRoot(): string {
  return path.join(app.getPath('userData'), 'backups')
}

function vaultInfo(root: string): VaultInfo {
  return { path: root, name: path.basename(root) }
}

function notifyChange(): void {
  if (notifyTimer) clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.vaultChanged)
    }
  }, 250)
}

function startWatcher(root: string): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  try {
    watcher = watch(path.join(root, vault.NOTES_DIR), { recursive: true }, () => notifyChange())
    watcher.on('error', () => {
      watcher?.close()
      watcher = null
    })
  } catch {
    watcher = null
  }
}

async function runPeriodicBackup(): Promise<void> {
  if (!vaultPath || !backupSettings.enabled) return
  try {
    const entries = await backups.listBackups(vaultPath, backupStorageRoot())
    const last = entries[0]?.createdAt ?? 0
    const due = Date.now() - last >= backupSettings.intervalHours * 60 * 60 * 1000
    if (!due) return
    await backups.createBackup(
      vaultPath,
      backupStorageRoot(),
      backupSettings,
      'Sauvegarde automatique'
    )
  } catch (error) {
    console.error('Sauvegarde automatique impossible :', error)
  }
}

function scheduleBackupCheck(delay: number): void {
  if (backupDelayTimer) clearTimeout(backupDelayTimer)
  backupDelayTimer = setTimeout(() => {
    backupDelayTimer = null
    void runPeriodicBackup()
  }, delay)
}

async function snapshotBeforeDestructive(root: string, reason: string): Promise<void> {
  try {
    await backups.createBackup(root, backupStorageRoot(), backupSettings, reason)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erreur inconnue'
    throw new Error(`Opération annulée : sauvegarde de sécurité impossible (${detail}).`)
  }
}

function rendererFile(): string {
  return path.join(__dirname, '../renderer/index.html')
}

function loadRoute(win: BrowserWindow, hash: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    void win.loadFile(rendererFile(), { hash })
  }
}

function createMainWindow(): void {
  const iconPath = path.join(app.getAppPath(), 'build/icon.png')
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#f7f4ee',
    title: 'Decoupe',
    icon: existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: !isDev,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!isDev && process.platform !== 'darwin') Menu.setApplicationMenu(null)
  loadRoute(mainWindow, '/')
}

function openCapture(): void {
  if (!vaultPath) {
    mainWindow?.show()
    mainWindow?.focus()
    return
  }
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show()
    captureWindow.focus()
    return
  }

  captureWindow = new BrowserWindow({
    width: 640,
    height: 280,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#1d1c1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  captureWindow.once('ready-to-show', () => {
    captureWindow?.show()
    captureWindow?.focus()
  })
  captureWindow.on('closed', () => {
    captureWindow = null
  })
  captureWindow.on('blur', () => captureWindow?.close())

  loadRoute(captureWindow, '/capture')
}

async function applyVault(root: string): Promise<VaultInfo> {
  await vault.initVault(root)
  vaultPath = root
  vault.clearCache()
  await saveConfig({ vaultPath: root, backup: backupSettings })
  startWatcher(root)
  notifyChange()
  scheduleBackupCheck(2500)
  return vaultInfo(root)
}

async function chooseVault(): Promise<VaultInfo | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choisir le dossier des notes',
    buttonLabel: 'Utiliser ce dossier',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return null
  return applyVault(result.filePaths[0])
}

function currentVault(): VaultInfo | null {
  return vaultPath ? vaultInfo(vaultPath) : null
}

function requireVault(): string {
  if (!vaultPath) throw new Error('Aucun dossier de notes ouvert.')
  return vaultPath
}

function registerIpc(): void {
  ipcMain.handle(IPC.getConfig, () => ({ vault: currentVault() }))

  ipcMain.handle(IPC.createVault, () => chooseVault())
  ipcMain.handle(IPC.openVault, () => chooseVault())

  ipcMain.handle(IPC.revealVault, async () => {
    const root = requireVault()
    await shell.openPath(path.join(root, vault.NOTES_DIR))
  })

  ipcMain.handle(IPC.listNotes, () => vault.listNotes(requireVault()))
  ipcMain.handle(IPC.listSpaces, () => vault.listSpaces(requireVault()))
  ipcMain.handle(IPC.readNote, (_event, relativePath: string) =>
    vault.readNote(requireVault(), relativePath)
  )

  ipcMain.handle(
    IPC.writeNote,
    async (_event, relativePath: string, content: string, expectedContent?: string) => {
      const stored = await vault.writeNote(
        requireVault(),
        relativePath,
        content,
        expectedContent
      )
      notifyChange()
      return stored
    }
  )

  ipcMain.handle(IPC.createNote, async (_event, space: string, content: string) => {
    const created = await vault.createNote(requireVault(), space, content)
    notifyChange()
    return created
  })

  ipcMain.handle(IPC.trashNote, async (_event, relativePath: string) => {
    const result = await vault.trashNote(requireVault(), relativePath)
    notifyChange()
    return result
  })

  ipcMain.handle(IPC.restoreNote, async (_event, trashPath: string, relativePath: string) => {
    await vault.restoreNote(requireVault(), trashPath, relativePath)
    notifyChange()
  })

  ipcMain.handle(IPC.moveNote, async (_event, relativePath: string, space: string) => {
    const result = await vault.moveNote(requireVault(), relativePath, space)
    notifyChange()
    return result
  })

  ipcMain.handle(IPC.searchNotes, (_event, query: string) =>
    vault.searchNotes(requireVault(), query)
  )

  ipcMain.handle(IPC.listBacklinks, (_event, relativePath: string) =>
    vault.listBacklinks(requireVault(), relativePath)
  )

  ipcMain.handle(IPC.renameTag, async (_event, from: string, to: string) => {
    const changes = await vault.renameTag(requireVault(), from, to)
    if (changes.length) notifyChange()
    return changes
  })

  ipcMain.handle(IPC.deleteTag, async (_event, tag: string) => {
    const changes = await vault.deleteTag(requireVault(), tag)
    if (changes.length) notifyChange()
    return changes
  })

  ipcMain.handle(IPC.saveImage, (_event, dataUrl: string) =>
    vault.saveImage(requireVault(), dataUrl)
  )

  ipcMain.handle(
    IPC.cleanLinks,
    (_event, fromBases: string[], toBase: string | null, toTitle?: string) =>
      vault.cleanLinks(requireVault(), fromBases, toBase, toTitle)
  )

  ipcMain.handle(IPC.createSpace, async (_event, name: string) => {
    await vault.createSpace(requireVault(), name)
    notifyChange()
  })

  ipcMain.handle(IPC.renameSpace, async (_event, from: string, to: string) => {
    await vault.renameSpace(requireVault(), from, to)
    notifyChange()
  })

  ipcMain.handle(IPC.trashSpace, async (_event, name: string) => {
    const result = await vault.trashSpace(requireVault(), name)
    notifyChange()
    return result
  })

  ipcMain.handle(IPC.restoreSpace, async (_event, trashPath: string, name: string) => {
    await vault.restoreSpace(requireVault(), trashPath, name)
    notifyChange()
  })

  ipcMain.handle(IPC.listTrash, () => vault.listTrash(requireVault()))

  ipcMain.handle(IPC.restoreTrash, async (_event, trashPath: string) => {
    const result = await vault.restoreTrash(requireVault(), trashPath)
    notifyChange()
    return result
  })

  ipcMain.handle(IPC.deleteTrash, async (_event, trashPath: string) => {
    const root = requireVault()
    await snapshotBeforeDestructive(root, 'Avant suppression définitive')
    await vault.deleteTrash(root, trashPath)
    notifyChange()
  })

  ipcMain.handle(IPC.backupOverview, async () => {
    const root = requireVault()
    return {
      entries: await backups.listBackups(root, backupStorageRoot()),
      settings: backupSettings,
      directory: backups.backupDirectory(root, backupStorageRoot())
    }
  })

  ipcMain.handle(IPC.createBackup, (_event, reason?: string) => {
    const root = requireVault()
    return backups.createBackup(
      root,
      backupStorageRoot(),
      backupSettings,
      typeof reason === 'string' && reason.trim() ? reason : 'Sauvegarde manuelle'
    )
  })

  ipcMain.handle(IPC.restoreBackup, async (_event, id: string) => {
    const root = requireVault()
    if (watcher) {
      watcher.close()
      watcher = null
    }
    try {
      await backups.restoreBackup(root, backupStorageRoot(), id, backupSettings)
      vault.clearCache()
      await vault.initVault(root)
    } finally {
      startWatcher(root)
      notifyChange()
    }
  })

  ipcMain.handle(IPC.deleteBackup, async (_event, id: string) => {
    await backups.deleteBackup(requireVault(), backupStorageRoot(), id)
  })

  ipcMain.handle(IPC.updateBackupSettings, async (_event, settings: BackupSettings) => {
    backupSettings = backups.normalizeBackupSettings(settings)
    await saveConfig({ vaultPath, backup: backupSettings })
    scheduleBackupCheck(1000)
    return backupSettings
  })

  ipcMain.handle(IPC.exportVault, async () => {
    const root = requireVault()
    const result = await dialog.showOpenDialog({
      title: 'Exporter le vault',
      buttonLabel: 'Exporter ici',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return backups.exportVault(root, result.filePaths[0])
  })

  ipcMain.handle(IPC.exportPdf, async (_event, html: string, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Exporter en PDF',
      defaultPath: suggestedName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null

    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 1000,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      })
      await fs.writeFile(result.filePath, pdfBuffer)
      return result.filePath
    } finally {
      win.destroy()
    }
  })

  ipcMain.handle(IPC.exportImage, async (_event, dataUrl: string, suggestedName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Exporter la timeline en PNG',
      defaultPath: suggestedName,
      filters: [{ name: 'PNG', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null
    const buffer = Buffer.from(dataUrl.replace(/^data:image\/[^;]+;base64,/, ''), 'base64')
    await fs.mkdir(path.dirname(result.filePath), { recursive: true })
    await fs.writeFile(result.filePath, buffer)
    return result.filePath
  })

  ipcMain.handle(IPC.openPath, async (_event, filePath: string) => {
    await shell.openPath(filePath)
  })

  ipcMain.handle(IPC.closeCapture, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

function registerProtocol(): void {
  protocol.handle('vault', async (request) => {
    try {
      if (!vaultPath) return new Response('Aucun dossier', { status: 404 })
      const url = new URL(request.url)
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const full = path.resolve(vaultPath, relative)
      const root = path.resolve(vaultPath)
      if (full !== root && !full.startsWith(root + path.sep)) {
        return new Response('Interdit', { status: 403 })
      }
      return await net.fetch(pathToFileURL(full).toString())
    } catch {
      return new Response('Introuvable', { status: 404 })
    }
  })
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.decoupe.app')
    const config = await loadConfig()
    backupSettings = backups.normalizeBackupSettings(config.backup)
    if (config.vaultPath && existsSync(config.vaultPath)) {
      vaultPath = config.vaultPath
      await vault.initVault(vaultPath)
      startWatcher(vaultPath)
    }

    registerIpc()
    registerProtocol()
    createMainWindow()

    backupTimer = setInterval(() => void runPeriodicBackup(), 15 * 60 * 1000)
    scheduleBackupCheck(7000)

    const registered = globalShortcut.register('CommandOrControl+Alt+N', openCapture)
    if (!registered) console.warn('Raccourci de capture indisponible.')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    watcher?.close()
    watcher = null
    if (backupTimer) clearInterval(backupTimer)
    if (backupDelayTimer) clearTimeout(backupDelayTimer)
    backupTimer = null
    backupDelayTimer = null
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
