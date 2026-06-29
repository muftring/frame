<template>
  <div class="home">

    <!-- Left: New Session -->
    <aside class="home-sidebar">
      <div class="sidebar-label">New Session</div>
      <div class="ns-form">
        <input
          v-model="newName"
          class="ns-name-input"
          placeholder="Session name"
          @keydown.enter="startImport"
        />
        <div class="ns-source-block">
          <button class="btn-secondary ns-pick-btn" @click="pickSource">Pick source folder</button>
          <span class="ns-source-path" :class="{ 'ns-no-source': !newSource }">
            {{ newSource || 'No folder selected' }}
          </span>
        </div>
        <button
          class="btn-primary ns-start-btn"
          :disabled="!newName.trim() || starting"
          @click="startImport"
        >
          {{ starting ? 'Creating…' : 'Start import →' }}
        </button>
      </div>
    </aside>

    <!-- Right: Sessions -->
    <section class="home-sessions">

      <div v-if="loading" class="home-loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="sessions.length === 0" class="home-empty">
          No sessions yet — import photos to get started
        </div>

        <!-- Completed sessions -->
        <template v-if="completedSessions.length">
          <h2 class="home-section-title">Completed</h2>
          <div class="session-list" style="margin-bottom: 28px">
            <div v-for="s in completedSessions" :key="s.id" class="session-card session-card-complete">
              <div class="sc-top">
                <span class="sc-name sc-name-static">{{ s.name }}</span>
                <div class="sc-badges">
                  <span class="badge-complete">Complete</span>
                  <span v-if="s.summaryData" class="badge-keeprate">
                    {{ keepRate(s.summaryData) }} kept
                  </span>
                </div>
              </div>
              <div class="sc-meta">
                {{ fmtDate(s.created_at) }}
                <span v-if="s.summaryData" class="meta-dot">·</span>
                <span v-if="s.summaryData">{{ s.summaryData.keptCount }} / {{ s.summaryData.fileCount }} photos</span>
                <span v-if="s.summaryData?.destinations?.length" class="meta-dot">·</span>
                <span v-if="s.summaryData?.destinations?.length">{{ s.summaryData.destinations.join(', ') }}</span>
              </div>
              <div class="sc-actions sc-actions-complete">
                <button class="btn-resume" @click="doViewGallery(s)">View in Gallery →</button>
                <button class="btn-archive-sm" @click="doArchive(s)">Archive</button>
              </div>
            </div>
          </div>
        </template>

        <h2 class="home-section-title">Recent Sessions</h2>

        <div v-if="activeSessions.length" class="session-list">
          <div v-for="s in activeSessions" :key="s.id" class="session-card">
            <div class="sc-top">
              <div class="sc-name-wrap">
                <input
                  v-if="editingId === s.id"
                  ref="editInput"
                  v-model="editingName"
                  class="sc-name-input"
                  @keydown.enter="saveName(s)"
                  @keydown.esc="cancelEdit"
                  @blur="saveName(s)"
                />
                <span v-else class="sc-name" title="Click to rename" @click="startEdit(s)">
                  {{ s.name }}
                </span>
              </div>
              <div class="sc-badges">
                <span class="badge-active">In Progress</span>
                <button class="btn-archive-sm" @click="doArchive(s)">Archive</button>
              </div>
            </div>

            <div class="sc-meta">
              Created {{ fmtDate(s.created_at) }}
              <span class="meta-dot">·</span>
              {{ s.fileCount }} {{ s.fileCount === 1 ? 'file' : 'files' }}
              <span class="meta-dot">·</span>
              {{ s.groupCount }} {{ s.groupCount === 1 ? 'group' : 'groups' }}
            </div>

            <div class="sc-pipeline">
              <div
                v-for="stage in STAGES"
                :key="stage.id"
                class="sc-seg"
                :class="{ done: !!s[stage.doneKey] }"
              >
                <div class="sc-seg-bar"></div>
                <span class="sc-seg-label">{{ stage.label }}</span>
              </div>
            </div>

            <div class="sc-actions">
              <button class="btn-resume" @click="doResume(s)">Resume →</button>
            </div>
          </div>
        </div>

        <!-- Archived toggle -->
        <div v-if="archivedSessions.length > 0" class="archived-toggle-wrap">
          <button class="archived-toggle" @click="showArchived = !showArchived">
            {{ showArchived ? 'Hide' : 'Show' }} archived ({{ archivedSessions.length }})
          </button>
          <div v-if="showArchived" class="session-list archived-list">
            <div v-for="s in archivedSessions" :key="s.id" class="session-card session-card-archived">
              <div class="sc-top">
                <span class="sc-name sc-name-static">{{ s.name }}</span>
                <span class="badge-archived">Archived</span>
              </div>
              <div class="sc-meta">
                Created {{ fmtDate(s.created_at) }}
                <span class="meta-dot">·</span>
                {{ s.fileCount }} {{ s.fileCount === 1 ? 'file' : 'files' }}
              </div>
              <div class="sc-pipeline">
                <div
                  v-for="stage in STAGES"
                  :key="stage.id"
                  class="sc-seg"
                  :class="{ done: !!s[stage.doneKey] }"
                >
                  <div class="sc-seg-bar"></div>
                  <span class="sc-seg-label">{{ stage.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>


  </div>
</template>

<script>
const STAGES = [
  { id: 'triage',  label: 'Triage',  doneKey: 'triageComplete' },
  { id: 'sort',    label: 'Sort',    doneKey: 'sortComplete' },
  { id: 'edit',    label: 'Edit',    doneKey: 'editComplete' },
  { id: 'process', label: 'Process', doneKey: 'processComplete' },
  { id: 'publish', label: 'Publish', doneKey: 'publishComplete' },
]

export default {
  name: 'HomeModule',
  emits: ['session-started', 'session-resume', 'session-gallery'],
  data() {
    return {
      STAGES,
      loading: false,
      sessions: [],
      showArchived: false,
      editingId: null,
      editingName: '',
      newName: this.suggestName(),
      newSource: '',
      starting: false,
    }
  },
  computed: {
    activeSessions() {
      return this.sessions.filter(s => s.status === 'active')
    },
    completedSessions() {
      return this.sessions
        .filter(s => s.status === 'complete')
        .map(s => ({
          ...s,
          summaryData: (() => { try { return JSON.parse(s.summary || 'null') } catch { return null } })()
        }))
    },
    archivedSessions() {
      return this.sessions.filter(s => s.status === 'archived')
    },
  },
  mounted() {
    this.loadSessions()
  },
  methods: {
    suggestName() {
      const d = new Date()
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' Session'
    },
    async loadSessions() {
      this.loading = true
      const result = await window.api.invoke('session:list')
      this.loading = false
      if (Array.isArray(result)) this.sessions = result
    },
    fmtDate(ts) {
      if (!ts) return '—'
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
    startEdit(session) {
      this.editingId = session.id
      this.editingName = session.name
      this.$nextTick(() => {
        const ref = this.$refs.editInput
        const el = Array.isArray(ref) ? ref[0] : ref
        el?.focus()
        el?.select()
      })
    },
    cancelEdit() {
      this.editingId = null
    },
    async saveName(session) {
      const name = this.editingName.trim()
      this.editingId = null
      if (!name || name === session.name) return
      await window.api.invoke('session:update', session.id, { name })
      session.name = name
    },
    async doArchive(session) {
      await window.api.invoke('session:archive', session.id)
      session.status = 'archived'
    },
    doResume(session) {
      this.$emit('session-resume', session)
    },
    doViewGallery(session) {
      this.$emit('session-gallery', session)
    },
    keepRate(summaryData) {
      if (!summaryData?.fileCount) return '—'
      return Math.round((summaryData.keptCount / summaryData.fileCount) * 100) + '%'
    },
    async pickSource() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) this.newSource = folder
    },
    async startImport() {
      const name = this.newName.trim()
      if (!name || this.starting) return
      this.starting = true
      const session = await window.api.invoke('session:create', name, this.newSource || null)
      this.starting = false
      if (!session || session.error) return
      this.newName = this.suggestName()
      this.newSource = ''
      this.$emit('session-started', session)
    },
  },
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* ── Left sidebar ─────────────────────────────── */
.home-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

.sidebar-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text2);
}

