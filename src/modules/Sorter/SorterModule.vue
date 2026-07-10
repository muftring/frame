<template>
  <div class="sorter">
    <!-- Toolbar -->
    <div class="toolbar">
      <button v-if="!sessionMode" class="btn" @click="openFolder">Open Folder</button>
      <span v-if="sessionMode" class="session-label">{{ session.name }}</span>
      <span v-else-if="folderPath" class="folder-name" :title="folderPath">{{ folderDisplayName }}</span>
      <div class="toolbar-stats" v-if="images.length">
        <span>{{ images.length }} total</span>
        <span class="stat-sep">|</span>
        <span class="stat-kept">{{ keptCount }} kept</span>
        <span class="stat-sep">|</span>
        <span class="stat-trashed">{{ trashedCount }} deleted</span>
      </div>
      <div class="toolbar-spacer"></div>
      <button
        v-if="sessionMode && deletedNotMoved.length"
        class="btn btn-cleanup"
        @click="showCleanupModal = true"
      >Clean up ({{ deletedNotMoved.length }})</button>
      <button v-if="images.length" class="btn" :class="{ active: trashPanelOpen }" @click="trashPanelOpen = !trashPanelOpen">
        {{ sessionMode ? 'Deleted' : 'Trash' }}{{ trashedCount ? ' (' + trashedCount + ')' : '' }}
      </button>
    </div>

    <!-- Resume banner (session mode only) -->
    <div v-if="showResumePrompt" class="resume-banner">
      <span>Resume from where you left off?</span>
      <button class="btn-sm" @click="doResume">Resume</button>
      <button class="btn-sm" @click="showResumePrompt = false">Start from beginning</button>
    </div>

    <!-- Main area -->
    <div class="main-area" v-if="images.length">
      <!-- Filmstrip -->
      <div class="filmstrip" ref="filmstrip">
        <div
          v-for="(img, i) in images"
          :key="img.path"
          class="film-thumb"
          :class="{ active: i === currentIndex, trashed: img.status === 'trashed', kept: img.status === 'kept' }"
          @click="currentIndex = i"
        >
          <img v-if="img.thumbnail" :src="img.thumbnail" />
          <div v-else class="thumb-placeholder"></div>
          <div v-if="img.status === 'trashed'" class="thumb-del-badge">del</div>
          <div class="thumb-tag-badges" v-if="img.tags && img.tags.length">
            <span
              v-for="tagName in img.tags.slice(0, 2)"
              :key="tagName"
              class="thumb-tag-badge"
              :style="{ color: tagColor(tagName) }"
            >{{ tagBadgeText(tagName) }}</span>
          </div>
        </div>
      </div>

      <!-- Viewer -->
      <div class="viewer">
        <div class="viewer-image-wrap">
          <img
            v-if="currentImage"
            :key="viewerImageUrl"
            :src="viewerImageUrl"
            class="viewer-image"
            :class="{ 'bw-active': bwPreviewActive }"
            @error="handleImageError"
          />
          <div v-if="bwPreviewActive" class="bw-preview-badge">B&amp;W Preview</div>
          <div v-if="currentImage && currentImage.status === 'trashed'" class="trashed-overlay">
            <span>Deleted</span>
          </div>
        </div>
        <div class="viewer-info" v-if="currentImage">
          <span class="viewer-filename">{{ currentImage.name }}</span>
          <span v-if="sessionMode && currentImage.groupLabel" class="viewer-group">{{ currentImage.groupLabel }}</span>
          <span class="viewer-progress-text">{{ currentIndex + 1 }} / {{ images.length }}</span>
        </div>
        <div class="viewer-progress-bar" v-if="images.length">
          <div class="viewer-progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- Deleted/Trash panel -->
      <transition name="slide">
        <div v-if="trashPanelOpen" class="trash-panel">
          <div class="trash-header">
            <h4>{{ sessionMode ? 'Deleted' : 'Trash' }} ({{ trashedCount }})</h4>
            <button class="btn-sm" @click="trashPanelOpen = false">Close</button>
          </div>
          <div class="trash-actions" v-if="trashedCount && !sessionMode">
            <button class="btn-sm" @click="restoreAll">Restore All</button>
            <button class="btn-sm btn-danger" @click="confirmEmptyTrash = true">Empty Trash</button>
          </div>
          <div class="trash-list">
            <div v-for="img in trashedImages" :key="img.path" class="trash-item">
              <span class="trash-item-name">{{ img.name }}</span>
              <button class="btn-sm" @click="restore(img)">Restore</button>
            </div>
          </div>
          <div v-if="!trashedCount" class="trash-empty">No deleted images</div>
        </div>
      </transition>
    </div>

    <!-- Empty state -->
    <div class="empty-state-full" v-if="!images.length && !loading">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="10" width="36" height="28" rx="3" />
        <path d="M6 18h36" />
        <circle cx="24" cy="31" r="5" />
      </svg>
      <div class="empty-title">No images loaded</div>
      <div class="empty-hint" v-if="sessionMode">No files found in this session</div>
      <div class="empty-hint" v-else>Open a folder to start sorting photos</div>
    </div>
    <div class="empty-state-full" v-if="loading">
      <div class="spinner"></div>
      <div class="empty-hint">Loading images...</div>
    </div>

    <!-- Action bar -->
    <div class="action-bar" v-if="images.length">
      <button class="btn action-btn" @click="prev" :disabled="currentIndex === 0">Prev</button>
      <button
        class="btn action-btn bw-toggle-btn"
        :class="{ active: bwPreviewActive }"
        @click="toggleBwPreview"
        title="Toggle B&amp;W preview (P)"
      >
        <svg class="bw-icon" viewBox="0 0 16 16" width="14" height="14" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
        </svg>
        B&amp;W
      </button>
      <button class="btn action-btn keep-btn" @click="keep">Keep (K)</button>
      <button class="btn action-btn delete-btn" @click="doTrash">Delete (D)</button>
      <button class="btn action-btn" @click="next" :disabled="currentIndex >= images.length - 1">Next</button>
      <button
        v-if="sessionMode && allReviewed && !sortAlreadyComplete"
        class="btn action-btn complete-btn"
        @click="markSortComplete"
      >Mark Sort Complete</button>
    </div>

    <!-- Confirm empty trash modal (non-session mode) -->
    <div v-if="confirmEmptyTrash" class="modal-overlay" @click.self="confirmEmptyTrash = false">
      <div class="modal">
        <h4>Empty Trash?</h4>
        <p>Permanently delete {{ trashedCount }} files. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn" @click="confirmEmptyTrash = false">Cancel</button>
          <button class="btn btn-danger" @click="emptyTrash">Delete Permanently</button>
        </div>
      </div>
    </div>

    <!-- Clean up deleted files modal (session mode) -->
    <div v-if="showCleanupModal" class="modal-overlay" @click.self="showCleanupModal = false">
      <div class="modal">
        <h4>Move {{ deletedNotMoved.length }} deleted {{ deletedNotMoved.length === 1 ? 'file' : 'files' }} to trash?</h4>
        <p>
          This will free approximately {{ formatSize(cleanupTotalSize) }}.<br>
          You can still recover them from .frame-trash until you empty the trash.
        </p>
        <div class="modal-actions">
          <button class="btn" @click="showCleanupModal = false" :disabled="cleaningUp">Keep on disk</button>
          <button class="btn btn-danger" @click="doCleanup" :disabled="cleaningUp">
            {{ cleaningUp ? 'Moving…' : 'Move to trash' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SorterModule',
  inject: ['toast', 'session', 'updatePipeline'],
  props: {
    initialFolder: { type: String, default: null }
  },
  emits: ['navigate'],
  data() {
    return {
      folderPath: null,
      images: [],
      currentIndex: 0,
      loading: false,
      trashPanelOpen: false,
      confirmEmptyTrash: false,
      showCleanupModal: false,
      cleaningUp: false,
      showResumePrompt: false,
      resumeFileId: null,
      tagDefinitions: [],
      bwPreviewActive: false
    }
  },
  computed: {
    sessionMode() {
      return !!this.session?.id
    },
    currentImage() {
      return this.images[this.currentIndex] || null
    },
    keptCount() {
      return this.images.filter(i => i.status === 'kept').length
    },
    trashedCount() {
      return this.images.filter(i => i.status === 'trashed').length
    },
    trashedImages() {
      return this.images.filter(i => i.status === 'trashed')
    },
    deletedNotMoved() {
      return this.images.filter(i => i.status === 'trashed' && !i.trashedAt)
    },
    cleanupTotalSize() {
      return this.deletedNotMoved.reduce((sum, i) => sum + (i.size || 0), 0)
    },
    progressPercent() {
      if (!this.images.length) return 0
      return ((this.currentIndex + 1) / this.images.length) * 100
    },
    viewerImageUrl() {
      if (!this.currentImage) return ''
      return 'local-file://' + encodeURI(this.currentImage.path)
    },
    folderDisplayName() {
      if (!this.folderPath) return ''
      const parts = this.folderPath.replace(/\\/g, '/').split('/')
      return parts[parts.length - 1] || this.folderPath
    },
    allReviewed() {
      return this.images.length > 0 && !this.images.some(i => i.status === 'pending')
    },
    sortAlreadyComplete() {
      return !!this.session?.pipelineState?.sort_complete
    },
    tagShortcutMap() {
      const map = {}
      for (const def of this.tagDefinitions) {
        if (def.shortcut) map[def.shortcut.toLowerCase()] = def
      }
      return map
    }
  },
  watch: {
    currentIndex() {
      this.$nextTick(() => {
        const el = this.$refs.filmstrip
        if (!el) return
        const active = el.querySelector('.film-thumb.active')
        if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
      this.scheduleLastFileUpdate()
    }
  },
  async mounted() {
    this._keyHandler = this.handleKeydown.bind(this)
    window.addEventListener('keydown', this._keyHandler)
    const defs = await window.api.invoke('tag:listDefinitions')
    if (Array.isArray(defs)) this.tagDefinitions = defs
    if (this.session?.id) {
      await this.loadSessionFiles()
    } else if (this.initialFolder) {
      await this.loadFolder(this.initialFolder)
    }
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
    clearTimeout(this._lastFileTimer)
  },
  methods: {
    async loadSessionFiles() {
      this.loading = true
      this.images = []
      const groups = await window.api.invoke('group:list', this.session.id)
      if (!Array.isArray(groups)) { this.loading = false; return }

      const allFiles = []
      for (const group of groups) {
        const files = await window.api.invoke('file:listByGroup', group.id)
        if (Array.isArray(files)) {
          for (const f of files) {
            allFiles.push({
              fileId: f.id,
              name: f.filename,
              path: f.full_path,
              size: f.size_bytes || 0,
              thumbnail: null,
              status: f.status === 'deleted' ? 'trashed' : (f.status === 'kept' ? 'kept' : 'pending'),
              trashedAt: f.trashed_at || null,
              groupId: group.id,
              groupLabel: group.label,
              tags: (() => { try { return JSON.parse(f.tags || '[]') } catch { return [] } })()
            })
          }
        }
      }

      this.images = allFiles
      this.loading = false

      const lastFileId = this.session.pipelineState?.last_file_id
      if (lastFileId) {
        this.resumeFileId = lastFileId
        this.showResumePrompt = true
      }

      this.loadThumbnails()
    },
    doResume() {
      const idx = this.images.findIndex(i => i.fileId === this.resumeFileId)
      if (idx >= 0) this.currentIndex = idx
      this.showResumePrompt = false
    },
    async markSortComplete() {
      await this.updatePipeline('sort', true)
      this.toast('Sort complete! All files reviewed.', 'success')
    },
    scheduleLastFileUpdate() {
      clearTimeout(this._lastFileTimer)
      if (!this.sessionMode) return
      const img = this.currentImage
      if (!img?.fileId) return
      this._lastFileTimer = setTimeout(() => {
        window.api.invoke('pipeline:setLastFile', this.session.id, img.fileId)
      }, 500)
    },
    async openFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) await this.loadFolder(folder)
    },
    async loadFolder(folderPath) {
      this.loading = true
      this.folderPath = folderPath
      this.currentIndex = 0
      this.trashPanelOpen = false
      this.confirmEmptyTrash = false

      const files = await window.api.invoke('fs:scanFolder', folderPath)
      if (files.error || !files.length) {
        this.images = []
        this.loading = false
        return
      }

      this.images = files.map(f => ({
        fileId: null,
        name: f.name,
        path: f.path,
        size: f.size,
        thumbnail: null,
        status: 'pending',
        trashedAt: null,
        groupId: null,
        groupLabel: null,
        tags: []
      }))

      this.loading = false
      this.loadThumbnails()
    },
    async loadThumbnails() {
      for (let i = 0; i < this.images.length; i++) {
        if (this.images[i].thumbnail) continue
        const thumb = await window.api.invoke('img:thumbnail', this.images[i].path, { width: 100, height: 75 })
        this.images[i].thumbnail = thumb
      }
    },
    keep() {
      if (!this.currentImage) return
      this.currentImage.status = 'kept'
      if (this.sessionMode && this.currentImage.fileId) {
        window.api.invoke('file:updateStatus', this.currentImage.fileId, 'kept')
      }
      this.advanceNext()
    },
    async doTrash() {
      if (!this.currentImage) return
      if (this.currentImage.status === 'trashed') {
        this.advanceNext()
        return
      }
      if (this.sessionMode) {
        // DB-only soft delete — file stays on disk in its event folder
        this.currentImage.status = 'trashed'
        if (this.currentImage.fileId) {
          window.api.invoke('file:updateStatus', this.currentImage.fileId, 'deleted')
        }
      } else {
        const trashFolder = this.folderPath
          ? this.folderPath + '/.frame-trash'
          : this.currentImage.path.replace(/\/[^/]+$/, '') + '/.frame-trash'
        const result = await window.api.invoke('fs:moveToTrash', this.currentImage.path, trashFolder)
        if (result.success) {
          this.currentImage.status = 'trashed'
          this.currentImage.path = result.trashedPath
        } else if (result.error) {
          this.toast(result.error, 'error')
          return
        }
      }
      this.advanceNext()
    },
    async restore(img) {
      if (this.sessionMode) {
        img.status = 'pending'
        if (img.fileId) {
          window.api.invoke('file:updateStatus', img.fileId, 'unreviewed')
        }
        return
      }
      const trashedPath = img.path
      const result = await window.api.invoke('fs:restoreFromTrash', trashedPath, img.path)
      if (result.success) {
        img.status = 'pending'
      }
    },
    async restoreAll() {
      const trashed = [...this.trashedImages]
      for (const img of trashed) await this.restore(img)
    },
    async emptyTrash() {
      const trashFolder = this.folderPath + '/.frame-trash'
      await window.api.invoke('fs:emptyTrash', trashFolder)
      this.images = this.images.filter(i => i.status !== 'trashed')
      this.confirmEmptyTrash = false
      if (this.currentIndex >= this.images.length) {
        this.currentIndex = Math.max(0, this.images.length - 1)
      }
    },
    async doCleanup() {
      this.cleaningUp = true
      const toMove = [...this.deletedNotMoved]
      for (const img of toMove) {
        const trashFolder = img.path.replace(/\/[^/]+$/, '') + '/.frame-trash'
        const result = await window.api.invoke('fs:moveToTrash', img.path, trashFolder)
        if (result.success) {
          img.trashedAt = Date.now()
          img.path = result.trashedPath
          if (img.fileId) {
            await window.api.invoke('file:updateTrashedPath', img.fileId, result.trashedPath, img.trashedAt)
          }
        }
      }
      this.cleaningUp = false
      this.showCleanupModal = false
      this.toast(`${toMove.length} deleted file${toMove.length !== 1 ? 's' : ''} moved to trash`, 'success')
    },
    formatSize(bytes) {
      const mb = bytes / (1024 * 1024)
      if (mb >= 1000) return (mb / 1024).toFixed(1) + ' GB'
      return mb.toFixed(1) + ' MB'
    },
    prev() {
      if (this.currentIndex > 0) this.currentIndex--
    },
    next() {
      if (this.currentIndex < this.images.length - 1) this.currentIndex++
    },
    advanceNext() {
      if (this.currentIndex < this.images.length - 1) this.currentIndex++
    },
    handleKeydown(e) {
      if (this.confirmEmptyTrash || this.showCleanupModal) return
      switch (e.key) {
        case 'ArrowLeft': this.prev(); e.preventDefault(); break
        case 'ArrowRight': this.next(); e.preventDefault(); break
        case 'k': case 'K': this.keep(); break
        case 'd': case 'D': this.doTrash(); break
        case 'Escape': this.trashPanelOpen = false; break
        case 'p': case 'P':
          if (!this.tagShortcutsSuppressed(e)) this.toggleBwPreview()
          break
        default: {
          const tagDef = this.tagShortcutMap[e.key.toLowerCase()]
          if (tagDef && !this.tagShortcutsSuppressed(e)) this.toggleFileTag(tagDef)
        }
      }
    },
    // B/P shortcuts additionally suppress while typing in a field or with
    // the trash panel open, unlike the existing Keep/Delete shortcuts.
    tagShortcutsSuppressed(e) {
      if (this.trashPanelOpen) return true
      const target = e.target
      return !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
    },
    toggleBwPreview() {
      this.bwPreviewActive = !this.bwPreviewActive
    },
    async toggleFileTag(tagDef) {
      if (!this.currentImage?.fileId) return
      const result = await window.api.invoke('tag:toggleOnFile', this.currentImage.fileId, tagDef.name)
      if (!result || result.error) return
      this.currentImage.tags = result.tags
      const verb = result.added ? 'Added' : 'Removed'
      const color = result.added ? tagDef.color : 'var(--text2)'
      this.toast(`${verb}: "${tagDef.label}"`, 'info', color)
    },
    tagColor(tagName) {
      return this.tagDefinitions.find(d => d.name === tagName)?.color || '#888888'
    },
    tagBadgeText(tagName) {
      if (tagName === 'bw-candidate') return 'B&W'
      return this.tagDefinitions.find(d => d.name === tagName)?.label || tagName
    },
    handleImageError(e) {
      if (this.currentImage && this.currentImage.thumbnail) {
        e.target.src = this.currentImage.thumbnail
      }
    }
  }
}
</script>

<style scoped>
.sorter {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

/* Toolbar */
.toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.folder-name {
  font-size: 13px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.toolbar-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text2);
}

.stat-sep { color: var(--border); }
.stat-kept { color: #66bb6a; }
.stat-trashed { color: #ef5350; }
.toolbar-spacer { flex: 1; }

/* Resume banner */
.resume-banner {
  background: rgba(201, 168, 76, 0.1);
  border-bottom: 1px solid rgba(201, 168, 76, 0.25);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--accent);
  flex-shrink: 0;
}

/* Buttons */
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
.btn:hover { background: var(--surface-hover); border-color: rgba(255,255,255,0.15); }
.btn:disabled { opacity: 0.4; cursor: default; }
.btn.active { border-color: var(--accent); color: var(--accent); }

.btn-sm {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
}
.btn-sm:hover { background: var(--surface-hover); }

.btn-danger { border-color: #ef5350; color: #ef5350; }
.btn-danger:hover { background: rgba(239,83,80,0.12); }

.btn-cleanup {
  border-color: rgba(239, 83, 80, 0.45);
  color: #ef5350;
  font-size: 11px;
  padding: 5px 10px;
}
.btn-cleanup:hover { background: rgba(239,83,80,0.1); }

/* Main area */
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* Filmstrip */
.filmstrip {
  width: 110px;
  min-width: 110px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filmstrip::-webkit-scrollbar { width: 4px; }
.filmstrip::-webkit-scrollbar-track { background: transparent; }
.filmstrip::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 2px; }

.film-thumb {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border-left: 3px solid transparent;
  flex-shrink: 0;
  transition: border-color 0.15s, opacity 0.15s;
}

.film-thumb img {
  display: block;
  width: 100%;
  height: 68px;
  object-fit: cover;
}

.film-thumb.active {
  border-left-color: var(--accent);
}

.film-thumb.trashed {
  opacity: 0.35;
}

.film-thumb.kept {
  border-left-color: #66bb6a;
}

.film-thumb.active.kept {
  border-left-color: var(--accent);
}

.thumb-placeholder {
  width: 100%;
  height: 68px;
  background: var(--surface2);
}

.thumb-del-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 9px;
  font-weight: 700;
  color: #ef5350;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.thumb-tag-badges {
  position: absolute;
  bottom: 2px;
  left: 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.thumb-tag-badge {
  font-size: 10px;
  padding: 3px 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.65);
  line-height: 1;
  white-space: nowrap;
}

/* Viewer */
.viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg);
  overflow: hidden;
}

