const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } = require('electron')
const path = require('path')
const url = require('url')
const fileSystem = require('./services/fileSystem')
const imageProcessor = require('./services/imageProcessor')
const toolLauncher = require('./services/toolLauncher')

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'Frame',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('local-file', (request) => {
    const filePath = decodeURI(request.url.slice('local-file://'.length))
    return net.fetch(url.pathToFileURL(filePath).href)
  })
  await imageProcessor.ensureCacheDir()
  const fs = require('fs/promises')
  await fs.mkdir(path.join(app.getPath('home'), '.frame', 'temp'), { recursive: true })
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
