const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fileSystem = require('./services/fileSystem')
const imageProcessor = require('./services/imageProcessor')

const isDev = !app.isPackaged

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
  await imageProcessor.ensureCacheDir()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
