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

function closeDb() {
  if (db) {
    db.close()
    db = null
  }
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

    CREATE TABLE IF NOT EXISTS tag_definitions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      label       TEXT NOT NULL,
      color       TEXT NOT NULL,
      icon        TEXT,
      shortcut    TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pano_sets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      INTEGER REFERENCES sessions(id),
      name            TEXT,
      status          TEXT DEFAULT 'pending',
      frame_count     INTEGER DEFAULT 0,
      output_path     TEXT,
      hugin_project   TEXT,
      notes           TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS burst_sets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      INTEGER REFERENCES sessions(id),
      name            TEXT,
      status          TEXT DEFAULT 'pending',
      frame_count     INTEGER DEFAULT 0,
      kept_file_id    INTEGER REFERENCES files(id),
      composite_path  TEXT,
      notes           TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sequence_detection_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      INTEGER REFERENCES sessions(id),
      run_at          INTEGER NOT NULL,
      options         TEXT NOT NULL,
      pano_found      INTEGER DEFAULT 0,
      burst_found     INTEGER DEFAULT 0,
      ambiguous_found INTEGER DEFAULT 0,
      created_at      INTEGER NOT NULL
    );
  `)
  // migrations for columns added after initial release
  try { db.prepare('ALTER TABLE sessions ADD COLUMN summary TEXT').run() } catch { /* already exists */ }

  const filesCols = db.prepare('PRAGMA table_info(files)').all().map(c => c.name)
  if (!filesCols.includes('trashed_at')) {
    db.prepare('ALTER TABLE files ADD COLUMN trashed_at INTEGER DEFAULT NULL').run()
  }
  if (!filesCols.includes('tags')) {
    db.prepare("ALTER TABLE files ADD COLUMN tags TEXT DEFAULT '[]'").run()
  }
  if (!filesCols.includes('updated_at')) {
    db.prepare('ALTER TABLE files ADD COLUMN updated_at INTEGER').run()
  }
  if (!filesCols.includes('pano_set_id')) {
    db.prepare('ALTER TABLE files ADD COLUMN pano_set_id INTEGER DEFAULT NULL').run()
  }
  if (!filesCols.includes('pano_frame_order')) {
    db.prepare('ALTER TABLE files ADD COLUMN pano_frame_order INTEGER DEFAULT NULL').run()
  }
  if (!filesCols.includes('burst_set_id')) {
    db.prepare('ALTER TABLE files ADD COLUMN burst_set_id INTEGER DEFAULT NULL').run()
  }
  if (!filesCols.includes('burst_frame_order')) {
    db.prepare('ALTER TABLE files ADD COLUMN burst_frame_order INTEGER DEFAULT NULL').run()
  }

  const groupsCols = db.prepare('PRAGMA table_info(event_groups)').all().map(c => c.name)
  if (!groupsCols.includes('notes')) {
    db.prepare('ALTER TABLE event_groups ADD COLUMN notes TEXT DEFAULT NULL').run()
  }

  seedDefaultAlbums()
  seedBwCandidatesAlbum()
  seedSequenceAlbums()
  seedDefaultTags()
  seedSequenceTags()
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
    { name: 'B&W Candidates',   rules: [{ field: 'tags',    operator: 'contains',     value: 'bw-candidate' }] },
    { name: 'Panorama Candidates', rules: [{ field: 'tags', operator: 'contains',     value: 'pano-candidate' }] },
    { name: 'Burst Candidates',    rules: [{ field: 'tags', operator: 'contains',     value: 'burst-candidate' }] },
  ]
  for (const d of defaults) {
    ins.run(d.name, 'global', JSON.stringify(d.rules), 'exif_ts', 'asc', now, now)
  }
}

// Targeted (not bulk) seed so installs that already had smart_albums
// populated before this album existed still pick it up.
function seedBwCandidatesAlbum() {
  const existing = db.prepare("SELECT id FROM smart_albums WHERE name = 'B&W Candidates'").get()
  if (existing) return
  const now = Date.now()
  const rules = [{ field: 'tags', operator: 'contains', value: 'bw-candidate' }]
  db.prepare(`
    INSERT INTO smart_albums (name, scope, rules, sort_by, sort_dir, created_at, updated_at)
    VALUES (?, 'global', ?, 'exif_ts', 'asc', ?, ?)
  `).run('B&W Candidates', JSON.stringify(rules), now, now)
}

// Targeted top-up for the two Phase 11 albums, same reasoning as
// seedBwCandidatesAlbum: installs that already had smart_albums populated
// before these albums existed still need them individually inserted.
function seedSequenceAlbums() {
  const now = Date.now()
  const toSeed = [
    { name: 'Panorama Candidates', tag: 'pano-candidate' },
    { name: 'Burst Candidates',    tag: 'burst-candidate' },
  ]
  const ins = db.prepare(`
    INSERT INTO smart_albums (name, scope, rules, sort_by, sort_dir, created_at, updated_at)
    VALUES (?, 'global', ?, 'exif_ts', 'asc', ?, ?)
  `)
  for (const { name, tag } of toSeed) {
    const existing = db.prepare('SELECT id FROM smart_albums WHERE name = ?').get(name)
    if (existing) continue
    const rules = [{ field: 'tags', operator: 'contains', value: tag }]
    ins.run(name, JSON.stringify(rules), now, now)
  }
}

function seedDefaultTags() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM tag_definitions').get().cnt
  if (count > 0) return
  const now = Date.now()
  const ins = db.prepare(`
    INSERT INTO tag_definitions (name, label, color, icon, shortcut, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  ins.run('bw-candidate', 'B&W Candidate', '#888888', '½', 'b', now)
  ins.run('pano-candidate', 'Panorama', '#4a90d9', '⬡', 'n', now)
  ins.run('burst-candidate', 'Burst', '#e8943a', '⚡', 'u', now)
}

