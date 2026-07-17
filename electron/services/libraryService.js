const path = require('path')
const fsSync = require('fs')
const fs = require('fs/promises')
const os = require('os')
const archiver = require('archiver')
const unzipper = require('unzipper')

const backupService = require('./backupService')
const sessionStore = require('./sessionStore')

const DB_PATH = backupService.DB_PATH
const THUMBCACHE_DIR = path.join(os.homedir(), '.frame', 'thumbcache')

// Groups distinct file paths by their first 3 path segments (e.g.
// "/Volumes/LacrosseDrive/2026" or "/Users/michael/Pictures") so the
// destination machine only has to remap a handful of roots, not every path.
function extractPhotoRoots(fullPaths) {
  const roots = new Set()
  for (const full of fullPaths) {
    const dir = path.dirname(full)
    const parts = dir.split(path.sep).filter(Boolean)
    if (parts.length === 0) continue
    const rootParts = parts.slice(0, Math.min(3, parts.length))
    const root = (full.startsWith(path.sep) ? path.sep : '') + rootParts.join(path.sep)
    roots.add(root)
  }
  return Array.from(roots).sort()
}

async function buildManifest({ includeThumbs }) {
  const pkg = require('../../package.json')
  const photoRoots = extractPhotoRoots(sessionStore.distinctFullPaths())

  let thumbCount = 0
  if (includeThumbs) {
    try {
      const files = await fs.readdir(THUMBCACHE_DIR)
      thumbCount = files.filter(f => f.endsWith('.jpg')).length
    } catch { /* no cache yet */ }
  }

  return {
    frameVersion: pkg.version,
    exportDate: new Date().toISOString(),
    hostname: os.hostname(),
    platform: process.platform,
    photoRoots,
    sessionCount: sessionStore.sessionCount(),
    fileCount: sessionStore.fileCount(),
    includedThumbs: !!includeThumbs,
    thumbCount
  }
}

async function dirSizeBytes(dir) {
  let total = 0
  try {
    const files = await fs.readdir(dir)
    for (const f of files) {
      try { total += (await fs.stat(path.join(dir, f))).size } catch { /* skip */ }
    }
  } catch { /* dir doesn't exist */ }
  return total
}

async function getExportSize(includeThumbs) {
  let dbBytes = 0
  try { dbBytes = (await fs.stat(DB_PATH)).size } catch { /* no db yet */ }
  const thumbBytes = includeThumbs ? await dirSizeBytes(THUMBCACHE_DIR) : 0
  return { dbBytes, thumbBytes, totalBytes: dbBytes + thumbBytes + 50 * 1024 }
}

async function exportLibrary({ outputPath, includeThumbs = false }, settingsObj, onProgress) {
  const check = await backupService.validateDb(DB_PATH)
  if (!check.valid) {
    return { success: false, error: 'Database integrity check failed: ' + check.errors.join(', ') }
  }

  const manifest = await buildManifest({ includeThumbs })

  return new Promise((resolve) => {
    const archive = archiver('zip', { zlib: { level: 6 } })
    const output = fsSync.createWriteStream(outputPath)

    output.on('close', async () => {
      try {
        const stat = await fs.stat(outputPath)
        resolve({ success: true, outputPath, sizeBytes: stat.size })
      } catch (e) {
        resolve({ success: false, error: e.message })
      }
    })
    archive.on('error', (err) => resolve({ success: false, error: err.message }))
    if (onProgress) {
      archive.on('progress', (p) => onProgress({ entries: p.entries.processed, bytes: p.fs.processedBytes }))
    }

    archive.pipe(output)
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
    archive.file(DB_PATH, { name: 'frame.db' })
    archive.append(JSON.stringify(settingsObj || {}, null, 2), { name: 'settings.json' })
    if (includeThumbs) archive.directory(THUMBCACHE_DIR, 'thumbcache')
    archive.finalize()
  })
}