.viewer-image-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
  overflow: hidden;
  padding: 12px;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  transition: filter 0.15s ease;
}

.viewer-image.bw-active {
  filter: grayscale(100%);
}

.bw-preview-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 3px;
  pointer-events: none;
}

.trashed-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.trashed-overlay span {
  font-size: 1.5rem;
  font-weight: 600;
  color: #ef5350;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.viewer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 20px 4px;
  flex-shrink: 0;
}

.viewer-filename {
  font-size: 12px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.viewer-group {
  font-size: 11px;
  color: var(--accent);
  opacity: 0.8;
}

.viewer-progress-text {
  font-size: 12px;
  color: var(--text2);
}

.viewer-progress-bar {
  width: 100%;
  height: 3px;
  background: var(--surface2);
  flex-shrink: 0;
}

.viewer-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s ease;
}

/* Action bar */
.action-bar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.action-btn {
  padding: 8px 22px;
  font-size: 13px;
  font-weight: 500;
}

.bw-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text2);
}

.bw-toggle-btn.active {
  background: #888888;
  border-color: #aaaaaa;
  color: #ffffff;
}

.keep-btn {
  background: rgba(102, 187, 106, 0.15);
  border-color: #66bb6a;
  color: #66bb6a;
}
.keep-btn:hover { background: rgba(102, 187, 106, 0.25); }

.delete-btn {
  background: rgba(239, 83, 80, 0.15);
  border-color: #ef5350;
  color: #ef5350;
}
.delete-btn:hover { background: rgba(239, 83, 80, 0.25); }

.complete-btn {
  background: rgba(201, 168, 76, 0.15);
  border-color: var(--accent);
  color: var(--accent);
}
.complete-btn:hover { background: rgba(201, 168, 76, 0.25); }

/* Trash/Deleted panel */
.trash-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.trash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.trash-header h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.trash-actions {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.trash-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  gap: 8px;
}

.trash-item:hover { background: var(--surface2); }

.trash-item-name {
  font-size: 11px;
  color: var(--text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.trash-empty {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text2);
}

/* Empty state */
.empty-state-full {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text2);
}

.empty-state-full svg {
  width: 48px;
  height: 48px;
  opacity: 0.2;
}

.empty-title {
  font-size: 15px;
  color: var(--text);
  opacity: 0.5;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.4;
}

/* Modal */
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
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
