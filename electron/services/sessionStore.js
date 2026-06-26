const path = require('path')
const fs = require('fs')
const os = require('os')
const Database = require('better-sqlite3')

const DB_PATH = path.join(os.homedir(), '.frame', 'frame.db')

let db = null

function getDb() {
  if (db) return db
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema()
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      status      TEXT DEFAULT 'active',
      source_path TEXT,
      notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS event_groups (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   INTEGER REFERENCES sessions(id),
      label        TEXT NOT NULL,
      folder_path  TEXT NOT NULL,
      file_count   INTEGER,
      start_ts     INTEGER,
      end_ts       INTEGER,
      sort_order   INTEGER
    );

    CREATE TABLE IF NOT EXISTS files (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id        INTEGER REFERENCES event_groups(id),
      session_id      INTEGER REFERENCES sessions(id),
      filename        TEXT NOT NULL,
      full_path       TEXT NOT NULL,
      original_path   TEXT,
      size_bytes      INTEGER,
      exif_ts         INTEGER,
      status          TEXT DEFAULT 'unreviewed',
      edit_history    TEXT DEFAULT '[]',
      published_to    TEXT DEFAULT '[]',
      rating          INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipeline_state (
      session_id        INTEGER PRIMARY KEY REFERENCES sessions(id),
      current_stage     TEXT DEFAULT 'triage',
      triage_complete   INTEGER DEFAULT 0,
      sort_complete     INTEGER DEFAULT 0,
      edit_complete     INTEGER DEFAULT 0,
      process_complete  INTEGER DEFAULT 0,
      publish_complete  INTEGER DEFAULT 0,
      last_file_id      INTEGER
    );
  `)
}

// --- sessions ---

function sessionCreate(name, sourcePath) {
  try {
    const db = getDb()
    const now = Date.now()
    const info = db.prepare(
      'INSERT INTO sessions (name, created_at, updated_at, source_path) VALUES (?, ?, ?, ?)'
    ).run(name, now, now, sourcePath || null)
    const id = info.lastInsertRowid
    db.prepare(
      'INSERT INTO pipeline_state (session_id) VALUES (?)'
    ).run(id)
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  } catch (err) {
    return { error: err.message }
  }
}

function sessionList() {
  try {
    const db = getDb()
    return db.prepare(`
      SELECT s.id, s.name, s.status, s.created_at, s.updated_at,
             COALESCE(p.current_stage, 'triage')    AS currentStage,
             COALESCE(p.triage_complete,  0)         AS triageComplete,
             COALESCE(p.sort_complete,    0)         AS sortComplete,
             COALESCE(p.edit_complete,    0)         AS editComplete,
             COALESCE(p.process_complete, 0)         AS processComplete,
             COALESCE(p.publish_complete, 0)         AS publishComplete,
             (SELECT COUNT(*) FROM files        WHERE session_id = s.id) AS fileCount,
             (SELECT COUNT(*) FROM event_groups WHERE session_id = s.id) AS groupCount
      FROM sessions s
      LEFT JOIN pipeline_state p ON p.session_id = s.id
      ORDER BY s.updated_at DESC
    `).all()
  } catch (err) {
    return { error: err.message }
  }
}

function sessionGet(sessionId) {
  try {
    const db = getDb()
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
    if (!session) return { error: 'Session not found' }
    const groups = db.prepare(
      'SELECT * FROM event_groups WHERE session_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(sessionId)
    const pipelineState = db.prepare(
      'SELECT * FROM pipeline_state WHERE session_id = ?'
    ).get(sessionId)
    return { session, groups, pipelineState }
  } catch (err) {
    return { error: err.message }
  }
}

const ALLOWED_SESSION_FIELDS = ['name', 'status', 'source_path', 'notes']

function sessionUpdate(sessionId, fields) {
  try {
    const db = getDb()
    const sets = []
    const values = []
    for (const [key, val] of Object.entries(fields)) {
      if (ALLOWED_SESSION_FIELDS.includes(key)) {
        sets.push(`${key} = ?`)
        values.push(val)
      }
    }
    if (sets.length === 0) return { success: true }
    sets.push('updated_at = ?')
    values.push(Date.now())
    values.push(sessionId)
    db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function sessionArchive(sessionId) {
  try {
    const db = getDb()
    db.prepare(
      'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?'
    ).run('archived', Date.now(), sessionId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

const PIPELINE_COLS = {
  triage: 'triage_complete',
  sort: 'sort_complete',
  edit: 'edit_complete',
  process: 'process_complete',
  publish: 'publish_complete'
}

function sessionUpdatePipeline(sessionId, stage, complete) {
  try {
    const db = getDb()
    const col = PIPELINE_COLS[stage]
    if (!col) return { error: `Unknown stage: ${stage}` }
    db.prepare(
      `UPDATE pipeline_state SET ${col} = ?, current_stage = ? WHERE session_id = ?`
    ).run(complete ? 1 : 0, stage, sessionId)
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// --- event_groups ---

function groupRename(groupId, newLabel) {
  try {
    const db = getDb()
    db.prepare('UPDATE event_groups SET label = ? WHERE id = ?').run(newLabel, groupId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function groupList(sessionId) {
  try {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM event_groups WHERE session_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(sessionId)
  } catch (err) {
    return { error: err.message }
  }
}

// --- files ---

function fileUpsert(sessionId, groupId, fileData) {
  try {
    const db = getDb()
    const now = Date.now()
    const existing = db.prepare(
      'SELECT id FROM files WHERE full_path = ? AND session_id = ?'
    ).get(fileData.full_path, sessionId)
    if (existing) {
      db.prepare(`
        UPDATE files SET
          group_id = ?, filename = ?, original_path = ?, size_bytes = ?,
          exif_ts = ?, status = COALESCE(?, status),
          edit_history = COALESCE(?, edit_history),
          published_to = COALESCE(?, published_to),
          rating = COALESCE(?, rating)
        WHERE id = ?
      `).run(
        groupId,
        fileData.filename || null,
        fileData.original_path || null,
        fileData.size_bytes || null,
        fileData.exif_ts || null,
        fileData.status || null,
        fileData.edit_history || null,
        fileData.published_to || null,
        fileData.rating != null ? fileData.rating : null,
        existing.id
      )
      return { id: existing.id }
    } else {
      const info = db.prepare(`
        INSERT INTO files
          (session_id, group_id, filename, full_path, original_path,
           size_bytes, exif_ts, status, edit_history, published_to, rating, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        groupId,
        fileData.filename || null,
        fileData.full_path,
        fileData.original_path || null,
        fileData.size_bytes || null,
        fileData.exif_ts || null,
        fileData.status || 'unreviewed',
        fileData.edit_history || '[]',
        fileData.published_to || '[]',
        fileData.rating != null ? fileData.rating : 0,
        now
      )
      return { id: info.lastInsertRowid }
    }
  } catch (err) {
    return { error: err.message }
  }
}

