const path = require('path')
const fs = require('fs/promises')
const os = require('os')

const sessionStore = require('./sessionStore')

const JOURNAL_PATH = path.join(os.homedir(), '.frame', 'journal.md')

// Obsidian vault filenames can't contain these; collapse runs of the same
// separator afterward so "vs Oakton / Championship" becomes a clean
// "vs Oakton - Championship", not "vs Oakton -- Championship".
function sanitizeFilename(name) {
  let s = String(name).replace(/[/\\:*?"<>|]/g, '-')
  s = s.replace(/ {2,}/g, ' ').replace(/-{2,}/g, '-')
  s = s.replace(/^[-\s]+|[-\s]+$/g, '')
  return s.slice(0, 100)
}

function yamlString(v) {
  return '"' + String(v).replace(/"/g, '\\"') + '"'
}

function isoDate(ts) {
  if (!ts) return ''
  return new Date(ts).toISOString().slice(0, 10)
}

function longDateTime(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
}

function shortDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeOnly(ts) {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function statusLabel(status) {
  return { active: 'In progress', complete: 'Complete', archived: 'Archived' }[status] || status || ''
}

async function ensureExportDirs(vaultPath, subfolder) {
  const baseDir = path.join(vaultPath, subfolder)
  const sessionsDir = path.join(baseDir, 'Sessions')
  await fs.mkdir(sessionsDir, { recursive: true })
  return { baseDir, sessionsDir }
}

async function exportJournal(baseDir) {
  let content = ''
  try {
    content = await fs.readFile(JOURNAL_PATH, 'utf8')
  } catch { /* no journal yet */ }

  if (!content.startsWith('# Frame Journal')) {
    content = '# Frame Journal\n\n' + content
  }

  await fs.writeFile(path.join(baseDir, 'Journal.md'), content, 'utf8')
}

// Builds the session's own note body — real Frame data only. The group
// section headers use the actual event_groups.label (e.g. "event-1");
// Frame has no per-group opponent/description field to show something
// like "vs Oakton", unlike the illustrative example in the original spec.
function buildSessionMarkdown(session, groups, files, panoSets, burstSets) {
  const kept = files.filter(f => f.status === 'kept').length
  const deleted = files.filter(f => f.status === 'deleted').length
  const keepRate = files.length ? Math.round((kept / files.length) * 100) + '%' : '0%'
  const burstComposites = burstSets.filter(b => b.status === 'composited').length

  const frontmatter = [
    '---',
    `title: ${yamlString(session.name)}`,
    `date: ${isoDate(session.created_at)}`,
    `frame_session_id: ${session.id}`,
    `status: ${session.status}`,
    `photos: ${files.length}`,
    `kept: ${kept}`,
    `keep_rate: ${yamlString(keepRate)}`,
    `events: ${groups.length}`,
    'tags: []',
    '---',
    ''
  ].join('\n')

  const lines = [`# ${session.name}`, '']
  lines.push(session.notes ? session.notes : '')
  lines.push('', '---', '', '## Events', '')

  for (const group of groups) {
    lines.push(`### ${group.label}`)
    const start = timeOnly(group.start_ts)
    const end = timeOnly(group.end_ts)
    const dateStr = longDateTime(group.start_ts)?.split(',').slice(0, 2).join(',') || ''
    const span = start && end ? `${start} – ${end}` : ''
    const metaParts = [dateStr, span, `${group.file_count || 0} photos`].filter(Boolean)
    lines.push(`*${metaParts.join(' · ')}*`, '')
    lines.push(group.notes ? group.notes : '*(no notes)*')
    lines.push('')
  }

  lines.push('---', '', '## Stats', '')
  lines.push('| Metric | Value |')
  lines.push('|---|---|')
  lines.push(`| Total photos | ${files.length} |`)
  lines.push(`| Kept | ${kept} |`)
  lines.push(`| Deleted | ${deleted} |`)
  lines.push(`| Keep rate | ${keepRate} |`)
  lines.push(`| Panorama sets | ${panoSets.length} |`)
  lines.push(`| Burst composites | ${burstComposites} |`)
  lines.push('', '---', `*Exported from Frame on ${isoDate(Date.now())}*`, '')

  return frontmatter + lines.join('\n')
}

async function exportSessionFile(sessionId, sessionsDir) {
  const { session, groups, error } = sessionStore.sessionGet(sessionId)
  if (error || !session) throw new Error(error || `Session ${sessionId} not found`)

  const files = sessionStore.fileListBySession(sessionId)
  const panoSets = sessionStore.panoListSets(sessionId)
  const burstSets = sessionStore.burstListSets(sessionId)

  const markdown = buildSessionMarkdown(
    session, groups,
    Array.isArray(files) ? files : [],
    Array.isArray(panoSets) ? panoSets : [],
    Array.isArray(burstSets) ? burstSets : []
  )
  const filename = sanitizeFilename(session.name) + '.md'
  await fs.writeFile(path.join(sessionsDir, filename), markdown, 'utf8')
  return { session, filename }
}

function buildIndexMarkdown(sessionRows) {
  const sorted = [...sessionRows].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  const lines = [
    '# Frame Photo Library', '',
    `*Last updated: ${isoDate(Date.now())}*`, '',
    '[[Journal]]', '',
    '## Sessions', '',
    '| Session | Date | Photos | Kept | Status |',
    '|---|---|---|---|---|'
  ]
  for (const s of sorted) {
    lines.push(`| [[${sanitizeFilename(s.name)}]] | ${shortDate(s.created_at)} | ${s.fileCount || 0} | ${s.keptCount || 0} | ${statusLabel(s.status)} |`)
  }
  const pkg = require('../../package.json')
  lines.push('', '---', `*Generated by Frame · ${pkg.version}*`, '')
  return lines.join('\n')
}

async function writeIndexFile(baseDir, sessionRows) {
  const markdown = buildIndexMarkdown(sessionRows)
  await fs.writeFile(path.join(baseDir, 'Frame Index.md'), markdown, 'utf8')
}

async function exportObsidian(scope, sessionId, { vaultPath, subfolder }) {
  try {
    if (!vaultPath) return { success: false, error: 'Obsidian vault path not configured' }

    const { baseDir, sessionsDir } = await ensureExportDirs(vaultPath, subfolder)
    let filesWritten = 0

    if (scope === 'journal') {
      await exportJournal(baseDir)
      filesWritten = 1
    } else if (scope === 'session') {
      if (sessionId == null) return { success: false, error: 'sessionId is required for scope "session"' }
      await exportSessionFile(sessionId, sessionsDir)
      filesWritten = 1
    } else if (scope === 'all') {
      await exportJournal(baseDir)
      filesWritten++

      const sessions = sessionStore.sessionList()
      const rows = Array.isArray(sessions) ? sessions.filter(s => s.status !== 'archived') : []
      for (const row of rows) {
        await exportSessionFile(row.id, sessionsDir)
        filesWritten++
      }
      await writeIndexFile(baseDir, rows)
      filesWritten++
    } else {
      return { success: false, error: `Unknown export scope: ${scope}` }
    }

    return { success: true, filesWritten, vaultPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = { exportObsidian, sanitizeFilename }
