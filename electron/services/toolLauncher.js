const { spawn } = require('child_process')
const fs = require('fs/promises')
const path = require('path')

const TOOL_PATHS = {
  darwin: {
    darktable: [
      '/Applications/darktable.app/Contents/MacOS/darktable',
      '/usr/local/bin/darktable'
    ],
    rawtherapee: [
      '/Applications/RawTherapee.app/Contents/MacOS/rawtherapee',
      '/usr/local/bin/rawtherapee'
    ]
  },
  win32: {
    darktable: [
      'C:\\Program Files\\darktable\\bin\\darktable.exe'
    ],
    rawtherapee: [
      'C:\\Program Files\\RawTherapee\\rawtherapee.exe'
    ]
  }
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function findFirstPath(paths) {
  for (const p of paths) {
    if (await fileExists(p)) return p
  }
  return null
}

async function findInstalled() {
  const platform = process.platform
  const paths = TOOL_PATHS[platform] || {}

  return {
    darktable: paths.darktable ? await findFirstPath(paths.darktable) : null,
    rawtherapee: paths.rawtherapee ? await findFirstPath(paths.rawtherapee) : null
  }
}

function openFile(toolPath, filePath) {
  try {
    const child = spawn(toolPath, [filePath], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true, pid: child.pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function openFolder(toolPath, folderPath) {
  try {
    const isDarktable = path.basename(toolPath).toLowerCase().includes('darktable')
    const args = isDarktable ? ['--library', folderPath] : [folderPath]

    const child = spawn(toolPath, args, {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true, pid: child.pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function runBatchExport(toolPath, inputPaths, outputFolder, presetPath, sender) {
  return new Promise((resolve) => {
    try {
      const cliPath = toolPath.replace(/rawtherapee(\.exe)?$/i, 'rawtherapee-cli$1')
      const args = ['-o', outputFolder, '-p', presetPath, '-c', ...inputPaths]

      const child = spawn(cliPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          sender.send('tools:batchProgress', line)
        }
      })

      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          sender.send('tools:batchProgress', line)
        }
      })

      child.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })

      child.on('close', (code) => {
        resolve(code === 0
          ? { success: true }
          : { success: false, error: `Process exited with code ${code}` })
      })
    } catch (err) {
      resolve({ success: false, error: err.message })
    }
  })
}

module.exports = {
  findInstalled,
  openFile,
  openFolder,
  runBatchExport
}
