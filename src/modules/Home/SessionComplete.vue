<template>
  <div class="sc-overlay">
    <div class="sc-scroll">

      <!-- Check animation -->
      <div class="sc-hero">
        <svg class="check-svg" viewBox="0 0 100 100" fill="none">
          <circle
            class="anim-circle"
            cx="50" cy="50" r="44"
            stroke="var(--accent)" stroke-width="4"
          />
          <path
            class="anim-check"
            d="M 28 50 L 42 64 L 72 36"
            stroke="var(--accent)" stroke-width="5"
            stroke-linecap="round" stroke-linejoin="round"
          />
        </svg>
        <h1 class="sc-heading">Session complete!</h1>
        <p class="sc-session-name">{{ session?.name }}</p>
      </div>

      <!-- Stats grid -->
      <div class="sc-stats">
        <div class="stat-card">
          <div class="stat-value">{{ summary.fileCount ?? '—' }}</div>
          <div class="stat-label">Photos imported</div>
        </div>
        <div class="stat-card">
          <div class="stat-value kept">{{ summary.keptCount ?? '—' }}</div>
          <div class="stat-label">Photos kept</div>
        </div>
        <div class="stat-card">
          <div class="stat-value deleted">{{ summary.deletedCount ?? '—' }}</div>
          <div class="stat-label">Photos deleted</div>
        </div>
        <div class="stat-card">
          <div class="stat-value accent">{{ keepRate }}</div>
          <div class="stat-label">Keep rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ summary.groupCount ?? '—' }}</div>
          <div class="stat-label">Groups / events</div>
        </div>
        <div class="stat-card">
          <div class="stat-value dest">{{ publishedTo }}</div>
          <div class="stat-label">Published to</div>
        </div>
        <div class="stat-card stat-card-wide">
          <div class="stat-value">{{ timeSpan }}</div>
          <div class="stat-label">Time span</div>
        </div>
      </div>

      <!-- Cleanup card (deleted files still on disk) -->
      <div v-if="deletedOnDisk.length" class="sc-cleanup-card">
        <div class="sc-cleanup-text">
          <strong>{{ deletedOnDisk.length }} {{ deletedOnDisk.length === 1 ? 'file is' : 'files are' }} marked deleted and still on disk.</strong>
          Remove them now to free up {{ formatSize(deletedSize) }}?
        </div>
        <div class="sc-cleanup-actions">
          <button class="sc-btn sc-btn-cleanup" @click="doCleanupDeleted" :disabled="cleaningUp">
            {{ cleaningUp ? 'Moving…' : 'Free up ' + formatSize(deletedSize) }}
          </button>
          <button class="sc-btn sc-btn-ghost" @click="deletedOnDisk = []">Keep files on disk</button>
        </div>
      </div>

      <!-- Gallery strip -->
      <div v-if="keptFiles.length" class="sc-gallery-wrap">
        <h3 class="sc-gallery-title">Kept photos</h3>
        <div class="sc-gallery-strip" ref="strip">
          <div
            v-for="(f, i) in keptFiles"
            :key="f.full_path || i"
            class="sc-thumb-cell"
          >
            <img v-if="thumbnails[i]" :src="thumbnails[i]" class="sc-thumb" />
            <div v-else class="sc-thumb-placeholder skeleton"></div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="sc-actions">
        <button class="sc-btn sc-btn-primary" @click="$emit('view-gallery')">
          View in Gallery
        </button>
        <button class="sc-btn sc-btn-secondary" @click="$emit('new-session')">
          Start new session
        </button>
        <button class="sc-btn sc-btn-ghost" @click="$emit('archive')">
          Archive session
        </button>
      </div>

    </div>
  </div>
</template>

