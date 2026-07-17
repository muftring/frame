<template>
  <div class="home">

    <!-- Zone 1: Top bar -->
    <div class="home-topbar">
      <img :src="logoSrc" class="topbar-logo" alt="Frame" />
      <span class="topbar-wordmark">FRAME</span>
      <div class="topbar-sep"></div>
      <span v-if="session.id" class="topbar-session-pill">{{ session.name }}</span>
      <span class="topbar-version">v{{ version }}</span>
    </div>

    <!-- Zone 2: Pipeline bar -->
    <div class="home-pipelinebar">
      <template v-for="(stage, i) in PIPELINE_STAGES" :key="stage.id">
        <span v-if="i > 0" class="pb-sep">›</span>
        <div
          class="pb-stage"
          :class="stageState(stage)"
          @click="clickStage(stage)"
        >
          <span class="pb-dot"></span>
          {{ stage.label }}
        </div>
      </template>
      <span v-if="!session.id" class="pb-hint">Start a session to begin</span>
    </div>

    <!-- Zone 3: Scrollable content -->
    <div class="home-content">

      <template v-if="!isEmpty">
        <!-- Sessions section -->
        <div class="section-header">
          <span class="section-label">Sessions</span>
          <a class="section-action" @click="openNewSessionModal">+ New session</a>
        </div>

        <div class="session-grid">
          <template v-if="sessionsLoading">
            <div v-for="i in 3" :key="'skeleton' + i" class="session-card-skeleton"></div>
          </template>
          <template v-else>
            <SessionCard
              v-for="s in displayedSessions"
              :key="s.id"
              :session="s"
              :is-active="s.id === session.id"
              @resume="doResume"
              @view="doViewGallery"
              @archive="confirmArchive"
            />
            <div class="new-session-card" @click="openNewSessionModal">
              <div class="new-session-plus">+</div>
              <span class="new-session-label">New session</span>
            </div>
          </template>
        </div>

        <div v-if="hasMoreSessions" class="show-all-wrap">
          <a class="show-all-link" @click="showAllSessions = true">Show all {{ sessions.length }} sessions</a>
        </div>

        <!-- Library stats section -->
        <div class="section-header library-header">
          <span class="section-label">Library</span>
        </div>
        <div class="library-stats-grid">
          <div class="stat-card">
            <div class="stat-label">Sessions</div>
            <div class="stat-value stat-value-accent">{{ formatNum(stats.sessions) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Photos</div>
            <div class="stat-value">{{ formatNum(stats.photos) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Keepers</div>
            <div class="stat-value">{{ formatNum(stats.keepers) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Panoramas</div>
            <div class="stat-value">{{ formatNum(stats.panoramas) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Composites</div>
            <div class="stat-value">{{ formatNum(stats.composites) }}</div>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <img :src="logoSrc" class="empty-logo" alt="Frame" />
        <div class="empty-tagline">Photo workflow, start to finish</div>
        <div class="empty-description">
          Import your SD card, sort your keepers, edit, process, and publish — all in one place.
        </div>
        <button class="empty-import-btn" @click="openNewSessionModal">Import your first photos →</button>
        <div class="empty-hints-row">
          <span class="hint-pill">⌘2 Triage</span>
          <span class="hint-pill">⌘3 Sort</span>
          <span class="hint-pill">⌘4 Edit</span>
          <span class="hint-pill">⌘6 Process</span>
          <span class="hint-pill">⌘7 Publish</span>
        </div>
      </div>
    </div>

    <!-- New session modal -->
    <div v-if="showNewSessionModal" class="modal-overlay" @click.self="showNewSessionModal = false">
      <div class="modal">
        <h4>New Session</h4>
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
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showNewSessionModal = false">Cancel</button>
          <button
            class="btn-primary"
            :disabled="!newName.trim() || starting"
            @click="startImport"
          >
            {{ starting ? 'Creating…' : 'Start import →' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import SessionCard from '../../components/SessionCard.vue'

const PIPELINE_STAGES = [
  { id: 'triage',  label: 'Triage',  module: 'triage',  doneKey: 'triage_complete' },
  { id: 'sort',    label: 'Sort',    module: 'sorter',  doneKey: 'sort_complete' },
  { id: 'edit',    label: 'Edit',    module: 'editor',  doneKey: 'edit_complete' },
  { id: 'process', label: 'Process', module: 'process', doneKey: 'process_complete' },
  { id: 'publish', label: 'Publish', module: 'publish', doneKey: 'publish_complete' },
]

export default {
  name: 'HomeModule',
  components: { SessionCard },
  inject: ['session'],
  emits: ['session-started', 'session-resume', 'session-gallery', 'navigate'],
  data() {
    return {
      PIPELINE_STAGES,
      version: __APP_VERSION__,
      sessionsLoading: true,
      sessions: [],
      showAllSessions: false,
      stats: { sessions: 0, photos: 0, keepers: 0, panoramas: 0, composites: 0 },
      showNewSessionModal: false,
      newName: this.suggestName(),
      newSource: '',
      starting: false
    }
  },
  computed: {
    logoSrc() {
      return new URL('../../assets/logo/frame-mark-contained.svg', import.meta.url).href
    },
    displayedSessions() {
      return this.sessions.slice(0, this.showAllSessions ? 18 : 9)
    },
    hasMoreSessions() {
      return this.sessions.length > 9 && !this.showAllSessions
    },
    isEmpty() {
      return !this.sessionsLoading && this.sessions.length === 0
    }
  },
  created() {
    this.loadSessions()
    this.loadStats()
  },
  mounted() {
    window.addEventListener('focus', this.refreshAll)
  },
  beforeUnmount() {
    window.removeEventListener('focus', this.refreshAll)
  },
  methods: {
    suggestName() {
      const d = new Date()
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' Session'
    },
    refreshAll() {
      this.loadSessions()
      this.loadStats()
    },
    async loadSessions() {
      const result = await window.api.invoke('session:list')
      this.sessionsLoading = false
      if (Array.isArray(result)) this.sessions = result.filter(s => s.status !== 'archived')
    },
    async loadStats() {
      const [sessions, photos, keepers, panoramas, composites] = await Promise.all([
        window.api.invoke('session:count'),
        window.api.invoke('file:count'),
        window.api.invoke('file:countByStatus', 'kept'),
        window.api.invoke('pano:countSets'),
        window.api.invoke('burst:countComposited')
      ])
      this.stats = {
        sessions: sessions || 0,
        photos: photos || 0,
        keepers: keepers || 0,
        panoramas: panoramas || 0,
        composites: composites || 0
      }
    },
    formatNum(n) {
      const v = n || 0
      return v > 999 ? v.toLocaleString() : String(v)
    },
    stageState(stage) {
      if (!this.session.id) return 'pending'
      if (this.session.pipelineState?.[stage.doneKey]) return 'done'
      if (this.session.currentStage === stage.id) return 'active'
      return 'pending'
    },
    clickStage(stage) {
      if (!this.session.id) return
      const state = this.stageState(stage)
      if (state === 'done' || state === 'active') {
        this.$emit('navigate', stage.module)
      }
    },
    openNewSessionModal() {
      this.newName = this.suggestName()
      this.newSource = ''
      this.showNewSessionModal = true
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
      this.showNewSessionModal = false
      this.refreshAll()
      this.$emit('session-started', session)
    },
    doResume(session) {
      this.$emit('session-resume', session)
    },
    doViewGallery(session) {
      this.$emit('session-gallery', session)
    },
    async confirmArchive(session) {
      if (!window.confirm(`Archive "${session.name}"? You can still find it later, but it won't show on Home.`)) return
      await window.api.invoke('session:archive', session.id)
      this.refreshAll()
    }
  }
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* ── Zone 1: Top bar ──────────────────────────── */
.home-topbar {
  height: 50px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: drag;
}

.topbar-session-pill,
.topbar-version {
  -webkit-app-region: no-drag;
}

.topbar-logo {
  width: 26px;
  height: 26px;
  border-radius: 5px;
}

.topbar-wordmark {
  font-size: 12px;
  font-weight: 200;
  letter-spacing: 6px;
  color: var(--color-text);
  text-indent: 6px;
}

.topbar-sep {
  width: 1px;
  height: 18px;
  background: var(--color-border-2);
  margin: 0 4px;
}

.topbar-session-pill {
  background: var(--color-accent-dim);
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 10px;
  color: var(--color-accent);
}

.topbar-version {
  margin-left: auto;
  font-size: 9px;
  color: var(--color-text-3);
}

/* ── Zone 2: Pipeline bar ─────────────────────── */
.home-pipelinebar {
  height: 40px;
  flex-shrink: 0;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.pb-stage {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  height: 100%;
  font-size: 10px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  color: var(--color-text-2);
}

.pb-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2a2a2a;
  flex-shrink: 0;
}

.pb-stage.done {
  color: var(--color-keep-hover);
  cursor: pointer;
}
.pb-stage.done .pb-dot {
  background: var(--color-keep-hover);
}

.pb-stage.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  cursor: pointer;
}
.pb-stage.active .pb-dot {
  background: var(--color-accent);
}

.pb-stage.pending {
  cursor: default;
}

.pb-sep {
  color: #252525;
  font-size: 9px;
  padding: 0 2px;
}

.pb-hint {
  font-size: 9px;
  color: var(--color-text-2);
  font-style: italic;
  margin-left: 6px;
}

/* ── Zone 3: Content ──────────────────────────── */
.home-content {
  flex: 1;
  overflow-y: auto;
  padding: 22px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-surface-3) transparent;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.library-header {
  margin-top: 4px;
}

.section-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-3);
}

.section-action {
  font-size: 10px;
  color: var(--color-accent);
  cursor: pointer;
}

/* ── Session grid ─────────────────────────────── */
.session-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 22px;
}

@keyframes shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 0.7; }
  100% { opacity: 0.4; }
}

.session-card-skeleton {
  min-height: 140px;
  border-radius: 9px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  animation: shimmer 1.4s ease-in-out infinite;
}

.new-session-card {
  background: var(--color-bg);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.new-session-card:hover {
  border-color: rgba(201, 168, 76, 0.25);
}

.new-session-plus {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.2);
  color: var(--color-accent);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.new-session-label {
  font-size: 10px;
  color: var(--color-text-3);
}

.show-all-wrap {
  margin-top: -12px;
  margin-bottom: 22px;
}

.show-all-link {
  font-size: 11px;
  color: var(--color-text-2);
  cursor: pointer;
}
.show-all-link:hover {
  color: var(--color-accent);
}

/* ── Library stats ────────────────────────────── */
.library-stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
}

.stat-card {
  background: var(--color-bg);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 7px;
  padding: 9px 10px;
}

.stat-label {
  font-size: 8px;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}

.stat-value {
  font-size: 15px;
  font-weight: 300;
  color: var(--color-text-2);
}

.stat-value-accent {
  color: var(--color-accent);
}

/* ── Empty state ──────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 340px;
  gap: 16px;
}

.empty-logo {
  width: 72px;
  height: 72px;
  border-radius: 14px;
}

.empty-tagline {
  font-size: 16px;
  font-weight: 200;
  color: var(--color-text-2);
  letter-spacing: 2px;
}

.empty-description {
  font-size: 11px;
  color: var(--color-text-3);
  text-align: center;
  max-width: 280px;
  line-height: 1.6;
}

.empty-import-btn {
  background: var(--color-accent);
  color: #1a1a1a;
  font-size: 12px;
  font-weight: 500;
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.empty-hints-row {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.hint-pill {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 9px;
  color: var(--color-text-2);
  font-family: var(--font-mono);
}

/* ── New session modal ────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 22px;
  width: 360px;
}

.modal h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 14px;
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

.ns-name-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 13px;
  font-family: inherit;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s;
}
.ns-name-input:focus {
  border-color: var(--color-accent);
}

.ns-source-path {
  font-size: 11px;
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.ns-no-source {
  opacity: 0.4;
  font-style: italic;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.btn-primary {
  font-size: 13px;
  font-weight: 600;
  background: var(--color-accent);
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
  color: var(--color-text-2);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.btn-secondary:hover {
  color: var(--color-text);
  border-color: var(--color-border-2);
}
</style>
