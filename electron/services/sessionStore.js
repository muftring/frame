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

    CREATE TABLE IF NOT EXISTS smart_albums (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      scope       TEXT DEFAULT 'global',
      session_id  INTEGER,
      rules       TEXT NOT NULL,
      sort_by     TEXT DEFAULT 'exif_ts',
      sort_dir    TEXT DEFAULT 'asc',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `)
  seedDefaultAlbums()
}

function seedDefaultAlbums() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM smart_albums').get().cnt
  if (count > 0) return
  const now = Date.now()
  const ins = db.prepare(
    'INSERT INTO smart_albums (name, scope, rules, sort_by, sort_dir, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const defaults = [
    { name: 'All Keepers',      rules: [{ field: 'status',  operator: 'eq',           value: 'kept'    }] },
    { name: 'Unpublished',      rules: [{ field: 'status',  operator: 'eq',           value: 'kept'    },
                                        { field: 'published_to', operator: 'eq',       value: '[]'      }] },
    { name: '5 Stars',          rules: [{ field: 'rating',  operator: 'gte',          value: 5         }] },
    { name: 'This Week',        rules: [{ field: 'exif_ts', operator: 'in_last_days', value: 7         }] },
    { name: 'Recently Deleted', rules: [{ field: 'status',  operator: 'eq',           value: 'deleted' }] },
  ]
  for (const d of defaults) {
    ins.run(d.name, 'global', JSON.stringify(d.rules), 'exif_ts', 'asc', now, now)
  }
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

function fileGetByPath(filePath) {
  try {
    const db = getDb()
    return db.prepare(`
      SELECT f.*, s.name AS sessionName
      FROM files f
      LEFT JOIN sessions s ON s.id = f.session_id
      WHERE f.full_path = ?
      ORDER BY f.created_at DESC
      LIMIT 1
    `).get(filePath) || null
  } catch (err) {
    return { error: err.message }
  }
}

function fileSetRating(fileId, rating) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET rating = ? WHERE id = ?').run(rating, fileId)
    return { success: true }
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

// --- smart albums ---

// Whitelists prevent SQL injection when building dynamic WHERE clauses.
const ALLOWED_RULE_FIELDS = new Set([
  'status', 'rating', 'exif_ts', 'filename',
  'session_id', 'group_id', 'published_to', 'size_bytes'
])

const ALLOWED_SORT_COLS = new Set(['exif_ts', 'filename', 'rating'])

// Returns { sql, params } for a rules array (all rules ANDed together).
function buildWhereClause(rules) {
  const conditions = []
  const params = []

  for (const rule of rules) {
    if (!ALLOWED_RULE_FIELDS.has(rule.field)) continue

    const col = rule.field

    switch (rule.operator) {
      case 'eq':           conditions.push(`${col} = ?`);         params.push(rule.value); break
      case 'neq':          conditions.push(`${col} != ?`);        params.push(rule.value); break
      case 'gt':           conditions.push(`${col} > ?`);         params.push(rule.value); break
      case 'lt':           conditions.push(`${col} < ?`);         params.push(rule.value); break
      case 'gte':          conditions.push(`${col} >= ?`);        params.push(rule.value); break
      case 'lte':          conditions.push(`${col} <= ?`);        params.push(rule.value); break
      case 'contains':     conditions.push(`${col} LIKE ?`);      params.push('%' + rule.value + '%'); break
      case 'not_contains': conditions.push(`${col} NOT LIKE ?`);  params.push('%' + rule.value + '%'); break
      case 'in_last_days':
        // exif_ts is stored as Unix ms; strftime('%s','now') returns Unix seconds.
        conditions.push(`${col} >= (CAST(strftime('%s','now') AS INTEGER) - ? * 86400) * 1000`)
        params.push(rule.value)
        break
      default: break
    }
  }

  return conditions.length
    ? { sql: conditions.join(' AND '), params }
    : { sql: '1=1', params: [] }
}

// Internal helper used by albumGet and albumResolveFiles.
function _resolveFiles(album, db) {
  let rules = []
  try { rules = JSON.parse(album.rules) } catch {}

  const { sql: rulesSql, params: rulesParams } = buildWhereClause(rules)

  const scopeParts = []
  const scopeParams = []
  if (album.scope === 'session' && album.session_id) {
    scopeParts.push('session_id = ?')
    scopeParams.push(album.session_id)
  }

  const whereParts = [...scopeParts, rulesSql]
  const allParams  = [...scopeParams, ...rulesParams]

  const sortCol = ALLOWED_SORT_COLS.has(album.sort_by) ? album.sort_by : 'exif_ts'
  const sortDir = album.sort_dir === 'desc' ? 'DESC' : 'ASC'

  return db.prepare(
    `SELECT * FROM files WHERE ${whereParts.join(' AND ')} ORDER BY ${sortCol} ${sortDir}, filename ASC`
  ).all(...allParams)
}

// Returns file count without fetching rows — used in albumList.
function _countFiles(album, db) {
  let rules = []
  try { rules = JSON.parse(album.rules) } catch {}

  const { sql: rulesSql, params: rulesParams } = buildWhereClause(rules)

  const scopeParts = []
  const scopeParams = []
  if (album.scope === 'session' && album.session_id) {
    scopeParts.push('session_id = ?')
    scopeParams.push(album.session_id)
  }

  const whereParts = [...scopeParts, rulesSql]
  const allParams  = [...scopeParams, ...rulesParams]

  try {
    return db.prepare(
      `SELECT COUNT(*) AS cnt FROM files WHERE ${whereParts.join(' AND ')}`
    ).get(...allParams).cnt
  } catch {
    return 0
  }
}

function albumCreate(name, rules, scope, sessionId, sortBy, sortDir) {
  try {
    const db = getDb()
    const now = Date.now()
    const info = db.prepare(`
      INSERT INTO smart_albums (name, scope, session_id, rules, sort_by, sort_dir, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      scope    || 'global',
      sessionId || null,
      JSON.stringify(rules || []),
      sortBy   || 'exif_ts',
      sortDir  || 'asc',
      now, now
    )
    return { id: info.lastInsertRowid }
  } catch (err) {
    return { error: err.message }
  }
}

