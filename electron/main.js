const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, dialog, protocol, net, screen } = require('electron')
const path = require('path')
const os = require('os')
const url = require('url')
const fileSystem = require('./services/fileSystem')
const imageProcessor = require('./services/imageProcessor')
const toolLauncher = require('./services/toolLauncher')
const uploadService = require('./services/uploadService')
const sessionStore = require('./services/sessionStore')
const sequenceDetector = require('./services/sequenceDetector')
const backupService = require('./services/backupService')
const libraryService = require('./services/libraryService')
const obsidianExport = require('./services/obsidianExport')

const isDev = !app.isPackaged
const REPO_URL = 'https://github.com/muftring/frame'

app.setName('Frame')

let mainWindow = null
let tray = null
let splash = null
let pendingImportPath = null
const MIN_SPLASH_MS = 1400
const MAX_SPLASH_MS = 4000

// macOS fires 'open-file' (e.g. double-clicking a .framelib) before
// app.whenReady() resolves, so the handler must be registered up front and
// the path stashed until the main window exists and can receive it.
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (filePath.endsWith('.framelib')) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('library:triggerImport', filePath)
    } else {
      pendingImportPath = filePath
    }
  }
})

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
])

ipcMain.handle('fs:scanFolder', (_, folderPath) => fileSystem.scanFolder(folderPath))
ipcMain.handle('fs:readExif', (_, filePath) => fileSystem.readExif(filePath))
ipcMain.handle('fs:copyFile', (_, srcPath, dstPath) => fileSystem.copyFile(srcPath, dstPath))
ipcMain.handle('fs:moveToTrash', (_, filePath, trashFolderPath) => fileSystem.moveToTrash(filePath, trashFolderPath))
ipcMain.handle('fs:restoreFromTrash', (_, trashedPath, originalPath) => fileSystem.restoreFromTrash(trashedPath, originalPath))
ipcMain.handle('fs:emptyTrash', (_, trashFolderPath) => fileSystem.emptyTrash(trashFolderPath))
ipcMain.handle('fs:createDirectory', (_, dirPath) => fileSystem.createDirectory(dirPath))
ipcMain.handle('fs:fileExists', (_, filePath) => fileSystem.fileExists(filePath))

ipcMain.handle('img:thumbnail', (_, filePath, size) => imageProcessor.thumbnail(filePath, size))
ipcMain.handle('img:rotate', (_, filePath, degrees, outputPath) => imageProcessor.rotate(filePath, degrees, outputPath))
ipcMain.handle('img:crop', (_, filePath, region, outputPath) => imageProcessor.crop(filePath, region, outputPath))
ipcMain.handle('img:getMetadata', (_, filePath) => imageProcessor.getMetadata(filePath))
ipcMain.handle('img:flip', (_, filePath, direction, outputPath) => imageProcessor.flip(filePath, direction, outputPath))
ipcMain.handle('img:getFullMetadata', (_, filePath) => imageProcessor.getFullMetadata(filePath))
ipcMain.handle('img:getMetadataBatch', (_, filePaths) => imageProcessor.getMetadataBatch(filePaths))

ipcMain.handle('tools:findInstalled', async () => {
  const store = await getStore()
  const frameSettings = store.get('frameSettings') || {}
  return toolLauncher.findInstalled({ ffmpegPath: frameSettings.ffmpegPath, huginPath: frameSettings.huginPath })
})
ipcMain.handle('tools:findStandardPaths', () => toolLauncher.findStandardPaths())
ipcMain.handle('tools:openFile', (_, toolPath, filePath) => toolLauncher.openFile(toolPath, filePath))
ipcMain.handle('tools:openFolder', (_, toolPath, folderPath) => toolLauncher.openFolder(toolPath, folderPath))
ipcMain.handle('tools:openFiles', (_, toolPath, filePaths, styleName) => toolLauncher.openFiles(toolPath, filePaths, styleName))
ipcMain.handle('tools:runBatchExport', (event, toolPath, inputPaths, outputFolder, presetPath) =>
  toolLauncher.runBatchExport(toolPath, inputPaths, outputFolder, presetPath, event.sender))