// Targeted top-up, same reasoning as seedBwCandidatesAlbum: installs that
// already had tag_definitions populated (just bw-candidate, from Phase 10)
// still need the two new Phase 11 tags inserted individually.
function seedSequenceTags() {
  const now = Date.now()
  const toSeed = [
    { name: 'pano-candidate', label: 'Panorama', color: '#4a90d9', icon: '⬡', shortcut: 'n' },
    { name: 'burst-candidate', label: 'Burst', color: '#e8943a', icon: '⚡', shortcut: 'u' },
  ]
  const ins = db.prepare(`
    INSERT INTO tag_definitions (name, label, color, icon, shortcut, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const t of toSeed) {
    const existing = db.prepare('SELECT id FROM tag_definitions WHERE name = ?').get(t.name)
    if (existing) continue
    ins.run(t.name, t.label, t.color, t.icon, t.shortcut, now)
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
      SELECT s.id, s.name, s.status, s.summary, s.notes, s.created_at, s.updated_at,
             COALESCE(p.current_stage, 'triage')    AS currentStage,
             COALESCE(p.triage_complete,  0)         AS triageComplete,
             COALESCE(p.sort_complete,    0)         AS sortComplete,
             COALESCE(p.edit_complete,    0)         AS editComplete,
             COALESCE(p.process_complete, 0)         AS processComplete,
             COALESCE(p.publish_complete, 0)         AS publishComplete,
             (SELECT COUNT(*) FROM files        WHERE session_id = s.id) AS fileCount,
             (SELECT COUNT(*) FROM event_groups WHERE session_id = s.id) AS groupCount,
             (SELECT COUNT(*) FROM files        WHERE session_id = s.id AND status = 'kept') AS keptCount
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

// Home screen library stats — simple COUNT queries, each tolerant of a
// missing/uninitialized DB (returns 0 rather than throwing, since these
// back a purely informational stats row).
function sessionCount() {
  try {
    const db = getDb()
    return db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE status IN ('active', 'complete')").get().n
  } catch {
    return 0
  }
}

function fileCount() {
  try {
    const db = getDb()
    return db.prepare('SELECT COUNT(*) AS n FROM files').get().n
  } catch {
    return 0
  }
}

function distinctFullPaths() {
  try {
    const db = getDb()
    return db.prepare('SELECT DISTINCT full_path FROM files WHERE full_path IS NOT NULL')
      .all().map(r => r.full_path)
  } catch {
    return []
  }
}

function fileCountByStatus(status) {
  try {
    const db = getDb()
    return db.prepare('SELECT COUNT(*) AS n FROM files WHERE status = ?').get(status).n
  } catch {
    return 0
  }
}

function panoCountSets() {
  try {
    const db = getDb()
    return db.prepare('SELECT COUNT(*) AS n FROM pano_sets').get().n
  } catch {
    return 0
  }
}

function burstCountComposited() {
  try {
    const db = getDb()
    return db.prepare("SELECT COUNT(*) AS n FROM burst_sets WHERE status = 'composited'").get().n
  } catch {
    return 0
  }
}

function computeSessionSummary(sessionId) {
  const db = getDb()
  const fileCount = db.prepare('SELECT COUNT(*) AS n FROM files WHERE session_id = ?').get(sessionId)?.n || 0
  const keptCount = db.prepare("SELECT COUNT(*) AS n FROM files WHERE session_id = ? AND status = 'kept'").get(sessionId)?.n || 0
  const deletedCount = db.prepare("SELECT COUNT(*) AS n FROM files WHERE session_id = ? AND status = 'deleted'").get(sessionId)?.n || 0
  const groupCount = db.prepare('SELECT COUNT(*) AS n FROM event_groups WHERE session_id = ?').get(sessionId)?.n || 0

  const publishedRows = db.prepare("SELECT published_to FROM files WHERE session_id = ? AND published_to IS NOT NULL AND published_to != '[]'").all(sessionId)
  const destinations = new Set()
  for (const row of publishedRows) {
    try { for (const d of JSON.parse(row.published_to)) destinations.add(d) } catch { /* skip */ }
  }

  const ts = db.prepare('SELECT MIN(exif_ts) AS minTs, MAX(exif_ts) AS maxTs FROM files WHERE session_id = ? AND exif_ts IS NOT NULL').get(sessionId)

  return { fileCount, keptCount, deletedCount, groupCount, destinations: [...destinations], minTs: ts?.minTs || null, maxTs: ts?.maxTs || null }
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

    if (complete && stage === 'publish') {
      const ps = db.prepare('SELECT * FROM pipeline_state WHERE session_id = ?').get(sessionId)
      if (ps?.triage_complete && ps?.sort_complete && ps?.process_complete && ps?.publish_complete) {
        const summary = computeSessionSummary(sessionId)
        db.prepare("UPDATE sessions SET status = 'complete', summary = ?, updated_at = ? WHERE id = ?")
          .run(JSON.stringify(summary), Date.now(), sessionId)
        return { success: true, allComplete: true, summary }
      }
    }

    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// --- event_groups ---

function groupCreate(sessionId, label, folderPath, fileCount, startTs, endTs, sortOrder) {
  try {
    const db = getDb()
    const info = db.prepare(`
      INSERT INTO event_groups (session_id, label, folder_path, file_count, start_ts, end_ts, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, label, folderPath, fileCount || 0, startTs || null, endTs || null, sortOrder || 0)
    return { id: info.lastInsertRowid }
  } catch (err) {
    return { error: err.message }
  }
}