.ns-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ns-source-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ns-pick-btn {
  width: 100%;
  justify-content: center;
}

.ns-start-btn {
  width: 100%;
}

/* ── Sessions section ─────────────────────────── */
.home-sessions {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 28px 32px 16px;
}

.home-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text2);
  margin-bottom: 16px;
}

.home-loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.home-empty {
  text-align: center;
  padding: 60px 0;
  color: var(--text2);
  font-size: 14px;
}

/* ── Session cards ────────────────────────────── */
.session-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 18px;
  transition: border-color 0.15s;
}

.session-card:hover {
  border-color: var(--border-hover);
}

.session-card-archived {
  opacity: 0.6;
}

.session-card-complete {
  border-color: rgba(102, 187, 106, 0.25);
  background: rgba(102, 187, 106, 0.03);
}

.badge-complete {
  font-size: 11px;
  font-weight: 600;
  color: #66bb6a;
  background: rgba(102, 187, 106, 0.12);
  border: 1px solid rgba(102, 187, 106, 0.28);
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.badge-keeprate {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.22);
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.sc-actions-complete {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.sc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 5px;
}

.sc-name-wrap {
  flex: 1;
  min-width: 0;
}

.sc-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  cursor: text;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.sc-name:not(.sc-name-static):hover {
  color: var(--accent);
}

.sc-name-static {
  cursor: default;
}

.sc-name-input {
  width: 100%;
  font-size: 15px;
  font-weight: 600;
  background: var(--surface2);
  border: 1px solid var(--accent);
  border-radius: 4px;
  color: var(--text);
  padding: 2px 8px;
  outline: none;
  font-family: inherit;
}

.sc-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 2px;
}