function albumList(scope, sessionId) {
  try {
    const db = getDb()
    const albums = scope === 'session' && sessionId
      ? db.prepare(
          `SELECT * FROM smart_albums WHERE scope = 'session' AND session_id = ? ORDER BY created_at ASC`
        ).all(sessionId)
      : db.prepare(
          `SELECT * FROM smart_albums WHERE scope = 'global' ORDER BY created_at ASC`
        ).all()

    return albums.map(a => ({
      id:        a.id,
      name:      a.name,
      scope:     a.scope,
      sessionId: a.session_id,
      sortBy:    a.sort_by,
      sortDir:   a.sort_dir,
      rules:     (() => { try { return JSON.parse(a.rules) } catch { return [] } })(),
      fileCount: _countFiles(a, db)
    }))
  } catch (err) {
    return { error: err.message }
  }
}

function albumGet(albumId) {
  try {
    const db = getDb()
    const album = db.prepare('SELECT * FROM smart_albums WHERE id = ?').get(albumId)
    if (!album) return { error: 'Album not found' }
    return {
      album: {
        ...album,
        rules: (() => { try { return JSON.parse(album.rules) } catch { return [] } })()
      },
      files: _resolveFiles(album, db)
    }
  } catch (err) {
    return { error: err.message }
  }
}

const ALLOWED_ALBUM_FIELDS = ['name', 'rules', 'sort_by', 'sort_dir', 'scope', 'session_id']

function albumUpdate(albumId, fields) {
  try {
    const db = getDb()
    const sets = []
    const values = []
    for (const [key, val] of Object.entries(fields)) {
      if (!ALLOWED_ALBUM_FIELDS.includes(key)) continue
      sets.push(`${key} = ?`)
      values.push(key === 'rules' ? JSON.stringify(val) : val)
    }
    if (sets.length === 0) return { success: true }
    sets.push('updated_at = ?')
    values.push(Date.now(), albumId)
    db.prepare(`UPDATE smart_albums SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function albumDelete(albumId) {
  try {
    const db = getDb()
    db.prepare('DELETE FROM smart_albums WHERE id = ?').run(albumId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function albumResolveFiles(albumId) {
  try {
    const db = getDb()
    const album = db.prepare('SELECT * FROM smart_albums WHERE id = ?').get(albumId)
    if (!album) return { error: 'Album not found' }
    return _resolveFiles(album, db)
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
  fileListBySession,
  fileGetByPath,
  fileSetRating,
  albumCreate,
  albumList,
  albumGet,
  albumUpdate,
  albumDelete,
  albumResolveFiles
}