<script>
export default {
  name: 'SessionComplete',
  inject: ['session', 'toast'],
  props: {
    summary: { type: Object, default: () => ({}) }
  },
  emits: ['view-gallery', 'new-session', 'archive'],
  data() {
    return {
      keptFiles: [],
      thumbnails: [],
      deletedOnDisk: [],
      deletedSize: 0,
      cleaningUp: false
    }
  },
  computed: {
    keepRate() {
      const { fileCount, keptCount } = this.summary
      if (!fileCount) return '—'
      return Math.round((keptCount / fileCount) * 100) + '%'
    },
    publishedTo() {
      const dests = this.summary.destinations
      if (!Array.isArray(dests) || !dests.length) return '—'
      return dests.join(', ')
    },
    timeSpan() {
      const { minTs, maxTs } = this.summary
      if (!minTs) return '—'
      const start = new Date(minTs)
      const end = new Date(maxTs || minTs)
      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
      const fmt = { month: 'short', day: 'numeric' }
      return start.toLocaleDateString('en-US', fmt) + ' – ' +
        end.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })
    }
  },
  async mounted() {
    if (!this.session?.id) return
    const files = await window.api.invoke('file:listBySession', this.session.id, { status: 'kept' })
    if (!Array.isArray(files)) return
    this.keptFiles = files.slice(0, 40)
    this.thumbnails = new Array(this.keptFiles.length).fill(null)
    this.loadThumbnails()

    const allDeleted = await window.api.invoke('file:listBySession', this.session.id, { status: 'deleted' })
    if (Array.isArray(allDeleted)) {
      this.deletedOnDisk = allDeleted.filter(f => !f.trashed_at)
      this.deletedSize = this.deletedOnDisk.reduce((sum, f) => sum + (f.size_bytes || 0), 0)
    }
  },
  methods: {
    async loadThumbnails() {
      for (let i = 0; i < this.keptFiles.length; i++) {
        const f = this.keptFiles[i]
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 160, height: 120 })
        this.thumbnails[i] = thumb
        this.thumbnails = [...this.thumbnails]
      }
    },
    async doCleanupDeleted() {
      this.cleaningUp = true
      const toMove = [...this.deletedOnDisk]
      let moved = 0
      for (const f of toMove) {
        const trashFolder = f.full_path.replace(/\/[^/]+$/, '') + '/.frame-trash'
        const result = await window.api.invoke('fs:moveToTrash', f.full_path, trashFolder)
        if (result.success) {
          await window.api.invoke('file:updateTrashedPath', f.id, result.trashedPath, Date.now())
          moved++
        }
      }
      this.deletedOnDisk = []
      this.deletedSize = 0
      this.cleaningUp = false
      this.toast(`${moved} deleted file${moved !== 1 ? 's' : ''} moved to trash`, 'success')
    },
    formatSize(bytes) {
      const mb = bytes / (1024 * 1024)
      if (mb >= 1000) return (mb / 1024).toFixed(1) + ' GB'
      return mb.toFixed(1) + ' MB'
    }
  }
}
</script>

<style scoped>
/* TODO Branding-B: migrate to tokens.css variables */
.sc-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--bg);
  overflow-y: auto;
}

.sc-scroll {
  max-width: 760px;
  margin: 0 auto;
  padding: 60px 32px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}

/* ── Hero ─────────────────────────────────────── */
.sc-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.check-svg {
  width: 100px;
  height: 100px;
}

.anim-circle {
  stroke-dasharray: 277;
  stroke-dashoffset: 277;
  animation: drawCircle 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.15s;
}

.anim-check {
  stroke-dasharray: 65;
  stroke-dashoffset: 65;
  animation: drawCheck 0.35s ease forwards 0.95s;
}

@keyframes drawCircle { to { stroke-dashoffset: 0; } }
@keyframes drawCheck  { to { stroke-dashoffset: 0; } }

.sc-heading {
  font-size: 32px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.sc-session-name {
  font-size: 15px;
  color: var(--accent);
  font-weight: 500;
}

/* ── Stats ────────────────────────────────────── */
.sc-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  width: 100%;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
}

.stat-card-wide {
  grid-column: span 3;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.1;
  margin-bottom: 5px;
  font-variant-numeric: tabular-nums;
}

.stat-value.kept    { color: #66bb6a; }
.stat-value.deleted { color: #ef5350; }
.stat-value.accent  { color: var(--accent); }
.stat-value.dest    { font-size: 18px; }

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text2);
  font-weight: 600;
}

/* ── Gallery strip ────────────────────────────── */
.sc-gallery-wrap {
  width: 100%;
}

.sc-gallery-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text2);
  font-weight: 600;
  margin-bottom: 12px;
}

.sc-gallery-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.sc-gallery-strip::-webkit-scrollbar { height: 4px; }
.sc-gallery-strip::-webkit-scrollbar-track { background: transparent; }
.sc-gallery-strip::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 2px; }

.sc-thumb-cell {
  flex-shrink: 0;
  width: 160px;
  height: 120px;
  border-radius: 6px;
  overflow: hidden;
}

.sc-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sc-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface2);
}

/* ── Actions ──────────────────────────────────── */
.sc-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.sc-btn {
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s, background 0.15s;
  white-space: nowrap;
}

.sc-btn-primary {
  background: var(--accent);
  color: #1a1a1a;
  border: none;
}
.sc-btn-primary:hover { opacity: 0.88; }

.sc-btn-secondary {
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border);
}
.sc-btn-secondary:hover { background: var(--surface-hover); }

.sc-btn-ghost {
  background: none;
  color: var(--text2);
  border: 1px solid var(--border);
}
.sc-btn-ghost:hover { color: var(--text); border-color: var(--border-hover); }

/* ── Cleanup card ─────────────────────────────── */
.sc-cleanup-card {
  width: 100%;
  background: rgba(239, 83, 80, 0.06);
  border: 1px solid rgba(239, 83, 80, 0.25);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sc-cleanup-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
}

.sc-cleanup-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sc-btn-cleanup {
  background: #ef5350;
  color: #fff;
  border: none;
}
.sc-btn-cleanup:hover { opacity: 0.88; }
.sc-btn-cleanup:disabled { opacity: 0.5; cursor: default; }

/* ── Skeleton ─────────────────────────────────── */
.skeleton {
  background: linear-gradient(90deg, var(--surface2) 25%, #363636 50%, var(--surface2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
</style>
