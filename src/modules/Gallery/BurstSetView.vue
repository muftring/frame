<template>
  <div class="burst-set-view">

    <!-- Header -->
    <div class="burst-header">
      <div class="burst-header-top">
        <input
          v-if="editingName"
          ref="nameInput"
          v-model="nameDraft"
          class="burst-name-input"
          @blur="saveName"
          @keydown.enter="$event.target.blur()"
          @keydown.esc="editingName = false"
        />
        <h2 v-else class="burst-name" title="Click to rename" @click="startEditName">{{ burstSet?.name || 'Burst Set' }}</h2>
        <span class="status-pill" :class="'status-' + burstSet?.status">{{ statusLabel(burstSet?.status) }}</span>
      </div>
      <div class="burst-header-meta">
        <span>{{ files.length }} frame{{ files.length === 1 ? '' : 's' }}</span>
      </div>
      <div class="burst-header-actions">
        <button
          v-if="burstSet?.status === 'pending'"
          class="btn action-btn btn-accent"
          @click="openCompare"
        >Compare frames</button>
        <button
          class="btn action-btn"
          :class="{ 'confirmed-btn': burstSet?.status !== 'pending' }"
          :disabled="burstSet?.status === 'pending'"
          :title="burstSet?.status === 'pending' ? 'Select a keeper first in Compare view' : ''"
          @click="createComposite"
        >Create composite →</button>
        <button class="btn" @click="$emit('close')">Back to Gallery</button>
      </div>
    </div>

    <!-- Frame strip -->
    <div class="frame-strip">
      <div
        v-for="(f, i) in files"
        :key="f.id"
        class="frame-thumb"
        :class="{ selected: selectedFileId === f.id, deleted: f.status === 'deleted' }"
        @click="selectFrame(f.id, i)"
      >
        <img v-if="thumbnails[f.id]" :src="thumbnails[f.id]" />
        <div v-else class="frame-thumb-placeholder"></div>
        <span class="frame-number">{{ i + 1 }}</span>
        <span v-if="f.id === burstSet?.kept_file_id" class="keeper-crown">👑</span>
        <span v-if="f.status === 'deleted'" class="deleted-x">✕</span>
      </div>
      <div v-if="!files.length" class="frame-strip-empty">No frames in this set</div>
    </div>

    <!-- Keeper display -->
    <div v-if="keeperFile" class="keeper-row">
      <span class="keeper-label">Selected keeper:</span>
      <img v-if="keeperThumb" :src="keeperThumb" class="keeper-thumb" />
      <div class="keeper-meta">
        <div class="keeper-filename">{{ keeperFile.filename }}</div>
        <div class="keeper-exif">
          <span v-if="keeperExif.shutterSpeed">{{ keeperExif.shutterSpeed }}</span>
          <span v-if="keeperExif.aperture">{{ keeperExif.aperture }}</span>
          <span v-if="keeperExif.iso">ISO {{ keeperExif.iso }}</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="burst-controls">
      <button class="btn" @click="openCompare">Open burst compare view</button>
      <button class="btn" @click="openAddFrames">Add frames</button>
      <button class="btn" :disabled="!selectedFileId" @click="removeSelected">Remove selected</button>
      <button class="btn btn-danger" @click="confirmDisband = true">Disband set</button>
    </div>

    <!-- Disband confirmation -->
    <div v-if="confirmDisband" class="modal-overlay" @click.self="confirmDisband = false">
      <div class="modal">
        <h4>Disband this burst set?</h4>
        <p>Files stay on disk and remain in the session — only the burst grouping is removed. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn" @click="confirmDisband = false">Cancel</button>
          <button class="btn btn-danger" @click="disbandSet">Disband</button>
        </div>
      </div>
    </div>

    <!-- Add frames modal -->
    <div v-if="addFramesOpen" class="modal-overlay" @click.self="addFramesOpen = false">
      <div class="modal add-frames-modal">
        <h4>Add frames to "{{ burstSet?.name }}"</h4>
        <div v-if="!availableFiles.length" class="add-frames-empty">
          No unassigned files in this session.
        </div>
        <div v-else class="add-frames-list">
          <label v-for="f in availableFiles" :key="f.id" class="add-frames-row">
            <input type="checkbox" :value="f.id" v-model="selectedToAdd" />
            <img v-if="availableThumbs[f.id]" :src="availableThumbs[f.id]" class="add-frames-thumb" />
            <div v-else class="add-frames-thumb-placeholder"></div>
            <span class="add-frames-name">{{ f.filename }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="addFramesOpen = false">Cancel</button>
          <button class="btn btn-accent" :disabled="!selectedToAdd.length" @click="confirmAddFrames">
            Add {{ selectedToAdd.length || '' }} frame{{ selectedToAdd.length === 1 ? '' : 's' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Viewer -->
    <ImageViewer
      :visible="viewerOpen"
      :image="viewerImage"
      :has-prev="viewerIndex > 0"
      :has-next="viewerIndex < files.length - 1"
      @close="viewerOpen = false"
      @prev="viewerIndex > 0 && viewerIndex--"
      @next="viewerIndex < files.length - 1 && viewerIndex++"
    />

    <!-- Burst compare overlay -->
    <BurstCompareView
      v-if="compareOpen"
      :burst-set-id="burstSetId"
      :session-id="activeSession.id"
      @close="closeCompare"
      @kept="handleKept"
    />

  </div>
</template>

<script>
import ImageViewer from './ImageViewer.vue'
import BurstCompareView from '../Sorter/BurstCompareView.vue'

export default {
  name: 'BurstSetView',
  components: { ImageViewer, BurstCompareView },
  props: {
    burstSetId: { type: Number, required: true },
    activeSession: { type: Object, default: null }
  },
  emits: ['close', 'set-changed', 'create-composite'],
  data() {
    return {
      burstSet: null,
      files: [],
      thumbnails: {},
      keeperThumb: null,
      keeperExif: { shutterSpeed: null, aperture: null, iso: null },
      selectedFileId: null,
      editingName: false,
      nameDraft: '',
      confirmDisband: false,
      addFramesOpen: false,
      availableFiles: [],
      availableThumbs: {},
      selectedToAdd: [],
      viewerOpen: false,
      viewerIndex: 0,
      compareOpen: false
    }
  },
  computed: {
    viewerImage() {
      const f = this.files[this.viewerIndex]
      return f ? { name: f.filename, path: f.full_path, size: f.size_bytes } : {}
    },
    keeperFile() {
      if (!this.burstSet?.kept_file_id) return null
      return this.files.find(f => f.id === this.burstSet.kept_file_id) || null
    }
  },
  watch: {
    burstSetId: {
      immediate: true,
      async handler() {
        await this.loadBurstSet()
        await this.loadFiles()
      }
    },
    keeperFile: {
      immediate: true,
      async handler(f) {
        if (!f) { this.keeperThumb = null; this.keeperExif = { shutterSpeed: null, aperture: null, iso: null }; return }
        this.keeperThumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 300, height: 200 })
        const meta = await window.api.invoke('img:getFullMetadata', f.full_path)
        if (meta && !meta.error) {
          this.keeperExif = {
            shutterSpeed: meta.exif?.shutterSpeed || null,
            aperture: meta.exif?.aperture || null,
            iso: meta.exif?.iso || null
          }
        }
      }
    }
  },
  methods: {
    async loadBurstSet() {
      if (!this.activeSession) return
      const sets = await window.api.invoke('burst:listSets', this.activeSession.id)
      this.burstSet = Array.isArray(sets) ? sets.find(s => s.id === this.burstSetId) || null : null
    },
    async loadFiles() {
      const files = await window.api.invoke('burst:listFiles', this.burstSetId)
      this.files = Array.isArray(files) ? files : []
      this.selectedFileId = null
      for (const f of this.files) {
        if (this.thumbnails[f.id]) continue
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 200, height: 133 })
        this.thumbnails = { ...this.thumbnails, [f.id]: thumb }
      }
    },
    statusLabel(status) {
      return { pending: 'Pending', reviewed: 'Reviewed ✓', composited: 'Composited', archived: 'Archived' }[status] || status || ''
    },
    startEditName() {
      this.nameDraft = this.burstSet?.name || ''
      this.editingName = true
      this.$nextTick(() => this.$refs.nameInput?.focus())
    },
    async saveName() {
      this.editingName = false
      const trimmed = this.nameDraft.trim()
      if (!trimmed || trimmed === this.burstSet?.name) return
      await window.api.invoke('burst:updateSet', this.burstSetId, { name: trimmed })
      this.burstSet = { ...this.burstSet, name: trimmed }
      this.$emit('set-changed')
    },
    selectFrame(fileId, index) {
      this.selectedFileId = fileId
      this.viewerIndex = index
      this.viewerOpen = true
    },
    openCompare() {
      this.compareOpen = true
    },
    closeCompare() {
      this.compareOpen = false
    },
    async handleKept() {
      this.compareOpen = false
      await this.loadBurstSet()
      await this.loadFiles()
      this.$emit('set-changed')
    },
    createComposite() {
      if (this.burstSet?.status === 'pending') return
      this.$emit('create-composite', this.burstSetId)
    },
    async removeSelected() {
      if (!this.selectedFileId) return
      await window.api.invoke('burst:removeFile', this.burstSetId, this.selectedFileId)
      this.files = this.files.filter(f => f.id !== this.selectedFileId)
      this.selectedFileId = null
      await this.loadBurstSet()
      this.$emit('set-changed')
    },
    async disbandSet() {
      await window.api.invoke('burst:deleteSet', this.burstSetId)
      this.confirmDisband = false
      this.$emit('set-changed')
      this.$emit('close')
    },
    async openAddFrames() {
      this.selectedToAdd = []
      if (!this.activeSession) return
      const files = await window.api.invoke('file:listBySession', this.activeSession.id, {})
      this.availableFiles = Array.isArray(files) ? files.filter(f => !f.burst_set_id) : []
      this.addFramesOpen = true
      for (const f of this.availableFiles) {
        if (this.availableThumbs[f.id]) continue
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 48, height: 36 })
        this.availableThumbs = { ...this.availableThumbs, [f.id]: thumb }
      }
    },
    async confirmAddFrames() {
      for (const fileId of this.selectedToAdd) {
        await window.api.invoke('burst:addFile', this.burstSetId, fileId)
      }
      this.addFramesOpen = false
      await this.loadBurstSet()
      await this.loadFiles()
      this.$emit('set-changed')
    }
  }
}
</script>