ipcMain.handle('tools:openHugin', (_, huginPath, filePaths) => toolLauncher.openHugin(huginPath, filePaths))
ipcMain.handle('tools:runQuickStitch', (event, options) => toolLauncher.runQuickStitch(options, event.sender))
ipcMain.handle('tools:cancelQuickStitch', () => toolLauncher.cancelQuickStitch())
ipcMain.handle('tools:checkFfmpegVersion', (_, ffmpegPath) => toolLauncher.checkFfmpegVersion(ffmpegPath))
ipcMain.handle('tools:createComposite', (event, options) => toolLauncher.createComposite(options, event.sender))
ipcMain.handle('tools:revealInFinder', (_, filePath) => {
  shell.showItemInFolder(filePath)
  return { success: true }
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{
      name: 'Images',
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp', 'heic', 'heif', 'nef', 'cr2', 'arw', 'orf', 'rw2', 'dng']
    }]
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_, defaultPath) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'PNG', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (result.canceled) return null
  return result.filePath
})

ipcMain.handle('app:getTempDir', () => {
  return path.join(os.homedir(), '.frame', 'temp')
})

ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

const fsNode = require('fs/promises')
const cacheDir = () => path.join(os.homedir(), '.frame', 'thumbcache')

ipcMain.handle('cache:getInfo', async () => {
  try {
    const files = await fsNode.readdir(cacheDir())
    const jpgs = files.filter(f => f.endsWith('.jpg'))
    let size = 0
    for (const f of jpgs) {
      const stat = await fsNode.stat(path.join(cacheDir(), f))
      size += stat.size
    }
    return { count: jpgs.length, size }
  } catch {
    return { count: 0, size: 0 }
  }
})

ipcMain.handle('cache:clear', async () => {
  try {
    const files = await fsNode.readdir(cacheDir())
    let deleted = 0
    for (const f of files) {
      if (f.endsWith('.jpg')) {
        await fsNode.unlink(path.join(cacheDir(), f))
        deleted++
      }
    }
    return { deleted }
  } catch {
    return { deleted: 0 }
  }
})

ipcMain.handle('dialog:openExecutable', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'treatPackageAsDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openPdf', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openPreset', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'RawTherapee Presets', extensions: ['pp3'] }]
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:saveFramelib', async (_, defaultPath) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'Frame Library', extensions: ['framelib'] }]
  })
  if (result.canceled) return null
  return result.filePath
})

ipcMain.handle('dialog:openFramelib', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Frame Library', extensions: ['framelib'] }]
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openVaultFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    message: 'Select your Obsidian vault folder'
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openDarktableStyle', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Darktable Styles', extensions: ['dtstyle'] }]
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('shell:openExternal', (_, extUrl) => {
  shell.openExternal(extUrl)
  return { success: true }
})

ipcMain.handle('shell:openPath', (_, filePath) => {
  shell.openPath(filePath)
  return { success: true }
})

ipcMain.handle('upload:getProviders', () => uploadService.getProviders())
ipcMain.handle('upload:run', (event, providerId, files, options) =>
  uploadService.upload(providerId, files, options, event.sender))

ipcMain.handle('session:create', (_, name, sourcePath) => sessionStore.sessionCreate(name, sourcePath))
ipcMain.handle('session:list', () => sessionStore.sessionList())
ipcMain.handle('session:get', (_, sessionId) => sessionStore.sessionGet(sessionId))
ipcMain.handle('session:update', (_, sessionId, fields) => sessionStore.sessionUpdate(sessionId, fields))
ipcMain.handle('session:archive', (_, sessionId) => sessionStore.sessionArchive(sessionId))
ipcMain.handle('session:count', () => sessionStore.sessionCount())
ipcMain.handle('file:count', () => sessionStore.fileCount())
ipcMain.handle('file:countByStatus', (_, status) => sessionStore.fileCountByStatus(status))
ipcMain.handle('pano:countSets', () => sessionStore.panoCountSets())
ipcMain.handle('burst:countComposited', () => sessionStore.burstCountComposited())
ipcMain.handle('session:updatePipeline', (event, sessionId, stage, complete) => {
  const result = sessionStore.sessionUpdatePipeline(sessionId, stage, complete)
  if (result.allComplete) {
    event.sender.send('session:complete', { sessionId, summary: result.summary })
  }
  return result
})