function pipelineSetLastFile(sessionId, fileId) {
  try {
    const db = getDb()
    db.prepare('UPDATE pipeline_state SET last_file_id = ? WHERE session_id = ?').run(fileId, sessionId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function groupRename(groupId, newLabel) {
  try {
    const db = getDb()
    db.prepare('UPDATE event_groups SET label = ? WHERE id = ?').run(newLabel, groupId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function notesUpdateSession(sessionId, notes) {
  try {
    const db = getDb()
    db.prepare('UPDATE sessions SET notes = ?, updated_at = ? WHERE id = ?').run(notes, Date.now(), sessionId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function notesUpdateGroup(groupId, notes) {
  try {
    const db = getDb()
    db.prepare('UPDATE event_groups SET notes = ? WHERE id = ?').run(notes, groupId)
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

function fileUpdateTags(fileId, tags) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET tags = ? WHERE id = ?').run(JSON.stringify(tags), fileId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function fileUpdateTrashedPath(fileId, newPath, trashedAt) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET full_path = ?, trashed_at = ? WHERE id = ?').run(newPath, trashedAt, fileId)
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
    return db.prepare(`
      SELECT f.*, ps.name AS pano_set_name, bs.name AS burst_set_name
      FROM files f
      LEFT JOIN pano_sets ps ON ps.id = f.pano_set_id
      LEFT JOIN burst_sets bs ON bs.id = f.burst_set_id
      WHERE f.group_id = ?
      ORDER BY f.exif_ts ASC, f.filename ASC
    `).all(groupId)
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

// --- tags ---

function tagListDefinitions() {
  try {
    const db = getDb()
    return db.prepare('SELECT * FROM tag_definitions ORDER BY name ASC').all()
  } catch (err) {
    return { error: err.message }
  }
}

function tagCreateDefinition(name, label, color, icon, shortcut) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM tag_definitions WHERE name = ?').get(name)
    if (existing) return { error: `Tag "${name}" already exists` }
    const now = Date.now()
    const info = db.prepare(`
      INSERT INTO tag_definitions (name, label, color, icon, shortcut, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, label, color, icon || null, shortcut || null, now)
    return db.prepare('SELECT * FROM tag_definitions WHERE id = ?').get(info.lastInsertRowid)
  } catch (err) {
    return { error: err.message }
  }
}

function _readFileTags(db, fileId) {
  const row = db.prepare('SELECT tags FROM files WHERE id = ?').get(fileId)
  if (!row) return null
  try { return JSON.parse(row.tags || '[]') } catch { return [] }
}

function _writeFileTags(db, fileId, tags) {
  db.prepare('UPDATE files SET tags = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(tags), Date.now(), fileId)
}

function tagAddToFile(fileId, tagName) {
  try {
    const db = getDb()
    const tags = _readFileTags(db, fileId)
    if (tags === null) return { error: 'File not found' }
    if (!tags.includes(tagName)) tags.push(tagName)
    _writeFileTags(db, fileId, tags)
    return { success: true, tags }
  } catch (err) {
    return { error: err.message }
  }
}

function tagRemoveFromFile(fileId, tagName) {
  try {
    const db = getDb()
    const tags = _readFileTags(db, fileId)
    if (tags === null) return { error: 'File not found' }
    const next = tags.filter(t => t !== tagName)
    _writeFileTags(db, fileId, next)
    return { success: true, tags: next }
  } catch (err) {
    return { error: err.message }
  }
}

function tagToggleOnFile(fileId, tagName) {
  try {
    const db = getDb()
    const tags = _readFileTags(db, fileId)
    if (tags === null) return { error: 'File not found' }
    const present = tags.includes(tagName)
    const next = present ? tags.filter(t => t !== tagName) : [...tags, tagName]
    _writeFileTags(db, fileId, next)
    return { success: true, tags: next, added: !present }
  } catch (err) {
    return { error: err.message }
  }
}

function tagListByTag(tagName, sessionId) {
  try {
    const db = getDb()
    const conditions = ['EXISTS (SELECT 1 FROM json_each(f.tags) WHERE value = ?)']
    const values = [tagName]
    if (sessionId != null) {
      conditions.push('f.session_id = ?')
      values.push(sessionId)
    }
    return db.prepare(`
      SELECT f.*, g.label AS groupLabel, g.folder_path AS groupFolderPath
      FROM files f
      LEFT JOIN event_groups g ON g.id = f.group_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY f.exif_ts ASC
    `).all(...values)
  } catch (err) {
    return { error: err.message }
  }
}

function tagListByFile(fileId) {
  try {
    const db = getDb()
    const tags = _readFileTags(db, fileId)
    return tags || []
  } catch (err) {
    return { error: err.message }
  }
}

// --- sequence detection runs ---

function sequenceDetectionRunCreate(sessionId, options, panoFound, burstFound, ambiguousFound) {
  try {
    const db = getDb()
    const now = Date.now()
    const info = db.prepare(`
      INSERT INTO sequence_detection_runs
        (session_id, run_at, options, pano_found, burst_found, ambiguous_found, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, now, JSON.stringify(options), panoFound || 0, burstFound || 0, ambiguousFound || 0, now)
    return db.prepare('SELECT * FROM sequence_detection_runs WHERE id = ?').get(info.lastInsertRowid)
  } catch (err) {
    return { error: err.message }
  }
}

function sequenceDetectionRunList(sessionId) {
  try {
    const db = getDb()
    return db.prepare(`
      SELECT * FROM sequence_detection_runs WHERE session_id = ? ORDER BY run_at DESC LIMIT 10
    `).all(sessionId)
  } catch (err) {
    return { error: err.message }
  }
}

// --- pano sets ---

function panoConfirmSet(sessionId, fileIds, name) {
  try {
    const db = getDb()
    const now = Date.now()
    const info = db.prepare(`
      INSERT INTO pano_sets (session_id, name, status, frame_count, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `).run(sessionId, name || null, fileIds.length, now, now)
    const panoSetId = info.lastInsertRowid

    const setFrame = db.prepare('UPDATE files SET pano_set_id = ?, pano_frame_order = ? WHERE id = ?')
    fileIds.forEach((fileId, i) => setFrame.run(panoSetId, i, fileId))

    return db.prepare('SELECT * FROM pano_sets WHERE id = ?').get(panoSetId)
  } catch (err) {
    return { error: err.message }
  }
}

const ALLOWED_PANO_FIELDS = ['name', 'status', 'output_path', 'hugin_project', 'notes']

function panoUpdateSet(panoSetId, fields) {
  try {
    const db = getDb()
    const sets = []
    const values = []
    for (const [key, val] of Object.entries(fields)) {
      if (!ALLOWED_PANO_FIELDS.includes(key)) continue
      sets.push(`${key} = ?`)
      values.push(val)
    }
    if (sets.length === 0) return { success: true }
    sets.push('updated_at = ?')
    values.push(Date.now(), panoSetId)
    db.prepare(`UPDATE pano_sets SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function panoDeleteSet(panoSetId) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET pano_set_id = NULL, pano_frame_order = NULL WHERE pano_set_id = ?').run(panoSetId)
    db.prepare('DELETE FROM pano_sets WHERE id = ?').run(panoSetId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function panoListSets(sessionId) {
  try {
    const db = getDb()
    return db.prepare('SELECT * FROM pano_sets WHERE session_id = ? ORDER BY created_at ASC').all(sessionId)
  } catch (err) {
    return { error: err.message }
  }
}

// Member files for a pano set, in frame order — needed by the Gallery pano
// set detail view (frame strip, reorder, add/remove) but not covered by
// panoListSets, which only returns set-level metadata.
function panoListFiles(panoSetId) {
  try {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM files WHERE pano_set_id = ? ORDER BY pano_frame_order ASC'
    ).all(panoSetId)
  } catch (err) {
    return { error: err.message }
  }
}

function _refreshPanoFrameCount(db, panoSetId) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM files WHERE pano_set_id = ?').get(panoSetId).n
  db.prepare('UPDATE pano_sets SET frame_count = ?, updated_at = ? WHERE id = ?').run(count, Date.now(), panoSetId)
}

function panoAddFile(panoSetId, fileId) {
  try {
    const db = getDb()
    const maxOrder = db.prepare('SELECT MAX(pano_frame_order) AS m FROM files WHERE pano_set_id = ?').get(panoSetId)?.m
    const nextOrder = maxOrder == null ? 0 : maxOrder + 1
    db.prepare('UPDATE files SET pano_set_id = ?, pano_frame_order = ? WHERE id = ?').run(panoSetId, nextOrder, fileId)
    _refreshPanoFrameCount(db, panoSetId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function panoRemoveFile(panoSetId, fileId) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET pano_set_id = NULL, pano_frame_order = NULL WHERE id = ? AND pano_set_id = ?').run(fileId, panoSetId)
    _refreshPanoFrameCount(db, panoSetId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function panoReorderFrames(panoSetId, orderedFileIds) {
  try {
    const db = getDb()
    const setOrder = db.prepare('UPDATE files SET pano_frame_order = ? WHERE id = ? AND pano_set_id = ?')
    orderedFileIds.forEach((fileId, i) => setOrder.run(i, fileId, panoSetId))
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// --- burst sets ---

function burstConfirmSet(sessionId, fileIds, name) {
  try {
    const db = getDb()
    const now = Date.now()
    const info = db.prepare(`
      INSERT INTO burst_sets (session_id, name, status, frame_count, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `).run(sessionId, name || null, fileIds.length, now, now)
    const burstSetId = info.lastInsertRowid

    const setFrame = db.prepare('UPDATE files SET burst_set_id = ?, burst_frame_order = ? WHERE id = ?')
    fileIds.forEach((fileId, i) => setFrame.run(burstSetId, i, fileId))

    return db.prepare('SELECT * FROM burst_sets WHERE id = ?').get(burstSetId)
  } catch (err) {
    return { error: err.message }
  }
}

const ALLOWED_BURST_FIELDS = ['name', 'status', 'kept_file_id', 'composite_path', 'notes']

function burstUpdateSet(burstSetId, fields) {
  try {
    const db = getDb()
    const sets = []
    const values = []
    for (const [key, val] of Object.entries(fields)) {
      if (!ALLOWED_BURST_FIELDS.includes(key)) continue
      sets.push(`${key} = ?`)
      values.push(val)
    }
    if (sets.length === 0) return { success: true }
    sets.push('updated_at = ?')
    values.push(Date.now(), burstSetId)
    db.prepare(`UPDATE burst_sets SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function burstDeleteSet(burstSetId) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET burst_set_id = NULL, burst_frame_order = NULL WHERE burst_set_id = ?').run(burstSetId)
    db.prepare('DELETE FROM burst_sets WHERE id = ?').run(burstSetId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function burstListSets(sessionId) {
  try {
    const db = getDb()
    return db.prepare('SELECT * FROM burst_sets WHERE session_id = ? ORDER BY created_at ASC').all(sessionId)
  } catch (err) {
    return { error: err.message }
  }
}

// Member files for a burst set, in frame order — needed by the Sorter
// burst compare view and the Gallery burst set detail view, neither of
// which is covered by burstListSets (set-level metadata only).
function burstListFiles(burstSetId) {
  try {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM files WHERE burst_set_id = ? ORDER BY burst_frame_order ASC'
    ).all(burstSetId)
  } catch (err) {
    return { error: err.message }
  }
}

function _refreshBurstFrameCount(db, burstSetId) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM files WHERE burst_set_id = ?').get(burstSetId).n
  db.prepare('UPDATE burst_sets SET frame_count = ?, updated_at = ? WHERE id = ?').run(count, Date.now(), burstSetId)
}

function burstAddFile(burstSetId, fileId) {
  try {
    const db = getDb()
    const maxOrder = db.prepare('SELECT MAX(burst_frame_order) AS m FROM files WHERE burst_set_id = ?').get(burstSetId)?.m
    const nextOrder = maxOrder == null ? 0 : maxOrder + 1
    db.prepare('UPDATE files SET burst_set_id = ?, burst_frame_order = ? WHERE id = ?').run(burstSetId, nextOrder, fileId)
    _refreshBurstFrameCount(db, burstSetId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function burstRemoveFile(burstSetId, fileId) {
  try {
    const db = getDb()
    db.prepare('UPDATE files SET burst_set_id = NULL, burst_frame_order = NULL WHERE id = ? AND burst_set_id = ?').run(fileId, burstSetId)
    _refreshBurstFrameCount(db, burstSetId)
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

function burstReorderFrames(burstSetId, orderedFileIds) {
  try {
    const db = getDb()
    const setOrder = db.prepare('UPDATE files SET burst_frame_order = ? WHERE id = ? AND burst_set_id = ?')
    orderedFileIds.forEach((fileId, i) => setOrder.run(i, fileId, burstSetId))
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// Sets the keeper for a burst: the chosen file is marked 'kept', every other
// member is marked 'deleted' (soft delete — DB status only, matching the
// existing Option A soft-delete behavior from session-mode Sorter; files
// stay on disk until an explicit cleanup step), and the set itself is
// marked 'reviewed'.
function burstSetKeeper(burstSetId, fileId) {
  try {
    const db = getDb()
    const members = db.prepare('SELECT id FROM files WHERE burst_set_id = ?').all(burstSetId)

    for (const m of members) {
      fileUpdateStatus(m.id, m.id === fileId ? 'kept' : 'deleted')
    }

    db.prepare('UPDATE burst_sets SET kept_file_id = ? WHERE id = ?').run(fileId, burstSetId)
    burstUpdateSet(burstSetId, { status: 'reviewed' })

    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// --- smart albums ---

// Whitelists prevent SQL injection when building dynamic WHERE clauses.
const ALLOWED_RULE_FIELDS = new Set([
  'status', 'rating', 'exif_ts', 'filename',
  'session_id', 'group_id', 'published_to', 'size_bytes', 'tags'
])

const ALLOWED_SORT_COLS = new Set(['exif_ts', 'filename', 'rating'])

// Fields that store a JSON array (e.g. '["bw-candidate","hero-shot"]') rather
// than plain text. "contains"/"not_contains" on these fields match a whole
// array element, not an arbitrary substring — otherwise a search for tag
// "bw" would false-positive on "bw-candidate".
const JSON_ARRAY_FIELDS = new Set(['tags', 'published_to'])

// Returns { sql, params } for a rules array (all rules ANDed together).
function buildWhereClause(rules) {
  const conditions = []
  const params = []

  for (const rule of rules) {
    if (!ALLOWED_RULE_FIELDS.has(rule.field)) continue

    const col = rule.field
    const isJsonArray = JSON_ARRAY_FIELDS.has(col)

    switch (rule.operator) {
      case 'eq':           conditions.push(`${col} = ?`);         params.push(rule.value); break
      case 'neq':          conditions.push(`${col} != ?`);        params.push(rule.value); break
      case 'gt':           conditions.push(`${col} > ?`);         params.push(rule.value); break
      case 'lt':           conditions.push(`${col} < ?`);         params.push(rule.value); break
      case 'gte':          conditions.push(`${col} >= ?`);        params.push(rule.value); break
      case 'lte':          conditions.push(`${col} <= ?`);        params.push(rule.value); break
      case 'contains':
        conditions.push(`${col} LIKE ?`)
        params.push(isJsonArray ? '%"' + rule.value + '"%' : '%' + rule.value + '%')
        break
      case 'not_contains':
        if (isJsonArray) {
          conditions.push(`(${col} NOT LIKE ? OR ${col} IS NULL OR ${col} = '[]')`)
          params.push('%"' + rule.value + '"%')
        } else {
          conditions.push(`${col} NOT LIKE ?`)
          params.push('%' + rule.value + '%')
        }
        break
      case 'in_last_days':
        // exif_ts is stored as Unix ms; strftime('%s','now') returns Unix seconds.
        conditions.push(`${col} >= (CAST(strftime('%s','now') AS INTEGER) - ? * 86400) * 1000`)
        params.push(rule.value)
        break
      case 'has_tag':
        conditions.push(`EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)`)
        params.push(String(rule.value))
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

function albumPreview(rules, scope, sessionId) {
  try {
    const db = getDb()
    const fakeAlbum = {
      rules: JSON.stringify(rules || []),
      scope: scope || 'global',
      session_id: sessionId || null,
      sort_by: 'exif_ts',
      sort_dir: 'asc'
    }
    return { count: _countFiles(fakeAlbum, db) }
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
  sessionCount,
  fileCount,
  distinctFullPaths,
  closeDb,
  fileCountByStatus,
  panoCountSets,
  burstCountComposited,
  groupCreate,
  pipelineSetLastFile,
  groupRename,
  groupList,
  notesUpdateSession,
  notesUpdateGroup,
  fileUpsert,
  fileUpdateStatus,
  fileUpdateTags,
  fileUpdateTrashedPath,
  fileUpdatePublished,
  fileListByGroup,
  fileListBySession,
  fileGetByPath,
  fileSetRating,
  tagListDefinitions,
  tagCreateDefinition,
  tagAddToFile,
  tagRemoveFromFile,
  tagToggleOnFile,
  tagListByTag,
  tagListByFile,
  sequenceDetectionRunCreate,
  sequenceDetectionRunList,
  panoConfirmSet,
  panoUpdateSet,
  panoDeleteSet,
  panoListSets,
  panoListFiles,
  panoAddFile,
  panoRemoveFile,
  panoReorderFrames,
  burstConfirmSet,
  burstUpdateSet,
  burstDeleteSet,
  burstListSets,
  burstListFiles,
  burstAddFile,
  burstRemoveFile,
  burstReorderFrames,
  burstSetKeeper,
  albumCreate,
  albumList,
  albumGet,
  albumUpdate,
  albumDelete,
  albumPreview,
  albumResolveFiles
}
