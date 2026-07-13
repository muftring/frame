<template>
  <div class="gallery">

    <!-- Toolbar -->
    <div class="gallery-toolbar">
      <button class="btn" @click="openFolder">Open Folder</button>
      <span v-if="activeLabel" class="folder-name">{{ activeLabel }}</span>
      <span v-else-if="folderPath" class="folder-name" :title="folderPath">{{ folderDisplayName }}</span>
      <span v-if="images.length" class="image-count">{{ images.length }} images</span>
    </div>

    <!-- Body: sidebar + main -->
    <div class="gallery-body">

      <SmartAlbumsPanel
        ref="albumsPanel"
        :active-session="activeSession"
        :selected-source="selectedSource"
        :selected-pano-set-id="selectedPanoSetId"
        :selected-burst-set-id="selectedBurstSetId"
        @select="handleSourceSelect"
        @select-pano-set="handleSelectPanoSet"
        @select-burst-set="handleSelectBurstSet"
        @sequences-confirmed="handleSequencesConfirmed"
      />

      <PanoSetView
        v-if="selectedPanoSetId"
        :pano-set-id="selectedPanoSetId"
        :active-session="activeSession"
        @close="selectedPanoSetId = null"
        @set-changed="handlePanoSetChanged"
        @open-in-hugin="handleOpenInHugin"
      />

      <BurstSetView
        v-else-if="selectedBurstSetId"
        :burst-set-id="selectedBurstSetId"
        :active-session="activeSession"
        @close="selectedBurstSetId = null"
        @set-changed="handleBurstSetChanged"
        @create-composite="handleCreateComposite"
      />

      <div class="gallery-main" v-else>

        <div v-if="!images.length && !loading" class="empty-state-full">
          <template v-if="selectedSource">
            <div class="empty-title">No files found</div>
            <div class="empty-hint">No files match this album's rules</div>
          </template>
          <template v-else-if="folderPath">
            <div class="empty-title">No images in folder</div>
            <div class="empty-hint">Try a different folder</div>
          </template>
          <template v-else>
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="28" y="4" width="16" height="16" rx="2" />
              <rect x="4" y="28" width="16" height="16" rx="2" />
              <rect x="28" y="28" width="16" height="16" rx="2" />
            </svg>
            <div class="empty-title">Gallery</div>
            <div class="empty-hint">Select a smart album or open a folder</div>
          </template>
        </div>

        <div v-if="loading" class="empty-state-full">
          <div class="spinner"></div>
          <div class="empty-hint">Loading images…</div>
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
              <div class="grid-tag-badges" v-if="img.tags && img.tags.length">
                <span
                  v-for="tagName in img.tags.slice(0, 2)"
                  :key="tagName"
                  class="grid-tag-badge"
                  :style="{ color: tagColor(tagName) }"
                >{{ tagBadgeText(tagName) }}</span>
              </div>
              <div class="grid-label">{{ img.name }}</div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Context menu (fixed, escapes all overflow) -->
    <div v-if="ctxMenu" class="ctx-menu" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }">
      <div v-if="installedTools.darktable" class="ctx-item" @click="openInTool('darktable')">Open in Darktable</div>
      <div v-if="installedTools.rawtherapee" class="ctx-item" @click="openInTool('rawtherapee')">Open in RawTherapee</div>
      <div class="ctx-item" @click="revealInFinder">Reveal in Finder</div>
    </div>
    <div v-if="ctxMenu" class="ctx-backdrop" @click="ctxMenu = null"></div>

    <!-- Image viewer (fixed overlay) -->
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
import SmartAlbumsPanel from './SmartAlbumsPanel.vue'
import PanoSetView from './PanoSetView.vue'
import BurstSetView from './BurstSetView.vue'

