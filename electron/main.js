const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, dialog, protocol, net } = require('electron')
const path = require('path')
const url = require('url')
const fileSystem = require('./services/fileSystem')
const imageProcessor = require('./services/imageProcessor')
const toolLauncher = require('./services/toolLauncher')
const uploadService = require('./services/uploadService')
const sessionStore = require('./services/sessionStore')

const isDev = !app.isPackaged
const REPO_URL = 'https://github.com/muftring/frame'

app.setName('Frame')

let mainWindow = null
let tray = null

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

ipcMain.handle('img:thumbnail', (_, filePath, size) => imageProcessor.thumbnail(filePath, size))
ipcMain.handle('img:rotate', (_, filePath, degrees, outputPath) => imageProcessor.rotate(filePath, degrees, outputPath))
ipcMain.handle('img:crop', (_, filePath, region, outputPath) => imageProcessor.crop(filePath, region, outputPath))
ipcMain.handle('img:getMetadata', (_, filePath) => imageProcessor.getMetadata(filePath))
ipcMain.handle('img:flip', (_, filePath, direction, outputPath) => imageProcessor.flip(filePath, direction, outputPath))
ipcMain.handle('img:getFullMetadata', (_, filePath) => imageProcessor.getFullMetadata(filePath))
ipcMain.handle('img:getMetadataBatch', (_, filePaths) => imageProcessor.getMetadataBatch(filePaths))

ipcMain.handle('tools:findInstalled', () => toolLauncher.findInstalled())
ipcMain.handle('tools:openFile', (_, toolPath, filePath) => toolLauncher.openFile(toolPath, filePath))
ipcMain.handle('tools:openFolder', (_, toolPath, folderPath) => toolLauncher.openFolder(toolPath, folderPath))
ipcMain.handle('tools:runBatchExport', (event, toolPath, inputPaths, outputFolder, presetPath) =>
  toolLauncher.runBatchExport(toolPath, inputPaths, outputFolder, presetPath, event.sender))
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
  return path.join(app.getPath('home'), '.frame', 'temp')
})

ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

const fsNode = require('fs/promises')
const cacheDir = () => path.join(app.getPath('home'), '.frame', 'thumbcache')

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

ipcMain.handle('album:create', (_, name, rules, scope, sessionId, sortBy, sortDir) =>
  sessionStore.albumCreate(name, rules, scope, sessionId, sortBy, sortDir))
ipcMain.handle('album:list', (_, scope, sessionId) => sessionStore.albumList(scope, sessionId))
ipcMain.handle('album:get', (_, albumId) => sessionStore.albumGet(albumId))
ipcMain.handle('album:update', (_, albumId, fields) => sessionStore.albumUpdate(albumId, fields))
ipcMain.handle('album:delete', (_, albumId) => sessionStore.albumDelete(albumId))
ipcMain.handle('album:preview', (_, rules, scope, sessionId) => sessionStore.albumPreview(rules, scope, sessionId))
ipcMain.handle('album:resolveFiles', (_, albumId) => sessionStore.albumResolveFiles(albumId))

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

async function createWindow() {
  let bounds = null
  try {
    const store = await getStore()
    bounds = store.get('windowBounds')
  } catch {}

  const win = new BrowserWindow({
    width: bounds?.width || 1280,
    height: bounds?.height || 820,
    x: bounds?.x,
    y: bounds?.y,
    title: 'Frame',
    backgroundColor: '#1a1a1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  let boundsTimer
  const saveBounds = () => {
    clearTimeout(boundsTimer)
    boundsTimer = setTimeout(async () => {
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
  protocol.handle('local-file', (request) => {
    const raw = request.url.slice('local-file://'.length)
    const filePath = decodeURI(raw.split('?')[0])
    return net.fetch(url.pathToFileURL(filePath).href)
  })
  await imageProcessor.ensureCacheDir()
  await fsNode.mkdir(path.join(app.getPath('home'), '.frame', 'temp'), { recursive: true })

  if (isDev && process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'assets', 'appIcon.png'))
  }

  setupAboutPanel()
  buildMenu()
  buildTray()
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