<style scoped>
.burst-set-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

/* ── Header ───────────────────────────────────── */
.burst-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.burst-header-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.burst-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  cursor: text;
  margin: 0;
}

.burst-name-input {
  font-size: 16px;
  font-weight: 600;
  background: var(--surface2);
  border: 1px solid var(--accent);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 8px;
  outline: none;
  font-family: inherit;
  flex: 1;
  max-width: 400px;
}

.status-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.status-pending    { background: var(--surface2); color: var(--text2); }
.status-reviewed   { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
.status-composited { background: rgba(171, 122, 220, 0.15); color: #ab7adc; }
.status-archived   { background: var(--surface2); color: var(--text2); opacity: 0.6; }

.burst-header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text2);
}

.burst-header-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.btn:hover { background: var(--surface-hover); }
.btn:disabled { opacity: 0.4; cursor: default; }

.action-btn.confirmed-btn {
  border-color: #66bb6a;
  color: #66bb6a;
  opacity: 1;
}

.btn-danger { border-color: #ef5350; color: #ef5350; }
.btn-danger:hover { background: rgba(239, 83, 80, 0.12); }

.btn-accent {
  background: var(--accent);
  color: #1a1a1a;
  border-color: var(--accent);
  font-weight: 600;
}
.btn-accent:hover:not(:disabled) { opacity: 0.88; }
.btn-accent:disabled { opacity: 0.4; cursor: default; }

/* ── Frame strip ──────────────────────────────── */
.frame-strip {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  flex-shrink: 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.frame-thumb {
  position: relative;
  width: 200px;
  height: 133px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--surface2);
}
.frame-thumb.selected {
  border-color: var(--accent);
}
.frame-thumb.deleted img {
  opacity: 0.4;
}

.frame-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.frame-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface2);
}