function fileUpdateStatus(fileId, status) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET status = ? WHERE id = ?').run(status, fileId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function fileUpdatePublished(fileId, destinations) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET published_to = ? WHERE id = ?')
      .run(JSON.stringify(destinations), fileId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function fileListByGroup(groupId) {
  try {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM files WHERE group_id = ? ORDER BY exif_ts ASC, filename ASC'
    ).all(groupId)
  } catch (err) {
    return { error: err.message }
  }
}

function fileListBySession(sessionId, filters = {}) {
  try {
    const db = getDb()
    const conditions = ['session_id = ?']
    const values = [sessionId]
    if (filters.status) {
      conditions.push('status = ?')
      values.push(filters.status)
    }
    if (filters.rating != null) {
      conditions.push('rating = ?')
      values.push(filters.rating)
    }
    return db.prepare(
      `SELECT * FROM files WHERE ${conditions.join(' AND ')} ORDER BY exif_ts ASC, filename ASC`
    ).all(...values)
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = {
  sessionCreate,
  sessionList,
  sessionGet,
  sessionUpdate,
  sessionArchive,
  sessionUpdatePipeline,
  groupRename,
  groupList,
  fileUpsert,
  fileUpdateStatus,
  fileUpdatePublished,
  fileListByGroup,
  fileListBySession
}