.badge-active {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(201, 168, 76, 0.12);
  border: 1px solid rgba(201, 168, 76, 0.28);
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.badge-archived {
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  white-space: nowrap;
}

.btn-archive-sm {
  font-size: 11px;
  color: var(--text2);
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
  font-family: inherit;
}

.btn-archive-sm:hover {
  color: var(--text);
  border-color: var(--border-hover);
}

.sc-meta {
  font-size: 12px;
  color: var(--text2);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 13px;
}

.meta-dot {
  opacity: 0.35;
}

/* ── Pipeline progress bars ───────────────────── */
.sc-pipeline {
  display: flex;
  gap: 5px;
  margin-bottom: 14px;
}

.sc-seg {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sc-seg-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--surface2);
  transition: background 0.2s;
}

.sc-seg.done .sc-seg-bar {
  background: var(--accent);
}

.sc-seg-label {
  font-size: 10px;
  color: var(--text2);
  text-align: center;
  letter-spacing: 0.02em;
}

.sc-seg.done .sc-seg-label {
  color: var(--accent);
}

.sc-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-resume {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.28);
  border-radius: 6px;
  padding: 6px 18px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
}

.btn-resume:hover {
  background: rgba(201, 168, 76, 0.18);
  border-color: var(--accent);
}

/* ── Archived toggle ──────────────────────────── */
.archived-toggle-wrap {
  margin-top: 20px;
}

.archived-toggle {
  font-size: 12px;
  color: var(--text2);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: color 0.15s;
}

.archived-toggle:hover {
  color: var(--text);
}

.archived-list {
  margin-top: 10px;
}

/* ── New Session form fields ──────────────────── */
.ns-name-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s;
}

.ns-name-input:focus {
  border-color: var(--accent);
}

.ns-source-path {
  font-size: 11px;
  color: var(--text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.ns-no-source {
  opacity: 0.4;
  font-style: italic;
}

.btn-primary {
  font-size: 13px;
  font-weight: 600;
  background: var(--accent);
  color: #1a1a1a;
  border: none;
  border-radius: 6px;
  padding: 8px 22px;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-primary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-secondary {
  font-size: 12px;
  font-weight: 500;
  color: var(--text2);
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-secondary:hover {
  color: var(--text);
  border-color: var(--border-hover);
}
</style>