.frame-number {
  position: absolute;
  bottom: 4px;
  right: 6px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}

.keeper-crown {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 18px;
}

.deleted-x {
  position: absolute;
  top: 4px;
  left: 4px;
  color: #ef5350;
  background: rgba(0, 0, 0, 0.5);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.frame-strip-empty {
  font-size: 12px;
  color: var(--text2);
  padding: 20px;
}

/* ── Keeper display ───────────────────────────── */
.keeper-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.keeper-label {
  font-size: 12px;
  color: var(--text2);
  flex-shrink: 0;
}

.keeper-thumb {
  width: 300px;
  height: 200px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}

.keeper-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.keeper-filename {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.keeper-exif {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text2);
}

/* ── Controls ─────────────────────────────────── */
.burst-controls {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  flex-shrink: 0;
}

/* ── Modals ───────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  max-width: 380px;
  width: 90%;
}

.modal h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.modal p {
  font-size: 13px;
  color: var(--text2);
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.add-frames-modal {
  max-width: 440px;
}

.add-frames-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
}

.add-frames-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.add-frames-row:hover { background: var(--surface2); }

.add-frames-thumb {
  width: 40px;
  height: 30px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.add-frames-thumb-placeholder {
  width: 40px;
  height: 30px;
  border-radius: 3px;
  background: var(--surface2);
  flex-shrink: 0;
}

.add-frames-name {
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-frames-empty {
  font-size: 12px;
  color: var(--text2);
  text-align: center;
  padding: 20px;
}
</style>
