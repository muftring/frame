<template>
  <div class="sorter">
    <!-- Toolbar -->
    <div class="toolbar">
      <button class="btn" @click="openFolder">Open Folder</button>
      <span v-if="folderPath" class="folder-name">{{ folderDisplayName }}</span>
      <div class="toolbar-stats" v-if="images.length">
        <span>{{ images.length }} total</span>
        <span class="stat-sep">|</span>
        <span class="stat-kept">{{ keptCount }} kept</span>
        <span class="stat-sep">|</span>
        <span class="stat-trashed">{{ trashedCount }} trashed</span>
      </div>
      <div class="toolbar-spacer"></div>
      <button v-if="images.length" class="btn" :class="{ active: trashPanelOpen }" @click="trashPanelOpen = !trashPanelOpen">
        Trash{{ trashedCount ? ' (' + trashedCount + ')' : '' }}
      </button>
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
          <div v-if="img.status === 'trashed'" class="thumb-trash-badge">x</div>
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
            @error="handleImageError"
          />
          <div v-if="currentImage && currentImage.status === 'trashed'" class="trashed-overlay">
            <span>Trashed</span>
          </div>
        </div>
        <div class="viewer-info" v-if="currentImage">
          <span class="viewer-filename">{{ currentImage.name }}</span>
          <span class="viewer-progress-text">{{ currentIndex + 1 }} / {{ images.length }}</span>
        </div>
        <div class="viewer-progress-bar" v-if="images.length">
          <div class="viewer-progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- Trash panel -->
      <transition name="slide">
        <div v-if="trashPanelOpen" class="trash-panel">
          <div class="trash-header">
            <h4>Trash ({{ trashedCount }})</h4>
            <button class="btn-sm" @click="trashPanelOpen = false">Close</button>
          </div>
          <div class="trash-actions" v-if="trashedCount">
            <button class="btn-sm" @click="restoreAll">Restore All</button>
            <button class="btn-sm btn-danger" @click="confirmEmptyTrash = true">Empty Trash</button>
          </div>
          <div class="trash-list">
            <div v-for="img in trashedImages" :key="img.path" class="trash-item">
              <span class="trash-item-name">{{ img.name }}</span>
              <button class="btn-sm" @click="restore(img)">Restore</button>
            </div>
          </div>
          <div v-if="!trashedCount" class="trash-empty">No trashed images</div>
        </div>
      </transition>
    </div>

    <!-- Empty state -->
    <div class="empty-state" v-if="!images.length && !loading">
      <span>Open a folder to start sorting</span>
    </div>
    <div class="empty-state" v-if="loading">
      <span>Loading images...</span>
    </div>

    <!-- Action bar -->
    <div class="action-bar" v-if="images.length">
      <button class="btn action-btn" @click="prev" :disabled="currentIndex === 0">Prev</button>
      <button class="btn action-btn keep-btn" @click="keep">Keep (K)</button>
      <button class="btn action-btn delete-btn" @click="doTrash">Delete (D)</button>
      <button class="btn action-btn" @click="next" :disabled="currentIndex >= images.length - 1">Next</button>
    </div>

    <!-- Confirm empty trash modal -->
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
  </div>
</template>

<script>
export default {
  name: 'SorterModule',
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
      confirmEmptyTrash: false
    }
  },
  computed: {
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
    progressPercent() {
      if (!this.images.length) return 0
      return ((this.currentIndex + 1) / this.images.length) * 100
    },
    viewerImageUrl() {
      if (!this.currentImage) return ''
      const p = this.currentImage.status === 'trashed' && this.currentImage.trashedPath
        ? this.currentImage.trashedPath
        : this.currentImage.path
      return 'local-file://' + encodeURI(p)
    },
    folderDisplayName() {
      if (!this.folderPath) return ''
      const parts = this.folderPath.replace(/\\/g, '/').split('/')
      return parts[parts.length - 1] || this.folderPath
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
    }
  },
  mounted() {
    this._keyHandler = this.handleKeydown.bind(this)
    window.addEventListener('keydown', this._keyHandler)
    if (this.initialFolder) {
      this.loadFolder(this.initialFolder)
    }
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
  },
  methods: {
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
        name: f.name,
        path: f.path,
        size: f.size,
        thumbnail: null,
        status: 'pending',
        trashedPath: null
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
      this.advanceNext()
    },
    async doTrash() {
      if (!this.currentImage || this.currentImage.status === 'trashed') {
        this.advanceNext()
        return
      }
      const trashFolder = this.folderPath + '/.frame-trash'
      const result = await window.api.invoke('fs:moveToTrash', this.currentImage.path, trashFolder)
      if (result.success) {
        this.currentImage.status = 'trashed'
        this.currentImage.trashedPath = result.trashedPath
      }
      this.advanceNext()
    },
    async restore(img) {
      if (!img.trashedPath) return
      const result = await window.api.invoke('fs:restoreFromTrash', img.trashedPath, img.path)
      if (result.success) {
        img.status = 'pending'
        img.trashedPath = null
      }
    },
    async restoreAll() {
      const trashed = [...this.trashedImages]
      for (const img of trashed) {
        await this.restore(img)
      }
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
      if (this.confirmEmptyTrash) return
      switch (e.key) {
        case 'ArrowLeft': this.prev(); e.preventDefault(); break
        case 'ArrowRight': this.next(); e.preventDefault(); break
        case 'k': case 'K': this.keep(); break
        case 'd': case 'D': this.doTrash(); break
        case 'Escape': this.trashPanelOpen = false; break
      }
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
  height: 100vh;
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
.btn:hover { background: #383838; border-color: rgba(255,255,255,0.15); }
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
.btn-sm:hover { background: #383838; }

.btn-danger { border-color: #ef5350; color: #ef5350; }
.btn-danger:hover { background: rgba(239,83,80,0.12); }

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

.thumb-trash-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  color: #ef5350;
  font-weight: 700;
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

/* Trash panel */
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
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
  font-size: 15px;
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
</style>
