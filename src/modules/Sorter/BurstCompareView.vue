<template>
  <div class="burst-compare-overlay">

    <!-- Top bar -->
    <div class="bc-top-bar">
      <div class="bc-title-group">
        <span class="bc-title">⚡ {{ burstSet?.name || 'Burst' }}</span>
        <span class="bc-count">{{ frames.length }} frames</span>
      </div>

      <div class="bc-zoom-group">
        <svg class="bc-zoom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span class="bc-zoom-pct">{{ zoomPercent }}%</span>
        <button class="btn-sm" :class="{ active: zoomPercent === 25 }" @click="setZoom(25)">25%</button>
        <button class="btn-sm" :class="{ active: zoomPercent === 50 }" @click="setZoom(50)">50%</button>
        <button class="btn-sm" :class="{ active: zoomPercent === 100 }" @click="setZoom(100)">100%</button>
        <button class="btn-sm" @click="resetZoom">Fit</button>
      </div>

      <div class="bc-top-actions">
        <button
          class="btn btn-accent"
          :disabled="!keeperFileId"
          @click="showConfirmModal = true"
        >Keep best, delete rest</button>
        <button class="bc-close" @click="$emit('close')">✕</button>
      </div>
    </div>

    <div v-if="loading" class="bc-loading">Loading burst frames…</div>

    <template v-else>
      <!-- Synchronized grid -->
      <div class="bc-grid-wrap">
        <div class="bc-grid">
          <div
            v-for="(f, i) in frames"
            :key="f.fileId"
            class="bc-cell"
            :class="{ selected: selectedIndex === i }"
            @click="selectFrame(i)"
            @wheel.prevent="onWheel($event)"
          >
            <div class="bc-cell-viewport" @mousedown="onPanStart($event, i)">
              <img
                v-if="f.thumbnail"
                :src="f.thumbnail"
                class="bc-cell-img"
                :style="zoomStyle"
                draggable="false"
              />
              <div v-else class="bc-cell-placeholder"></div>
            </div>
            <span class="bc-frame-number">{{ i + 1 }}</span>
            <span v-if="f.fileId === keeperFileId" class="bc-keeper-badge">👑</span>
            <div class="bc-cell-filename">{{ f.filename }}</div>
            <span v-if="f.meta.shutterSpeed" class="bc-cell-shutter">{{ f.meta.shutterSpeed }}</span>
            <span v-if="selectedIndex === i" class="bc-selected-check">✓</span>
          </div>
        </div>
      </div>

      <!-- Split panel -->
      <div class="bc-split" v-if="selectedFrame">
        <div class="bc-split-image">
          <img v-if="selectedFrame.fullUrl" :src="selectedFrame.fullUrl" />
        </div>
        <div class="bc-split-meta">
          <div class="bc-meta-filename">{{ selectedFrame.filename }}</div>
          <div class="bc-meta-row" v-if="selectedFrame.meta.shutterSpeed">
            <span class="bc-meta-label">Shutter</span>
            <span>{{ selectedFrame.meta.shutterSpeed }}</span>
          </div>
          <div class="bc-meta-row" v-if="selectedFrame.meta.aperture">
            <span class="bc-meta-label">Aperture</span>
            <span>{{ selectedFrame.meta.aperture }}</span>
          </div>
          <div class="bc-meta-row" v-if="selectedFrame.meta.iso">
            <span class="bc-meta-label">ISO</span>
            <span>{{ selectedFrame.meta.iso }}</span>
          </div>
          <div class="bc-split-actions">
            <button class="btn btn-accent" @click="keepThisFrame">Keep this frame</button>
            <button class="btn btn-secondary" @click="notThisFrame">Not this one</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Keyboard hints bar -->
    <div class="bc-hints-bar">
      <button class="bc-hints-toggle" @click="showHints = !showHints">?</button>
      <div v-if="showHints" class="bc-hints-list">
        <span>← → navigate</span>
        <span>Enter/K keep</span>
        <span>Delete/D not this one</span>
        <span>Shift+Enter keep best, delete rest</span>
        <span>Esc close</span>
        <span>1–9 jump to frame</span>
        <span>+/- or scroll zoom</span>
        <span>0 reset zoom</span>
      </div>
    </div>

    <!-- Confirm keeper modal -->
    <div v-if="showConfirmModal" class="modal-overlay" @click.self="showConfirmModal = false">
      <div class="modal">
        <h4>Keep {{ keeperFrame?.filename }} and mark the other {{ frames.length - 1 }} frames as deleted?</h4>
        <img v-if="keeperFrame?.thumbnail" :src="keeperFrame.thumbnail" class="bc-confirm-thumb" />
        <div class="modal-actions">
          <button class="btn" @click="showConfirmModal = false">Cancel</button>
          <button class="btn btn-accent" :disabled="confirming" @click="confirmKeepBest">
            {{ confirming ? 'Saving…' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: 'BurstCompareView',
  inject: ['toast'],
  props: {
    burstSetId: { type: Number, required: true },
    sessionId: { type: Number, required: true }
  },
  emits: ['close', 'kept'],
  data() {
    return {
      loading: true,
      burstSet: null,
      frames: [],
      selectedIndex: 0,
      keeperFileId: null,
      zoomPercent: 100,
      panX: 0,
      panY: 0,
      showConfirmModal: false,
      confirming: false,
      showHints: false,
      _panActive: false,
      _panLast: null
    }
  },
  computed: {
    selectedFrame() {
      return this.frames[this.selectedIndex] || null
    },
    keeperFrame() {
      return this.frames.find(f => f.fileId === this.keeperFileId) || null
    },
    zoomStyle() {
      const scale = this.zoomPercent / 100
      return {
        transform: `scale(${scale}) translate(${this.panX}px, ${this.panY}px)`
      }
    }
  },
  async mounted() {
    this._keyHandler = this.handleKeydown.bind(this)
    window.addEventListener('keydown', this._keyHandler)
    window.addEventListener('mousemove', this.onPanMove)
    window.addEventListener('mouseup', this.onPanEnd)
    await this.load()
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
    window.removeEventListener('mousemove', this.onPanMove)
    window.removeEventListener('mouseup', this.onPanEnd)
  },
  methods: {
    async load() {
      this.loading = true
      const [sets, files] = await Promise.all([
        window.api.invoke('burst:listSets', this.sessionId),
        window.api.invoke('burst:listFiles', this.burstSetId)
      ])
      this.burstSet = Array.isArray(sets) ? sets.find(s => s.id === this.burstSetId) || null : null
      if (Array.isArray(files)) {
        this.frames = files.map(f => ({
          fileId: f.id,
          filename: f.filename,
          fullPath: f.full_path,
          fullUrl: null,
          thumbnail: null,
          meta: { shutterSpeed: null, aperture: null, iso: null }
        }))
      }
      this.loading = false
      this.loadThumbnails()
    },
    async loadThumbnails() {
      for (const f of this.frames) {
        const [thumb, full, meta] = await Promise.all([
          window.api.invoke('img:thumbnail', f.fullPath, { width: 320, height: 213 }),
          window.api.invoke('img:thumbnail', f.fullPath, { width: 1600, height: 1067 }),
          window.api.invoke('img:getFullMetadata', f.fullPath)
        ])
        f.thumbnail = thumb
        f.fullUrl = full
        if (meta && !meta.error) {
          f.meta.shutterSpeed = meta.exif?.shutterSpeed || null
          f.meta.aperture = meta.exif?.aperture || null
          f.meta.iso = meta.exif?.iso || null
        }
      }
    },
    selectFrame(i) {
      this.selectedIndex = i
    },
    keepThisFrame() {
      if (!this.selectedFrame) return
      this.keeperFileId = this.selectedFrame.fileId
    },
    notThisFrame() {
      // Informational only per spec — doesn't delete immediately, just
      // advances so the reviewer can keep comparing.
      if (this.selectedIndex < this.frames.length - 1) this.selectedIndex++
    },
    async confirmKeepBest() {
      if (!this.keeperFileId || this.confirming) return
      this.confirming = true
      const result = await window.api.invoke('burst:setKeeper', this.burstSetId, this.keeperFileId)
      this.confirming = false
      this.showConfirmModal = false
      if (!result || result.error) {
        this.toast('Failed to save keeper selection', 'error')
        return
      }
      this.$emit('kept', {
        burstSetId: this.burstSetId,
        keeperFileId: this.keeperFileId,
        keeperFilename: this.keeperFrame?.filename || '',
        otherCount: this.frames.length - 1
      })
    },
    setZoom(pct) {
      this.zoomPercent = pct
      this.panX = 0
      this.panY = 0
    },
    resetZoom() {
      this.setZoom(100)
    },
    onWheel(e) {
      const delta = e.deltaY < 0 ? 10 : -10
      this.zoomPercent = Math.max(25, Math.min(400, this.zoomPercent + delta))
    },
    onPanStart(e, i) {
      if (this.zoomPercent <= 100) { this.selectFrame(i); return }
      this._panActive = true
      this._panLast = { x: e.clientX, y: e.clientY }
      this.selectFrame(i)
    },
    onPanMove(e) {
      if (!this._panActive || !this._panLast) return
      const dx = e.clientX - this._panLast.x
      const dy = e.clientY - this._panLast.y
      this._panLast = { x: e.clientX, y: e.clientY }
      const scale = this.zoomPercent / 100
      this.panX += dx / scale
      this.panY += dy / scale
    },
    onPanEnd() {
      this._panActive = false
      this._panLast = null
    },
    handleKeydown(e) {
      if (this.showConfirmModal) {
        if (e.key === 'Escape') this.showConfirmModal = false
        return
      }
      switch (e.key) {
        case 'ArrowLeft':
          if (this.selectedIndex > 0) this.selectedIndex--
          e.preventDefault()
          break
        case 'ArrowRight':
          if (this.selectedIndex < this.frames.length - 1) this.selectedIndex++
          e.preventDefault()
          break
        case 'Enter':
          if (e.shiftKey) { if (this.keeperFileId) this.showConfirmModal = true }
          else this.keepThisFrame()
          break
        case 'k': case 'K': this.keepThisFrame(); break
        case 'Delete': case 'd': case 'D': this.notThisFrame(); break
        case 'Escape': this.$emit('close'); break
        case '+': case '=': this.zoomPercent = Math.min(400, this.zoomPercent + 25); break
        case '-': case '_': this.zoomPercent = Math.max(25, this.zoomPercent - 25); break
        case '0': this.resetZoom(); break
        default: {
          const n = parseInt(e.key, 10)
          if (n >= 1 && n <= 9 && n <= this.frames.length) this.selectedIndex = n - 1
        }
      }
    }
  }
}
</script>

<style scoped>
/* TODO Branding-B: migrate to tokens.css variables */
.burst-compare-overlay {
  position: fixed;
  inset: 0;
  background: #14140f;
  z-index: 400;
  display: flex;
  flex-direction: column;
}

.bc-top-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.bc-title-group {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.bc-title {
  font-size: 15px;
  font-weight: 600;
  color: #e8943a;
}

.bc-count {
  font-size: 12px;
  color: var(--text2);
}

.bc-zoom-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.bc-zoom-icon {
  width: 14px;
  height: 14px;
  color: var(--text2);
}

.bc-zoom-pct {
  font-size: 12px;
  color: var(--text2);
  width: 36px;
}

.btn-sm {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text2);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}
.btn-sm:hover { background: var(--surface2); color: var(--text); }
.btn-sm.active { border-color: var(--accent); color: var(--accent); }

.bc-top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bc-close {
  background: none;
  border: none;
  color: var(--text2);
  font-size: 16px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.bc-close:hover { background: var(--surface2); color: var(--text); }

.bc-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
  font-size: 13px;
}

.bc-grid-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.bc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.bc-cell {
  position: relative;
  background: var(--surface);
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
}

.bc-cell.selected {
  border-color: var(--accent);
}

.bc-cell-viewport {
  width: 100%;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: #0a0a08;
}

.bc-cell-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: center center;
  user-select: none;
  pointer-events: none;
}

