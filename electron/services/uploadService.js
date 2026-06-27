const { spawn, execFile } = require('child_process')
const fs = require('fs/promises')
const path = require('path')

const PROVIDERS = {
  archivault: {
    name: 'ArchiVault',
    description: 'Upload to AWS S3 with integrity tracking',
    configPath: () => path.join(require('os').homedir(), '.archivault', 'config.json'),
    fields: [
      { key: 'cliPath', label: 'CLI path', type: 'executable', default: 'archivault' },
      { key: 'tag', label: 'Tag', type: 'text', default: '' },
      { key: 'uploadedBy', label: 'Uploaded by', type: 'text', default: '' }
    ]
  },
  icloud: {
    name: 'iCloud Photos',
    description: 'Import into Photos.app (syncs to iCloud)',
    platform: 'darwin',
    fields: [
      { key: 'albumName', label: 'Album name', type: 'text', default: '' }
    ]
  }
}

async function getProviders() {
  const result = {}
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    if (provider.platform && process.platform !== provider.platform) continue

    const info = {
      id,
      name: provider.name,
      description: provider.description,
      available: true,
      configured: false
    }

    if (id === 'archivault') {
      try {
        await fs.access(provider.configPath())
        info.configured = true
      } catch {
        info.configured = false
      }
    }

    if (id === 'icloud') {
      info.configured = process.platform === 'darwin'
    }

    result[id] = info
  }
  return result
}

function uploadArchivault(files, options, sender) {
  return new Promise((resolve) => {
    const cliPath = options.cliPath || 'archivault'
    const args = ['upload']

    if (files.length === 1) {
      args.push(files[0])
    } else {
      const dir = path.dirname(files[0])
      args.push(dir, '--recursive')
    }

    if (options.tag) {
      args.push('--tag', options.tag)
    }
    if (options.uploadedBy) {
      args.push('--uploaded-by', options.uploadedBy)
    }

    const child = spawn(cliPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    })

    let fileCount = 0

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        sender.send('upload:progress', { provider: 'archivault', line })
        if (line.includes('upload') || line.includes('Upload')) fileCount++
      }
    })

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        sender.send('upload:progress', { provider: 'archivault', line })
      }
    })

    child.on('error', (err) => {
      resolve({ success: false, error: err.message, uploaded: 0 })
    })

    child.on('close', (code) => {
      resolve(code === 0
        ? { success: true, uploaded: fileCount }
        : { success: false, error: `Process exited with code ${code}`, uploaded: fileCount })
    })
  })
}

function escapeAppleScript(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildImportScript(filePath, albumName, tags) {
  const ep = escapeAppleScript(filePath)
  const hasTags = Array.isArray(tags) && tags.length > 0
  const kwList = hasTags
    ? tags.map(t => `"${escapeAppleScript(t)}"`).join(', ')
    : null

  if (albumName && hasTags) {
    const ea = escapeAppleScript(albumName)
    return [
      'tell application "Photos"',
      `  set theItems to import {POSIX file "${ep}"} into album named "${ea}" skip check duplicates no`,
      '  if (count of theItems) > 0 then',
      `    set keywords of item 1 of theItems to {${kwList}}`,
      '  end if',
      'end tell'
    ].join('\n')
  }

  if (albumName) {
    const ea = escapeAppleScript(albumName)
    return `tell application "Photos" to import {POSIX file "${ep}"} into album named "${ea}" skip check duplicates no`
  }

  if (hasTags) {
    return [
      'tell application "Photos"',
      `  set theItems to import {POSIX file "${ep}"}`,
      '  if (count of theItems) > 0 then',
      `    set keywords of item 1 of theItems to {${kwList}}`,
      '  end if',
      'end tell'
    ].join('\n')
  }

  return `tell application "Photos" to import {POSIX file "${ep}"}`
}

async function uploadIcloud(files, options, sender) {
  let uploaded = 0
  const errors = []
  const albumName = options.albumName?.trim() || null
  const fileTags = options.fileTags || {}

  // Create album once before the loop if needed
  if (albumName) {
    const ea = escapeAppleScript(albumName)
    const createScript = [
      'tell application "Photos"',
      `  if not (exists album named "${ea}") then`,
      `    make new album with properties {name:"${ea}"}`,
      '  end if',
      'end tell'
    ].join('\n')
    try {
      await new Promise((res, rej) => {
        execFile('osascript', ['-e', createScript], { timeout: 10000 }, (err) => {
          err ? rej(err) : res()
        })
      })
    } catch (err) {
      // Non-fatal: continue without album guarantee
      sender.send('upload:progress', {
        provider: 'icloud',
        line: `Warning: could not create album "${albumName}" — ${err.message}`
      })
    }
  }

  for (const filePath of files) {
    const tags = fileTags[filePath] || []
    const script = buildImportScript(filePath, albumName, tags)

    try {
      await new Promise((res, rej) => {
        execFile('osascript', ['-e', script], { timeout: 30000 }, (err) => {
          err ? rej(err) : res()
        })
      })
      uploaded++
      sender.send('upload:progress', {
        provider: 'icloud',
        line: `Imported: ${path.basename(filePath)}`,
        current: uploaded,
        total: files.length
      })
    } catch (err) {
      errors.push(`${path.basename(filePath)}: ${err.message}`)
      sender.send('upload:progress', {
        provider: 'icloud',
        line: `Failed: ${path.basename(filePath)} — ${err.message}`,
        current: uploaded,
        total: files.length
      })
    }
  }

  return {
    success: errors.length === 0,
    uploaded,
    errors: errors.length ? errors : undefined
  }
}

async function upload(providerId, files, options, sender) {
  switch (providerId) {
    case 'archivault':
      return uploadArchivault(files, options, sender)
    case 'icloud':
      return uploadIcloud(files, options, sender)
    default:
      return { success: false, error: `Unknown provider: ${providerId}` }
  }
}

module.exports = {
  getProviders,
  upload
}