ipcMain.handle('group:create', (_, sessionId, label, folderPath, fileCount, startTs, endTs, sortOrder) =>
  sessionStore.groupCreate(sessionId, label, folderPath, fileCount, startTs, endTs, sortOrder))
ipcMain.handle('group:rename', (_, groupId, newLabel) => sessionStore.groupRename(groupId, newLabel))
ipcMain.handle('group:list', (_, sessionId) => sessionStore.groupList(sessionId))
ipcMain.handle('pipeline:setLastFile', (_, sessionId, fileId) => sessionStore.pipelineSetLastFile(sessionId, fileId))

ipcMain.handle('notes:updateSession', (_, sessionId, notes) => sessionStore.notesUpdateSession(sessionId, notes))
ipcMain.handle('notes:updateGroup', (_, groupId, notes) => sessionStore.notesUpdateGroup(groupId, notes))

const JOURNAL_PATH = path.join(os.homedir(), '.frame', 'journal.md')

ipcMain.handle('journal:read', async () => {
  try {
    const content = await fsNode.readFile(JOURNAL_PATH, 'utf8')
    return { content }
  } catch {
    return { content: '' }
  }
})

ipcMain.handle('journal:write', async (_, content) => {
  try {
    await fsNode.mkdir(path.dirname(JOURNAL_PATH), { recursive: true })
    await fsNode.writeFile(JOURNAL_PATH, content, 'utf8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('journal:getPath', () => JOURNAL_PATH)

ipcMain.handle('file:upsert', (_, sessionId, groupId, fileData) =>
  sessionStore.fileUpsert(sessionId, groupId, fileData))
ipcMain.handle('file:updateStatus', (_, fileId, status) => sessionStore.fileUpdateStatus(fileId, status))
ipcMain.handle('file:updateTags', (_, fileId, tags) => sessionStore.fileUpdateTags(fileId, tags))
ipcMain.handle('file:updateTrashedPath', (_, fileId, newPath, trashedAt) => sessionStore.fileUpdateTrashedPath(fileId, newPath, trashedAt))
ipcMain.handle('file:updatePublished', (_, fileId, destinations) =>
  sessionStore.fileUpdatePublished(fileId, destinations))
ipcMain.handle('file:listByGroup', (_, groupId) => sessionStore.fileListByGroup(groupId))
ipcMain.handle('file:listBySession', (_, sessionId, filters) =>
  sessionStore.fileListBySession(sessionId, filters))
ipcMain.handle('file:getByPath', (_, filePath) => sessionStore.fileGetByPath(filePath))
ipcMain.handle('file:setRating', (_, fileId, rating) => sessionStore.fileSetRating(fileId, rating))

ipcMain.handle('tag:listDefinitions', () => sessionStore.tagListDefinitions())
ipcMain.handle('tag:createDefinition', (_, name, label, color, icon, shortcut) =>
  sessionStore.tagCreateDefinition(name, label, color, icon, shortcut))
ipcMain.handle('tag:addToFile', (_, fileId, tagName) => sessionStore.tagAddToFile(fileId, tagName))
ipcMain.handle('tag:removeFromFile', (_, fileId, tagName) => sessionStore.tagRemoveFromFile(fileId, tagName))
ipcMain.handle('tag:toggleOnFile', (_, fileId, tagName) => sessionStore.tagToggleOnFile(fileId, tagName))
ipcMain.handle('tag:listByTag', (_, tagName, sessionId) => sessionStore.tagListByTag(tagName, sessionId))
ipcMain.handle('tag:listByFile', (_, fileId) => sessionStore.tagListByFile(fileId))

ipcMain.handle('pano:confirmSet', (_, sessionId, fileIds, name) => sessionStore.panoConfirmSet(sessionId, fileIds, name))
ipcMain.handle('pano:updateSet', (_, panoSetId, fields) => sessionStore.panoUpdateSet(panoSetId, fields))
ipcMain.handle('pano:deleteSet', (_, panoSetId) => sessionStore.panoDeleteSet(panoSetId))
ipcMain.handle('pano:listSets', (_, sessionId) => sessionStore.panoListSets(sessionId))
ipcMain.handle('pano:listFiles', (_, panoSetId) => sessionStore.panoListFiles(panoSetId))
ipcMain.handle('pano:addFile', (_, panoSetId, fileId) => sessionStore.panoAddFile(panoSetId, fileId))
ipcMain.handle('pano:removeFile', (_, panoSetId, fileId) => sessionStore.panoRemoveFile(panoSetId, fileId))
ipcMain.handle('pano:reorderFrames', (_, panoSetId, orderedFileIds) => sessionStore.panoReorderFrames(panoSetId, orderedFileIds))

ipcMain.handle('burst:confirmSet', (_, sessionId, fileIds, name) => sessionStore.burstConfirmSet(sessionId, fileIds, name))
ipcMain.handle('burst:updateSet', (_, burstSetId, fields) => sessionStore.burstUpdateSet(burstSetId, fields))
ipcMain.handle('burst:deleteSet', (_, burstSetId) => sessionStore.burstDeleteSet(burstSetId))
ipcMain.handle('burst:listSets', (_, sessionId) => sessionStore.burstListSets(sessionId))
ipcMain.handle('burst:listFiles', (_, burstSetId) => sessionStore.burstListFiles(burstSetId))
ipcMain.handle('burst:addFile', (_, burstSetId, fileId) => sessionStore.burstAddFile(burstSetId, fileId))
ipcMain.handle('burst:removeFile', (_, burstSetId, fileId) => sessionStore.burstRemoveFile(burstSetId, fileId))
ipcMain.handle('burst:reorderFrames', (_, burstSetId, orderedFileIds) => sessionStore.burstReorderFrames(burstSetId, orderedFileIds))
ipcMain.handle('burst:setKeeper', (_, burstSetId, fileId) => sessionStore.burstSetKeeper(burstSetId, fileId))

ipcMain.handle('sequence:detectGroups', (_, sessionId, options) => sequenceDetector.detectGroups(sessionId, options))
ipcMain.handle('sequence:getDetectionHistory', (_, sessionId) => sequenceDetector.getDetectionHistory(sessionId))

ipcMain.handle('album:create', (_, name, rules, scope, sessionId, sortBy, sortDir) =>
  sessionStore.albumCreate(name, rules, scope, sessionId, sortBy, sortDir))
ipcMain.handle('album:list', (_, scope, sessionId) => sessionStore.albumList(scope, sessionId))
ipcMain.handle('album:get', (_, albumId) => sessionStore.albumGet(albumId))
ipcMain.handle('album:update', (_, albumId, fields) => sessionStore.albumUpdate(albumId, fields))
ipcMain.handle('album:delete', (_, albumId) => sessionStore.albumDelete(albumId))
ipcMain.handle('album:preview', (_, rules, scope, sessionId) => sessionStore.albumPreview(rules, scope, sessionId))
ipcMain.handle('album:resolveFiles', (_, albumId) => sessionStore.albumResolveFiles(albumId))

ipcMain.handle('backup:create', async () => {
  try {
    const backup = await backupService.createBackup()
    return { success: true, backup }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
ipcMain.handle('backup:list', () => backupService.listBackups())
ipcMain.handle('backup:restore', async (_, backupPath) => {
  try {
    await backupService.restoreBackup(backupPath)
    app.relaunch()
    app.exit(0)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
ipcMain.handle('backup:delete', async (_, backupPath) => {
  try {
    await fsNode.unlink(backupPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
ipcMain.handle('backup:openFolder', async () => {
  await fsNode.mkdir(backupService.BACKUPS_DIR, { recursive: true })
  shell.openPath(backupService.BACKUPS_DIR)
  return { success: true }
})

ipcMain.handle('library:validateCurrentDb', () => backupService.validateDb(backupService.DB_PATH))

ipcMain.handle('library:getExportSize', (_, includeThumbs) => libraryService.getExportSize(includeThumbs))

ipcMain.handle('library:export', async (event, options) => {
  const store = await getStore()
  return libraryService.exportLibrary(options, store.store, (progress) => {
    event.sender.send('library:exportProgress', progress)
  })
})

ipcMain.handle('library:getManifest', (_, filePath) => libraryService.getManifest(filePath))

ipcMain.handle('library:import', async (event, filePath, pathMappings) => {
  const result = await libraryService.importLibrary(filePath, pathMappings, (step) => {
    event.sender.send('library:importProgress', { step })
  })
  if (result.success && result.importedSettings) {
    const PRESERVE_KEYS = new Set(['windowBounds'])
    try {
      const store = await getStore()
      for (const [key, value] of Object.entries(result.importedSettings)) {
        if (PRESERVE_KEYS.has(key)) continue
        store.set(key, value)
      }
    } catch { /* settings merge is best-effort */ }
  }
  delete result.importedSettings
  return result
})

ipcMain.handle('fs:pathExists', (_, filePath) =>
  fsNode.access(filePath).then(() => true).catch(() => false))

ipcMain.handle('library:exportObsidian', async (_, scope, sessionId) => {
  const store = await getStore()
  const vaultPath = store.get('obsidianVaultPath')
  const subfolder = store.get('obsidianVaultSubfolder', 'Frame')
  if (!vaultPath) return { success: false, error: 'Obsidian vault path not configured' }
  return obsidianExport.exportObsidian(scope, sessionId, { vaultPath, subfolder })
})

ipcMain.handle('app:relaunch', () => {
  app.relaunch()
  app.exit(0)
})

// electron-store is an ESM-only package under this project's CJS main
// process (same issue as archiver@8), so this reuses the getStore()
// singleton below rather than `require('electron-store')` directly.
async function runAutoBackup() {
  try {
    const store = await getStore()
    const enabled = store.get('autoBackup.enabled', true)
    if (!enabled) return { skipped: true, reason: 'disabled' }

    const backups = await backupService.listBackups()
    const today = new Date().toISOString().slice(0, 10)
    const regular = backups.filter(b => /^frame-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(b.filename))
    const alreadyToday = regular.some(b => b.filename.startsWith('frame-' + today))
    if (alreadyToday) return { skipped: true, reason: 'already backed up today' }

    const dbExists = await fsNode.access(backupService.DB_PATH).then(() => true).catch(() => false)
    if (!dbExists) return { skipped: true, reason: 'no database yet' }

    const backup = await backupService.createBackup()
    await backupService.pruneBackups(7)
    return { skipped: false, backup }
  } catch (err) {
    return { skipped: true, reason: 'error: ' + err.message }
  }
}

let _store = null
async function getStore() {
  if (!_store) {
    const { default: Store } = await import('electron-store')
    _store = new Store({ name: 'frame-settings' })
  }
  return _store
}

ipcMain.handle('store:get', async (_, key) => {
  try {
    const store = await getStore()
    return store.get(key)
  } catch {
    return null
  }
})

ipcMain.handle('store:set', async (_, key, value) => {
  try {
    const store = await getStore()
    store.set(key, value)
  } catch {
    // ignore store errors
  }
})

ipcMain.handle('settings:get', async (_, key, defaultValue) => {
  try {
    const store = await getStore()
    return { value: store.get(key, defaultValue) }
  } catch {
    return { value: defaultValue }
  }
})

ipcMain.handle('settings:set', async (_, key, value) => {
  try {
    const store = await getStore()
    store.set(key, value)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// startHidden gates initial visibility on 'ready-to-show' (first paint) so
// the splash sequence in app.whenReady() can reveal the window itself once
// it's actually ready, avoiding a white-flash. Callers that don't care
// about that (the 'activate' handler, the tray menu's "Show Frame"
// fallback) get the previous immediate-show behavior unchanged.
// A saved x/y is only trustworthy if it still lands on a currently
// connected display — e.g. the window was last positioned on a second
// monitor that's since been unplugged. When it doesn't, drop x/y (not
// width/height) so Electron falls back to its default centered placement
// on whatever display is available now.
function validateBoundsOnScreen(bounds) {
  if (bounds?.x == null || bounds?.y == null) return bounds
  const displays = screen.getAllDisplays()
  const isOnScreen = displays.some(d => (
    bounds.x >= d.bounds.x &&
    bounds.y >= d.bounds.y &&
    bounds.x < d.bounds.x + d.bounds.width &&
    bounds.y < d.bounds.y + d.bounds.height
  ))
  if (!isOnScreen) {
    const { x, y, ...rest } = bounds
    return rest
  }
  return bounds
}

async function createWindow({ startHidden = false } = {}) {
  let bounds = null
  try {
    const store = await getStore()
    bounds = validateBoundsOnScreen(store.get('windowBounds'))
  } catch {}

  const win = new BrowserWindow({
    width: bounds?.width || 1280,
    height: bounds?.height || 820,
    x: bounds?.x,
    y: bounds?.y,
    title: 'Frame',
    show: !startHidden,
    backgroundColor: '#1a1a1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const readyToShow = startHidden
    ? new Promise(resolve => win.once('ready-to-show', resolve))
    : Promise.resolve()

  let boundsTimer
  const saveBounds = () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(async () => {
      // Don't persist a maximized/minimized size as the "normal" restore
      // size — getBounds() during either state reflects the maximized/
      // minimized geometry, not the size the user actually resized to.
      if (win.isMaximized() || win.isMinimized()) return
      try {
        const store = await getStore()
        store.set('windowBounds', win.getBounds())
      } catch {}
    }, 500)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'))
  }

  mainWindow = win
  await readyToShow
  return win
}

async function createSplash() {
  splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))
  return new Promise(resolve => {
    splash.once('ready-to-show', () => {
      splash.show()
      splash.webContents.executeJavaScript(`setVersion('v${app.getVersion()}')`).catch(() => {})
      resolve()
    })
  })
}

async function setSplashProgress(pct) {
  if (splash && !splash.isDestroyed()) {
    await splash.webContents.executeJavaScript(`setProgress(${pct})`).catch(() => {})
  }
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
      ]
    },
    {
      role: 'help',
      submenu: [
        { label: 'Frame on GitHub', click: () => shell.openExternal(REPO_URL) }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function setupAboutPanel() {
  app.setAboutPanelOptions({
    applicationName: 'Frame',
    applicationVersion: app.getVersion(),
    copyright: `Created by Michael Uftring\n${REPO_URL}\nMIT License\n\n© ${new Date().getFullYear()} Michael Uftring`,
    iconPath: path.join(__dirname, 'assets', 'appIcon.png')
  })
}

function buildTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayIconTemplate.png'))
  image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip('Frame')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Frame', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit Frame', role: 'quit' }
  ]))
}

app.whenReady().then(async () => {
  const splashStart = Date.now()

  // Safety net: if any startup step below hangs, show the main window
  // anyway rather than leaving the user stuck at the splash forever.
  const maxSplashTimer = setTimeout(() => {
    if (splash && !splash.isDestroyed()) splash.destroy()
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show()
  }, MAX_SPLASH_MS)

  protocol.handle('local-file', (request) => {
    const raw = request.url.slice('local-file://'.length)
    const filePath = decodeURI(raw.split('?')[0])
    return net.fetch(url.pathToFileURL(filePath).href)
  })

  await createSplash()
  await setSplashProgress(15)

  if (isDev && process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'assets', 'appIcon.png'))
  }

  setupAboutPanel()
  buildMenu()
  buildTray()

  const win = await createWindow({ startHidden: true })
  await setSplashProgress(40)

  await imageProcessor.ensureCacheDir()
  await fsNode.mkdir(path.join(os.homedir(), '.frame', 'temp'), { recursive: true })
  await setSplashProgress(65)

  // Backup failure must never block startup — runAutoBackup() already
  // swallows its own errors and returns { skipped: true, reason }.
  const backupResult = await runAutoBackup()
  if (backupResult.skipped) {
    console.log('[auto-backup] skipped:', backupResult.reason)
  } else {
    console.log('[auto-backup] created', backupResult.backup.filename)
  }

  // Renderer + preload are already loaded by the time createWindow()'s
  // ready-to-show promise resolved above, so there's no separate cache
  // "warm up" step to await here — just keep the splash cadence even.
  await setSplashProgress(85)
  await setSplashProgress(100)

  const elapsed = Date.now() - splashStart
  if (elapsed < MIN_SPLASH_MS) {
    await new Promise(r => setTimeout(r, MIN_SPLASH_MS - elapsed))
  }

  clearTimeout(maxSplashTimer)
  if (splash && !splash.isDestroyed()) {
    splash.destroy()
    splash = null
  }
  win.show()

  if (pendingImportPath) {
    win.webContents.send('library:triggerImport', pendingImportPath)
    pendingImportPath = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