.bc-cell-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface2);
}

.bc-frame-number {
  position: absolute;
  top: 4px;
  left: 4px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 3px;
}

.bc-keeper-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 16px;
}

.bc-cell-filename {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bc-cell-shutter {
  position: absolute;
  bottom: 2px;
  right: 4px;
  color: #fff;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.5);
  padding: 1px 5px;
  border-radius: 3px;
}

.bc-selected-check {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #1a1a1a;
  background: var(--accent);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.bc-split {
  display: flex;
  gap: 16px;
  height: 42vh;
  min-height: 260px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 16px 20px;
  flex-shrink: 0;
}

.bc-split-image {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a08;
  border-radius: 6px;
  overflow: hidden;
}

.bc-split-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bc-split-meta {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bc-meta-filename {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}

.bc-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text2);
}

.bc-meta-label {
  color: var(--text2);
}

.bc-split-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.btn {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 13px;
  padding: 7px 16px;
  cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--border); }
.btn:disabled { opacity: 0.4; cursor: default; }

.btn-accent {
  background: var(--accent);
  border: none;
  color: #1a1a1a;
  font-weight: 600;
}
.btn-accent:hover:not(:disabled) { opacity: 0.85; }

.btn-secondary {
  background: none;
  color: var(--text2);
}

.bc-hints-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 20px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text2);
}

.bc-hints-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  color: var(--text2);
  cursor: pointer;
  flex-shrink: 0;
}
.bc-hints-toggle:hover { color: var(--text); }

.bc-hints-list {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px 22px;
  width: 360px;
  max-width: calc(100vw - 40px);
}

.modal h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text);
  font-weight: 600;
}

.bc-confirm-thumb {
  width: 100%;
  border-radius: 6px;
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
