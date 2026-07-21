<template>
  <div class="pano-set-view">

    <!-- Header -->
    <div class="pano-header">
      <div class="pano-header-top">
        <input
          v-if="editingName"
          ref="nameInput"
          v-model="nameDraft"
          class="pano-name-input"
          @blur="saveName"
          @keydown.enter="$event.target.blur()"
          @keydown.esc="editingName = false"
        />
        <h2 v-else class="pano-name" title="Click to rename" @click="startEditName">{{ panoSet?.name || 'Panorama Set' }}</h2>
        <span class="status-pill" :class="'status-' + panoSet?.status">{{ statusLabel(panoSet?.status) }}</span>
      </div>
      <div class="pano-header-meta">
        <span>{{ files.length }} frame{{ files.length === 1 ? '' : 's' }}</span>
        <span class="meta-dot">·</span>
        <span>{{ timeSpanText }}</span>
      </div>
      <div class="pano-header-actions">
        <button
          class="btn action-btn"
          :class="{ 'confirmed-btn': panoSet?.status !== 'pending' }"
          :disabled="panoSet?.status !== 'pending'"
          @click="confirmSet"
        >{{ panoSet?.status === 'pending' ? 'Confirm set' : 'Confirmed ✓' }}</button>
        <button
          class="btn action-btn"
          :disabled="panoSet?.status === 'pending'"
          :title="panoSet?.status === 'pending' ? 'Confirm the set first' : ''"
          @click="openInHugin"
        >Open in Hugin</button>
        <button class="btn" @click="$emit('close')">Back to Gallery</button>
      </div>
    </div>

    <!-- Frame strip -->
    <div class="frame-strip">
      <div
        v-for="(f, i) in files"
        :key="f.id"
        class="frame-thumb"
        :class="{ selected: selectedFileId === f.id }"
        draggable="true"
        @click="selectFrame(f.id, i)"
        @dragstart="onDragStart(i)"
        @dragover.prevent
        @drop="onDrop(i)"
      >
        <img v-if="thumbnails[f.id]" :src="thumbnails[f.id]" />
        <div v-else class="frame-thumb-placeholder"></div>
        <span class="frame-number">{{ i + 1 }}</span>
      </div>
      <div v-if="!files.length" class="frame-strip-empty">No frames in this set</div>
    </div>

    <!-- Notes -->
    <div class="pano-notes">
      <MarkdownEditor
        v-model="localNotes"
        placeholder="Add notes about this panorama set…"
        minHeight="48px"
        :saveStatus="notesSaveStatus"
        @save="onNotesSave"
      />
    </div>

    <!-- Controls -->
    <div class="pano-controls">
      <button class="btn" @click="openAddFrames">Add frames</button>
      <button class="btn" :disabled="!selectedFileId" @click="removeSelected">Remove selected</button>
      <button class="btn btn-danger" @click="confirmDisband = true">Disband set</button>
    </div>

    <!-- Disband confirmation -->
    <div v-if="confirmDisband" class="modal-overlay" @click.self="confirmDisband = false">
      <div class="modal">
        <h4>Disband this panorama set?</h4>
        <p>Files stay on disk and remain in the session — only the panorama grouping is removed. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn" @click="confirmDisband = false">Cancel</button>
          <button class="btn btn-danger" @click="disbandSet">Disband</button>
        </div>
      </div>
    </div>

    <!-- Add frames modal -->
    <div v-if="addFramesOpen" class="modal-overlay" @click.self="addFramesOpen = false">
      <div class="modal add-frames-modal">
        <h4>Add frames to "{{ panoSet?.name }}"</h4>
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

  </div>
</template>

<script>
import ImageViewer from './ImageViewer.vue'
import MarkdownEditor from '../../components/MarkdownEditor.vue'