export default {
  name: 'GalleryModule',
  inject: ['toast', 'session'],
  components: { ImageViewer, SmartAlbumsPanel, PanoSetView, BurstSetView },
  props: {
    sessionState:  { type: Object, default: null },
    activeSession: { type: Object, default: null },
    initialSource: { type: Object, default: null }
  },
  emits: ['update-state', 'navigate'],
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
      savedScrollTop: 0,
      selectedSource: null,
      selectedSourceLabel: null,
      tagDefinitions: [],
      selectedPanoSetId: null,
      selectedBurstSetId: null
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
    },
    activeLabel() {
      if (!this.selectedSource) return null
      if (this.selectedSourceLabel) return this.selectedSourceLabel
      switch (this.selectedSource.type) {
        case 'session-all': return 'All Session Files'
        case 'session-status': {
          const m = { kept: 'Kept', deleted: 'Deleted', unreviewed: 'Unreviewed', published: 'Published' }
          return m[this.selectedSource.status] || this.selectedSource.status
        }
        default: return 'Smart Album'
      }
    }
  },
  async mounted() {
    const tools = await window.api.invoke('tools:findInstalled')
    this.installedTools = tools

    const defs = await window.api.invoke('tag:listDefinitions')
    if (Array.isArray(defs)) this.tagDefinitions = defs

    if (this.initialSource?.type === 'pano-set') {
      this.selectedPanoSetId = this.initialSource.panoSetId
      return
    }

    if (this.initialSource?.type === 'burst-set') {
      this.selectedBurstSetId = this.initialSource.burstSetId
      return
    }

    if (this.initialSource) {
      const labelMap = { kept: 'Kept', deleted: 'Deleted', unreviewed: 'Unreviewed' }
      const label = labelMap[this.initialSource.status] || null
      await this.handleSourceSelect(this.initialSource, label)
      return
    }

    const lastSource = await window.api.invoke('store:get', 'galleryLastSource')
    if (lastSource?.albumId) {
      this.selectedSource = lastSource
      await this.loadSource(lastSource)
    } else if (this.sessionState) {
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
    async handleSourceSelect(source, label) {
      this.selectedPanoSetId = null
      this.selectedBurstSetId = null
      this.selectedSource = source
      this.selectedSourceLabel = label || null

      if (!source) {
        window.api.invoke('store:set', 'galleryLastSource', null)
        return
      }

      if (source.type === 'album') {
        window.api.invoke('store:set', 'galleryLastSource', { type: 'album', albumId: source.albumId })
      } else {
        window.api.invoke('store:set', 'galleryLastSource', null)
      }

      await this.loadSource(source)
    },

    async loadSource(source) {
      this.loading = true
      this.images = []
      this.folderPath = null

      let dbFiles = []
      if (source.type === 'album') {
        dbFiles = await window.api.invoke('album:resolveFiles', source.albumId)
      } else if (source.type === 'session-all') {
        dbFiles = await window.api.invoke('file:listBySession', source.sessionId, {})
      } else if (source.type === 'session-status') {
        dbFiles = await window.api.invoke('file:listBySession', source.sessionId, { status: source.status })
      } else if (source.type === 'session-group') {
        dbFiles = await window.api.invoke('file:listByGroup', source.groupId)
      } else if (source.type === 'session-tag') {
        dbFiles = await window.api.invoke('tag:listByTag', source.tagName, source.sessionId)
      }

      if (Array.isArray(dbFiles)) {
        this.images = dbFiles.map(f => ({
          fileId: f.id,
          name: f.filename,
          path: f.full_path,
          size: f.size_bytes || 0,
          thumbnail: null,
          tags: (() => { try { return JSON.parse(f.tags || '[]') } catch { return [] } })()
        }))
      }

      this.loading = false
      this.$nextTick(() => this.setupObserver())

      if (source.focusFileId != null) {
        const idx = this.images.findIndex(img => img.fileId === source.focusFileId)
        if (idx !== -1) this.openViewer(idx)
      }
    },

    async openFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.selectedPanoSetId = null
        this.selectedBurstSetId = null
        this.selectedSource = null
        this.selectedSourceLabel = null
        window.api.invoke('store:set', 'galleryLastSource', null)
        await this.loadFolder(folder, false)
      }
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
        fileId: null,
        name: f.name,
        path: f.path,
        size: f.size,
        thumbnail: null,
        tags: []
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
            if (isNaN(idx) || this.images[idx]?.thumbnail) continue
            this.loadThumb(idx)
            this.observer.unobserve(entry.target)
          }
        },
        { root: this.$refs.gridWrap, rootMargin: '200px' }
      )

      const cells = this.$refs.cells
      if (cells) {
        const arr = Array.isArray(cells) ? cells : [cells]
        for (const cell of arr) this.observer.observe(cell)
      }
    },

    async loadThumb(idx) {
      const img = this.images[idx]
      if (!img) return
      const thumb = await window.api.invoke('img:thumbnail', img.path, { width: 180, height: 135 })
      if (this.images[idx]) this.images[idx].thumbnail = thumb
    },

    openViewer(i) { this.viewerIndex = i; this.viewerOpen = true },
    closeViewer()  { this.viewerOpen = false },
    viewerPrev()   { if (this.viewerIndex > 0) this.viewerIndex-- },
    viewerNext()   { if (this.viewerIndex < this.images.length - 1) this.viewerIndex++ },

    tagColor(tagName) {
      return this.tagDefinitions.find(d => d.name === tagName)?.color || '#888888'
    },
    tagBadgeText(tagName) {
      if (tagName === 'bw-candidate') return 'B&W'
      return this.tagDefinitions.find(d => d.name === tagName)?.label || tagName
    },

    handleSelectPanoSet(panoSetId) {
      this.selectedSource = null
      this.selectedSourceLabel = null
      this.folderPath = null
      this.selectedBurstSetId = null
      this.selectedPanoSetId = panoSetId
    },
    handlePanoSetChanged() {
      // PanoSetView already refreshed its own data (name/frame list); the
      // sidebar's separate pano_sets list (name, frame_count, status) needs
      // an explicit nudge or it goes stale until activeSession changes.
      this.$refs.albumsPanel?.loadPanoSets()
    },
    handleSelectBurstSet(burstSetId) {
      this.selectedSource = null
      this.selectedSourceLabel = null
      this.folderPath = null
      this.selectedPanoSetId = null
      this.selectedBurstSetId = burstSetId
    },
    handleBurstSetChanged() {
      this.$refs.albumsPanel?.loadBurstSets()
    },
    handleSequencesConfirmed({ panoCount, burstCount }) {
      this.toast(`Created ${panoCount} panorama set${panoCount === 1 ? '' : 's'}, ${burstCount} burst set${burstCount === 1 ? '' : 's'}`, 'success')
    },
    handleOpenInHugin(panoSetId) {
      this.session.pendingPanoSetId = panoSetId
      this.$emit('navigate', 'process')
    },
    handleCreateComposite(burstSetId) {
      this.session.pendingBurstSetId = burstSetId
      this.$emit('navigate', 'process')
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
      if (this.ctxImage) await window.api.invoke('tools:revealInFinder', this.ctxImage.path)
      this.ctxMenu = null
    },

    saveScrollPos() {
      if (this.$refs.gridWrap) this.savedScrollTop = this.$refs.gridWrap.scrollTop
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
  height: 100%;
  width: 100%;
}

/* ── Toolbar ──────────────────────────────────── */
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
  flex-shrink: 0;
}
.btn:hover { background: var(--surface-hover); }

.folder-name {
  font-size: 13px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-count {
  font-size: 12px;
  color: var(--text2);
  margin-left: auto;
  flex-shrink: 0;
}

/* ── Body ─────────────────────────────────────── */
.gallery-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 0;
}

/* ── Main area ────────────────────────────────── */
.gallery-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  position: relative;
}

/* ── Empty states ─────────────────────────────── */
.empty-state-full {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text2);
  pointer-events: none;
}

.empty-state-full svg {
  width: 52px;
  height: 52px;
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

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Grid ─────────────────────────────────────── */
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
.grid-cell:hover .grid-label { opacity: 1; }

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

.grid-tag-badges {
  position: absolute;
  bottom: 4px;
  left: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 1;
}

.grid-tag-badge {
  font-size: 10px;
  padding: 3px 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.65);
  line-height: 1;
  white-space: nowrap;
}

.grid-label {
  position: absolute;
  bottom: 0; left: 0; right: 0;
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

/* ── Context menu ─────────────────────────────── */
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
.ctx-item:hover { background: var(--surface2); }
</style>
