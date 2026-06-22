const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fileSystem = require('./services/fileSystem')

const isDev = !app.isPackaged

ipcMain.handle('fs:scanFolder', (_, folderPath) => fileSystem.scanFolder(folderPath))
ipcMain.handle('fs:readExif', (_, filePath) => fileSystem.readExif(filePath))
ipcMain.handle('fs:copyFile', (_, srcPath, dstPath) => fileSystem.copyFile(srcPath, dstPath))
ipcMain.handle('fs:moveToTrash', (_, filePath, trashFolderPath) => fileSystem.moveToTrash(filePath, trashFolderPath))
ipcMain.handle('fs:restoreFromTrash', (_, trashedPath, originalPath) => fileSystem.restoreFromTrash(trashedPath, originalPath))
ipcMain.handle('fs:emptyTrash', (_, trashFolderPath) => fileSystem.emptyTrash(trashFolderPath))
ipcMain.handle('fs:createDirectory', (_, dirPath) => fileSystem.createDirectory(dirPath))

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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