async function getManifest(filePath) {
  try {
    const directory = await unzipper.Open.file(filePath)
    const entry = directory.files.find(f => f.path === 'manifest.json')
    if (!entry) return { success: false, error: 'manifest.json not found in archive' }
    const content = await entry.buffer()
    return { success: true, manifest: JSON.parse(content.toString('utf8')) }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function validateArchive(filePath) {
  try {
    const directory = await unzipper.Open.file(filePath)
    if (!directory.files.some(f => f.path === 'manifest.json')) {
      return { valid: false, error: 'manifest.json missing from archive' }
    }
    if (!directory.files.some(f => f.path === 'frame.db')) {
      return { valid: false, error: 'frame.db missing from archive' }
    }
    return { valid: true }
  } catch (e) {
    return { valid: false, error: 'Could not open file as a .framelib archive: ' + e.message }
  }
}

// Each set table has exactly one path-like column of its own (pano_sets has
// output_path, burst_sets has composite_path — neither has both), plus
// sessions.source_path and files.full_path/original_path.
function remapPaths(dbPath, pathMappings) {
  const Database = require('better-sqlite3')
  const db = new Database(dbPath)
  try {
    const statements = [
      'UPDATE files SET full_path = ? || SUBSTR(full_path, ?) WHERE full_path LIKE ? || \'%\'',
      'UPDATE files SET original_path = ? || SUBSTR(original_path, ?) WHERE original_path LIKE ? || \'%\'',
      'UPDATE sessions SET source_path = ? || SUBSTR(source_path, ?) WHERE source_path LIKE ? || \'%\'',
      'UPDATE pano_sets SET output_path = ? || SUBSTR(output_path, ?) WHERE output_path LIKE ? || \'%\'',
      'UPDATE burst_sets SET composite_path = ? || SUBSTR(composite_path, ?) WHERE composite_path LIKE ? || \'%\''
    ]
    for (const { oldRoot, newRoot } of pathMappings) {
      for (const sql of statements) {
        db.prepare(sql).run(newRoot, oldRoot.length + 1, oldRoot)
      }
    }
  } finally {
    db.close()
  }
}

async function importLibrary(filePath, pathMappings, onProgress) {
  const report = (step) => { if (onProgress) onProgress(step) }

  const archiveCheck = await validateArchive(filePath)
  if (!archiveCheck.valid) return { success: false, error: archiveCheck.error }

  const manifestResult = await getManifest(filePath)
  if (!manifestResult.success) return { success: false, error: manifestResult.error }
  const manifest = manifestResult.manifest

  report('backup')
  await backupService.createBackup('pre-import')

  report('extract')
  const tmpDir = path.join(os.tmpdir(), 'frame-import-' + Date.now())
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    await new Promise((resolve, reject) => {
      fsSync.createReadStream(filePath)
        .pipe(unzipper.Extract({ path: tmpDir }))
        .on('close', resolve)
        .on('error', reject)
    })

    report('validate')
    const tmpDbPath = path.join(tmpDir, 'frame.db')
    const check = await backupService.validateDb(tmpDbPath)
    if (!check.valid) {
      return { success: false, error: 'Imported database failed integrity check: ' + check.errors.join(', ') }
    }

    report('remap')
    remapPaths(tmpDbPath, pathMappings || [])

    report('copy')
    sessionStore.closeDb()
    await fs.copyFile(tmpDbPath, DB_PATH)

    let thumbsImported = 0
    const thumbSrc = path.join(tmpDir, 'thumbcache')
    const hasThumbs = await fs.access(thumbSrc).then(() => true).catch(() => false)
    if (hasThumbs) {
      await fs.mkdir(THUMBCACHE_DIR, { recursive: true })
      const thumbFiles = await fs.readdir(thumbSrc)
      for (const f of thumbFiles) {
        const dest = path.join(THUMBCACHE_DIR, f)
        const exists = await fs.access(dest).then(() => true).catch(() => false)
        if (!exists) {
          await fs.copyFile(path.join(thumbSrc, f), dest)
          thumbsImported++
        }
      }
    }

    report('settings')
    let importedSettings = null
    try {
      importedSettings = JSON.parse(await fs.readFile(path.join(tmpDir, 'settings.json'), 'utf8'))
    } catch { /* no settings.json in archive */ }

    return {
      success: true,
      sessionsImported: manifest.sessionCount || 0,
      filesImported: manifest.fileCount || 0,
      thumbsImported,
      importedSettings
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

module.exports = {
  buildManifest, getExportSize, exportLibrary,
  getManifest, importLibrary, extractPhotoRoots,
  THUMBCACHE_DIR
}
