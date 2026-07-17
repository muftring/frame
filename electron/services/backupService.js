const path = require('path')
const fs = require('fs/promises')
const os = require('os')

const DB_PATH = path.join(os.homedir(), '.frame', 'frame.db')
const BACKUPS_DIR = path.join(os.homedir(), '.frame', 'backups')

async function ensureBackupsDir() {
  await fs.mkdir(BACKUPS_DIR, { recursive: true })
}

async function createBackup(label = null) {
  await ensureBackupsDir()

  const dbExists = await fs.access(DB_PATH).then(() => true).catch(() => false)
  if (!dbExists) return null

  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5).replace(':', '')

  const filename = label
    ? `frame-${label}-${date}-${time}.db`
    : `frame-${date}-${time}.db`

  const dest = path.join(BACKUPS_DIR, filename)
  await fs.copyFile(DB_PATH, dest)
  const stat = await fs.stat(dest)
  return { filename, path: dest, sizeBytes: stat.size, createdAt: now.toISOString() }
}

async function listBackups() {
  await ensureBackupsDir()
  const files = await fs.readdir(BACKUPS_DIR)
  const backups = []
  for (const f of files) {
    if (!f.endsWith('.db')) continue
    const fp = path.join(BACKUPS_DIR, f)
    const stat = await fs.stat(fp)
    backups.push({
      filename: f,
      path: fp,
      sizeBytes: stat.size,
      createdAt: stat.birthtime.toISOString()
    })
  }
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

async function pruneBackups(keepCount = 7) {
  const all = await listBackups()
  const regular = all.filter(b => /^frame-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(b.filename))
  const toDelete = regular.slice(keepCount)
  for (const b of toDelete) {
    await fs.unlink(b.path).catch(() => {})
  }
}

async function restoreBackup(backupPath) {
  await createBackup('pre-restore')
  await fs.copyFile(backupPath, DB_PATH)
}

async function validateDb(dbPath) {
  const Database = require('better-sqlite3')
  try {
    const db = new Database(dbPath, { readonly: true })
    const result = db.pragma('integrity_check')
    db.close()
    const valid = result.length === 1 && result[0].integrity_check === 'ok'
    return { valid, errors: valid ? [] : result.map(r => r.integrity_check) }
  } catch (e) {
    return { valid: false, errors: [e.message] }
  }
}

module.exports = {
  createBackup, listBackups, pruneBackups,
  restoreBackup, validateDb,
  DB_PATH, BACKUPS_DIR
}
