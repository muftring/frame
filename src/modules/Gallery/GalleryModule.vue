<template>
  <div class="gallery">
    <div class="gallery-toolbar">
      <button class="btn" @click="openFolder">Open Folder</button>
      <span v-if="folderPath" class="folder-name">{{ folderDisplayName }}</span>
      <span v-if="images.length" class="image-count">{{ images.length }} images</span>
    </div>

    <div v-if="!images.length && !loading" class="empty-state-full">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="28" y="4" width="16" height="16" rx="2" />
        <rect x="4" y="28" width="16" height="16" rx="2" />
        <rect x="28" y="28" width="16" height="16" rx="2" />
      </svg>
      <div class="empty-title">No folder selected</div>
      <div class="empty-hint">Open a folder to browse your photos</div>
    </div>
    <div v-if="loading" class="empty-state-full">
      <div class="spinner"></div>
      <div class="empty-hint">Loading images...</div>
    </div>

    <div class="grid-wrap" ref="gridWrap" @scroll="saveScrollPos">
      <div class="grid">
        <div
          v-for="(img, i) in images"
          :key="img.path"
          class="grid-cell"
          :data-index="i"
          ref="cells"
          @click="openViewer(i)"
          @contextmenu.prevent="showContextMenu($event, img)"
        >
          <img v-if="img.thumbnail" :src="img.thumbnail" class="grid-thumb" />
          <div v-else class="grid-placeholder skeleton"></div>
          <div class="grid-label">{{ img.name }}</div>
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <div v-if="ctxMenu" class="ctx-menu" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }">
      <div v-if="installedTools.darktable" class="ctx-item" @click="openInTool('darktable')">Open in Darktable</div>
      <div v-if="installedTools.rawtherapee" class="ctx-item" @click="openInTool('rawtherapee')">Open in RawTherapee</div>
      <div class="ctx-item" @click="revealInFinder">Reveal in Finder</div>
    </div>
    <div v-if="ctxMenu" class="ctx-backdrop" @click="ctxMenu = null"></div>

    <!-- Image viewer -->
    <ImageViewer
      :visible="viewerOpen"
      :image="viewerImage"
      :has-prev="viewerIndex > 0"
      :has-next="viewerIndex < images.length - 1"
      @close="closeViewer"
      @prev="viewerPrev"
      @next="viewerNext"
    />
  </div>
</template>

<script>
import ImageViewer from './ImageViewer.vue'

export default {
  name: 'GalleryModule',
  inject: ['toast'],
  components: { ImageViewer },
  props: {
    sessionState: { type: Object, default: null }
  },
  emits: ['update-state'],
  data() {
    return {
      folderPath: null,
      images: [],
      loading: false,
      viewerOpen: false,
      viewerIndex: 0,
      ctxMenu: null,
      ctxImage: null,
      installedTools: { darktable: null, rawtherapee: null },
      observer: null,
      savedScrollTop: 0
    }
  },
  computed: {
    folderDisplayName() {
      if (!this.folderPath) return ''
      const parts = this.folderPath.replace(/\\/g, '/').split('/')
      return parts[parts.length - 1] || this.folderPath
    },
    viewerImage() {
      return this.images[this.viewerIndex] || {}
    }
  },
  async mounted() {
    const tools = await window.api.invoke('tools:findInstalled')
    this.installedTools = tools

    if (this.sessionState) {
      this.folderPath = this.sessionState.folderPath
      this.savedScrollTop = this.sessionState.scrollTop || 0
      this.viewerIndex = this.sessionState.lastViewed || 0
      if (this.folderPath) await this.loadFolder(this.folderPath, true)
    }
  },
  beforeUnmount() {
    if (this.observer) this.observer.disconnect()
    this.emitState()
  },
  methods: {
    async openFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) await this.loadFolder(folder, false)
    },
    async loadFolder(folderPath, restoring) {
      this.loading = true
      this.folderPath = folderPath
      this.images = []

      const files = await window.api.invoke('fs:scanFolder', folderPath)
      if (files.error || !files.length) {
        this.loading = false
        return
      }

      this.images = files.map(f => ({
        name: f.name,
        path: f.path,
        size: f.size,
        thumbnail: null
      }))

      this.loading = false

      this.$nextTick(() => {
        this.setupObserver()
        if (restoring && this.savedScrollTop) {
          this.$refs.gridWrap.scrollTop = this.savedScrollTop
        }
      })
    },
    setupObserver() {
      if (this.observer) this.observer.disconnect()

      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const idx = parseInt(entry.target.dataset.index, 10)
            if (isNaN(idx) || this.images[idx].thumbnail) continue
            this.loadThumb(idx)
            this.observer.unobserve(entry.target)
          }
        },
        { root: this.$refs.gridWrap, rootMargin: '200px' }
      )

      const cells = this.$refs.cells
      if (cells) {
        const arr = Array.isArray(cells) ? cells : [cells]
        for (const cell of arr) {
          this.observer.observe(cell)
        }
      }
    },
    async loadThumb(idx) {
      const thumb = await window.api.invoke('img:thumbnail', this.images[idx].path, { width: 180, height: 135 })
      this.images[idx].thumbnail = thumb
    },
    openViewer(i) {
      this.viewerIndex = i
      this.viewerOpen = true
    },
    closeViewer() {
      this.viewerOpen = false
    },
    viewerPrev() {
      if (this.viewerIndex > 0) this.viewerIndex--
    },
    viewerNext() {
      if (this.viewerIndex < this.images.length - 1) this.viewerIndex++
    },
    showContextMenu(e, img) {
      this.ctxImage = img
      this.ctxMenu = { x: e.clientX, y: e.clientY }
    },
    async openInTool(tool) {
      const toolPath = this.installedTools[tool]
      if (toolPath && this.ctxImage) {
        await window.api.invoke('tools:openFile', toolPath, this.ctxImage.path)
      }
      this.ctxMenu = null
    },
    async revealInFinder() {
      if (this.ctxImage) {
        await window.api.invoke('tools:revealInFinder', this.ctxImage.path)
      }
      this.ctxMenu = null
    },
    saveScrollPos() {
      if (this.$refs.gridWrap) {
        this.savedScrollTop = this.$refs.gridWrap.scrollTop
      }
    },
    emitState() {
      this.$emit('update-state', {
        folderPath: this.folderPath,
        scrollTop: this.savedScrollTop,
        lastViewed: this.viewerIndex
      })
    }
  }
}
</script>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.gallery-toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn:hover { background: var(--surface-hover); }

.folder-name {
  font-size: 13px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.image-count {
  font-size: 12px;
  color: var(--text2);
  margin-left: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
  font-size: 15px;
}

.grid-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 180px);
  gap: 4px;
  justify-content: center;
}

.grid-cell {
  position: relative;
  width: 180px;
  height: 135px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface);
}

.grid-cell:hover .grid-label {
  opacity: 1;
}

.grid-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.grid-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface2);
}

.grid-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 6px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  font-size: 10px;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transition: opacity 0.15s;
}

/* Context menu */
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.ctx-menu {
  position: fixed;
  z-index: 91;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.ctx-item {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s;
}

.ctx-item:hover {
  background: var(--surface2);
}
</style>