export default {
  name: 'PanoSetView',
  components: { ImageViewer, MarkdownEditor },
  props: {
    panoSetId: { type: Number, required: true },
    activeSession: { type: Object, default: null }
  },
  emits: ['close', 'set-changed', 'open-in-hugin'],
  data() {
    return {
      panoSet: null,
      files: [],
      thumbnails: {},
      selectedFileId: null,
      editingName: false,
      nameDraft: '',
      dragIndex: null,
      confirmDisband: false,
      addFramesOpen: false,
      availableFiles: [],
      availableThumbs: {},
      selectedToAdd: [],
      viewerOpen: false,
      viewerIndex: 0,
      localNotes: '',
      notesSaveStatus: '',
      notesSaveTimer: null
    }
  },
  computed: {
    viewerImage() {
      const f = this.files[this.viewerIndex]
      return f ? { name: f.filename, path: f.full_path, size: f.size_bytes } : {}
    },
    timeSpanText() {
      const ts = this.files.map(f => f.exif_ts).filter(t => t != null)
      if (ts.length < 2) return this.files.length ? 'single frame' : '—'
      const spanSec = (Math.max(...ts) - Math.min(...ts)) / 1000
      if (spanSec < 60) return `${spanSec.toFixed(0)}s span`
      const min = Math.floor(spanSec / 60)
      const sec = Math.round(spanSec % 60)
      return sec > 0 ? `${min}m ${sec}s span` : `${min}m span`
    }
  },
  watch: {
    panoSetId: {
      immediate: true,
      async handler() {
        await this.loadPanoSet()
        await this.loadFiles()
      }
    }
  },
  methods: {
    async loadPanoSet() {
      if (!this.activeSession) return
      const sets = await window.api.invoke('pano:listSets', this.activeSession.id)
      this.panoSet = Array.isArray(sets) ? sets.find(s => s.id === this.panoSetId) || null : null
      this.localNotes = this.panoSet?.notes || ''
    },
    async loadFiles() {
      const files = await window.api.invoke('pano:listFiles', this.panoSetId)
      this.files = Array.isArray(files) ? files : []
      this.selectedFileId = null
      for (const f of this.files) {
        if (this.thumbnails[f.id]) continue
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 240, height: 160 })
        this.thumbnails = { ...this.thumbnails, [f.id]: thumb }
      }
    },
    statusLabel(status) {
      return { pending: 'Pending', confirmed: 'Confirmed', stitched: 'Stitched', archived: 'Archived' }[status] || status || ''
    },
    startEditName() {
      this.nameDraft = this.panoSet?.name || ''
      this.editingName = true
      this.$nextTick(() => this.$refs.nameInput?.focus())
    },
    async saveName() {
      this.editingName = false
      const trimmed = this.nameDraft.trim()
      if (!trimmed || trimmed === this.panoSet?.name) return
      await window.api.invoke('pano:updateSet', this.panoSetId, { name: trimmed })
      this.panoSet = { ...this.panoSet, name: trimmed }
      this.$emit('set-changed')
    },
    async confirmSet() {
      if (this.panoSet?.status !== 'pending') return
      await window.api.invoke('pano:updateSet', this.panoSetId, { status: 'confirmed' })
      this.panoSet = { ...this.panoSet, status: 'confirmed' }
      this.$emit('set-changed')
    },
    openInHugin() {
      if (this.panoSet?.status === 'pending') return
      this.$emit('open-in-hugin', this.panoSetId)
    },
    selectFrame(fileId, index) {
      this.selectedFileId = fileId
      this.viewerIndex = index
      this.viewerOpen = true
    },
    onDragStart(index) {
      this.dragIndex = index
    },
    async onDrop(targetIndex) {
      if (this.dragIndex === null || this.dragIndex === targetIndex) return
      const reordered = [...this.files]
      const [moved] = reordered.splice(this.dragIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      this.files = reordered
      this.dragIndex = null
      await window.api.invoke('pano:reorderFrames', this.panoSetId, this.files.map(f => f.id))
    },
    async removeSelected() {
      if (!this.selectedFileId) return
      await window.api.invoke('pano:removeFile', this.panoSetId, this.selectedFileId)
      this.files = this.files.filter(f => f.id !== this.selectedFileId)
      this.selectedFileId = null
      await this.loadPanoSet()
      this.$emit('set-changed')
    },
    async disbandSet() {
      await window.api.invoke('pano:deleteSet', this.panoSetId)
      this.confirmDisband = false
      this.$emit('set-changed')
      this.$emit('close')
    },
    async openAddFrames() {
      this.selectedToAdd = []
      if (!this.activeSession) return
      const files = await window.api.invoke('file:listBySession', this.activeSession.id, {})
      this.availableFiles = Array.isArray(files) ? files.filter(f => !f.pano_set_id) : []
      this.addFramesOpen = true
      for (const f of this.availableFiles) {
        if (this.availableThumbs[f.id]) continue
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 48, height: 36 })
        this.availableThumbs = { ...this.availableThumbs, [f.id]: thumb }
      }
    },
    async confirmAddFrames() {
      for (const fileId of this.selectedToAdd) {
        await window.api.invoke('pano:addFile', this.panoSetId, fileId)
      }
      this.addFramesOpen = false
      await this.loadPanoSet()
      await this.loadFiles()
      this.$emit('set-changed')
    },
    onNotesSave(content) {
      clearTimeout(this.notesSaveTimer)
      this.notesSaveStatus = 'saving'
      this.notesSaveTimer = setTimeout(async () => {
        await window.api.invoke('pano:updateSet', this.panoSetId, { notes: content })
        this.panoSet = { ...this.panoSet, notes: content }
        this.notesSaveStatus = 'saved'
        setTimeout(() => { this.notesSaveStatus = '' }, 2000)
      }, 800)
    }
  }
}
</script>

<style scoped>
/* TODO Branding-B: migrate to tokens.css variables */
.pano-set-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

/* ── Header ───────────────────────────────────── */
.pano-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pano-header-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pano-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  cursor: text;
  margin: 0;
}

.pano-name-input {
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
.status-pending   { background: var(--surface2); color: var(--text2); }
.status-confirmed { background: rgba(74, 144, 217, 0.15); color: #4a90d9; }
.status-stitched  { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
.status-archived  { background: var(--surface2); color: var(--text2); opacity: 0.6; }

.pano-header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text2);
}

.meta-dot { opacity: 0.4; }

.pano-header-actions {
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
  width: 240px;
  height: 160px;
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

.frame-strip-empty {
  font-size: 12px;
  color: var(--text2);
  padding: 20px;
}

/* ── Notes ────────────────────────────────────── */
.pano-notes {
  padding: 12px 20px 0;
  flex-shrink: 0;
}

/* ── Controls ─────────────────────────────────── */
.pano-controls {
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
