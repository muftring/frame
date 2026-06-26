const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } = require('electron')
const path = require('path')
const url = require('url')
const fileSystem = require('./services/fileSystem')
const imageProcessor = require('./services/imageProcessor')
const toolLauncher = require('./services/toolLauncher')
const uploadService = require('./services/uploadService')
const sessionStore = require('./services/sessionStore')

const isDev = !app.isPackaged

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
ipcMain.handle('session:updatePipeline', (_, sessionId, stage, complete) =>
  sessionStore.sessionUpdatePipeline(sessionId, stage, complete))

ipcMain.handle('group:rename', (_, groupId, newLabel) => sessionStore.groupRename(groupId, newLabel))
ipcMain.handle('group:list', (_, sessionId) => sessionStore.groupList(sessionId))

ipcMain.handle('file:upsert', (_, sessionId, groupId, fileData) =>
  sessionStore.fileUpsert(sessionId, groupId, fileData))
ipcMain.handle('file:updateStatus', (_, fileId, status) => sessionStore.fileUpdateStatus(fileId, status))
ipcMain.handle('file:updatePublished', (_, fileId, destinations) =>
  sessionStore.fileUpdatePublished(fileId, destinations))
ipcMain.handle('file:listByGroup', (_, groupId) => sessionStore.fileListByGroup(groupId))
ipcMain.handle('file:listBySession', (_, sessionId, filters) =>
  sessionStore.fileListBySession(sessionId, filters))
ipcMain.handle('file:getByPath', (_, filePath) => sessionStore.fileGetByPath(filePath))
ipcMain.handle('file:setRating', (_, fileId, rating) => sessionStore.fileSetRating(fileId, rating))

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

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('local-file', (request) => {
    const raw = request.url.slice('local-file://'.length)
    const filePath = decodeURI(raw.split('?')[0])
    return net.fetch(url.pathToFileURL(filePath).href)
  })
  await imageProcessor.ensureCacheDir()
  await fsNode.mkdir(path.join(app.getPath('home'), '.frame', 'temp'), { recursive: true })
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
