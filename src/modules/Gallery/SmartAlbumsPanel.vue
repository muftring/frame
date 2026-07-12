<template>
  <div class="albums-sidebar">

    <!-- SMART ALBUMS -->
    <div class="sidebar-section">
      <div class="sidebar-section-header">
        <span class="sidebar-section-label">SMART ALBUMS</span>
        <button class="add-icon-btn" @click="openEditor(null)" title="New smart album">+</button>
      </div>

      <div
        v-for="album in globalAlbums"
        :key="album.id"
        class="album-row"
        :class="{ active: isSourceActive({ type: 'album', albumId: album.id }) }"
        @click="selectAlbum(album)"
        @contextmenu.prevent="openCtxMenu($event, album)"
      >
        <svg v-if="album.name === 'B&W Candidates'" class="album-row-icon" viewBox="0 0 16 16" width="12" height="12" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
        </svg>
        <span class="album-row-name">{{ album.name }}</span>
        <span class="album-row-count">{{ album.fileCount }}</span>
      </div>

      <div v-if="!globalAlbums.length" class="sidebar-empty">No albums yet</div>
    </div>

    <!-- THIS SESSION -->
    <div v-if="activeSession" class="sidebar-section">
      <div class="sidebar-section-header">
        <span class="sidebar-section-label">THIS SESSION</span>
      </div>

      <div
        class="album-row"
        :class="{ active: isSourceActive({ type: 'session-all', sessionId: activeSession.id }) }"
        @click="$emit('select', { type: 'session-all', sessionId: activeSession.id }, 'All files')"
      >
        <span class="album-row-name">All files</span>
        <span class="album-row-count">{{ activeSession.fileCount || 0 }}</span>
      </div>

      <div
        v-for="sf in SESSION_FILTERS"
        :key="sf.status"
        class="album-row"
        :class="{ active: isSourceActive({ type: 'session-status', sessionId: activeSession.id, status: sf.status }) }"
        @click="$emit('select', { type: 'session-status', sessionId: activeSession.id, status: sf.status }, sf.label)"
      >
        <span class="album-row-name">{{ sf.label }}</span>
      </div>

      <div
        v-for="group in sessionGroups"
        :key="'g' + group.id"
        class="album-row album-row-group"
        :class="{ active: isSourceActive({ type: 'session-group', groupId: group.id, sessionId: activeSession.id }) }"
        @click="$emit('select', { type: 'session-group', groupId: group.id, sessionId: activeSession.id }, group.label)"
      >
        <span class="album-row-name group-name">{{ group.label }}</span>
        <span class="album-row-count">{{ group.file_count || '' }}</span>
      </div>

      <div
        v-if="sessionBwCount > 0"
        class="album-row"
        :class="{ active: isSourceActive({ type: 'session-tag', sessionId: activeSession.id, tagName: 'bw-candidate' }) }"
        @click="$emit('select', { type: 'session-tag', sessionId: activeSession.id, tagName: 'bw-candidate' }, 'B&W Candidates — ' + activeSession.name)"
      >
        <svg class="album-row-icon" viewBox="0 0 16 16" width="12" height="12" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
        </svg>
        <span class="album-row-name" :title="'B&W Candidates — ' + activeSession.name">B&amp;W Candidates — {{ activeSession.name }}</span>
        <span class="album-row-count">{{ sessionBwCount }}</span>
      </div>
    </div>

    <!-- PANORAMA SETS -->
    <div class="sidebar-section">
      <div class="sidebar-section-header">
        <span class="sidebar-section-label">PANORAMA SETS</span>
        <div class="header-btn-group">
          <button
            class="add-icon-btn"
            :disabled="!activeSession"
            :title="activeSession ? 'Detect panorama and burst sequences' : 'Start a session to detect sequences'"
            @click="detectionModalOpen = true"
          >⟳</button>
          <button
            class="add-icon-btn"
            :disabled="!activeSession"
            :title="activeSession ? 'Create panorama set manually' : 'Start a session to create a set'"
            @click="manualCreateOpen = true"
          >+</button>
        </div>
      </div>

      <div
        v-if="panoCandidatesAlbum"
        class="album-row"
        :class="{ active: isSourceActive({ type: 'album', albumId: panoCandidatesAlbum.id }) }"
        @click="$emit('select', { type: 'album', albumId: panoCandidatesAlbum.id }, 'All Panorama Candidates')"
      >
        <svg class="album-row-icon pano-icon" viewBox="0 0 16 16" width="12" height="12" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
        </svg>
        <span class="album-row-name">All Panorama Candidates</span>
        <span class="album-row-count">{{ panoCandidatesAlbum.fileCount }}</span>
      </div>

      <div
        v-if="activeSession && sessionPanoCandidateCount > 0"
        class="album-row"
        :class="{ active: isSourceActive({ type: 'session-tag', sessionId: activeSession.id, tagName: 'pano-candidate' }) }"
        @click="$emit('select', { type: 'session-tag', sessionId: activeSession.id, tagName: 'pano-candidate' }, 'Panoramas — ' + activeSession.name)"
      >
        <svg class="album-row-icon pano-icon" viewBox="0 0 16 16" width="12" height="12" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
        </svg>
        <span class="album-row-name" :title="'Panoramas — ' + activeSession.name">Panoramas — {{ activeSession.name }}</span>
        <span class="album-row-count">{{ sessionPanoCandidateCount }}</span>
      </div>

      <div
        v-for="set in panoSets"
        :key="'ps' + set.id"
        class="album-row pano-set-row"
        :class="{ active: selectedPanoSetId === set.id }"
        @click="$emit('select-pano-set', set.id)"
      >
        <svg class="album-row-icon pano-icon" viewBox="0 0 16 16" width="12" height="12" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
        </svg>
        <span class="album-row-name" :title="set.name">{{ set.name }}</span>
        <span class="pano-set-count">{{ set.frame_count }}</span>
        <span class="status-pill" :class="'status-' + set.status">{{ statusLabel(set.status) }}</span>
      </div>

      <div v-if="activeSession && !panoSets.length" class="sidebar-empty">No panorama sets yet</div>
      <div v-if="!activeSession" class="sidebar-empty">Start a session to create panorama sets</div>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="new-album-btn" @click="openEditor(null)">+ New Smart Album</button>
    </div>

    <!-- Context menu -->
    <div v-if="ctxMenu" class="ctx-backdrop" @click="ctxMenu = null"></div>
    <div v-if="ctxMenu" class="ctx-menu" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }">
      <div class="ctx-item" @click="openEditor(ctxMenu.album); ctxMenu = null">Edit</div>
      <div class="ctx-item ctx-danger" @click="deleteAlbum(ctxMenu.album); ctxMenu = null">Delete</div>
    </div>

    <!-- Editor modal -->
    <SmartAlbumEditor
      v-if="editorVisible"
      :album="editingAlbum"
      @saved="onAlbumSaved"
      @cancel="editorVisible = false"
    />

    <!-- Sequence detection modal -->
    <SequenceDetectionModal
      v-if="detectionModalOpen"
      :active-session="activeSession"
      @close="detectionModalOpen = false"
      @confirmed="handleSequencesConfirmed"
    />

    <!-- Manual pano set creation modal -->
    <ManualPanoSetModal
      v-if="manualCreateOpen"
      :active-session="activeSession"
      @close="manualCreateOpen = false"
      @created="handlePanoSetCreated"
    />
  </div>
</template>

<script>
import SmartAlbumEditor from './SmartAlbumEditor.vue'
import SequenceDetectionModal from './SequenceDetectionModal.vue'
import ManualPanoSetModal from './ManualPanoSetModal.vue'

const SESSION_FILTERS = [
  { status: 'kept',       label: 'Kept' },
  { status: 'deleted',    label: 'Deleted' },
  { status: 'unreviewed', label: 'Unreviewed' },
]

export default {
  name: 'SmartAlbumsPanel',
  components: { SmartAlbumEditor, SequenceDetectionModal, ManualPanoSetModal },
  props: {
    activeSession:     { type: Object, default: null },
    selectedSource:    { type: Object, default: null },
    selectedPanoSetId: { type: Number, default: null }
  },
  emits: ['select', 'select-pano-set', 'sequences-confirmed'],
  data() {
    return {
      SESSION_FILTERS,
      globalAlbums: [],
      sessionGroups: [],
      sessionBwCount: 0,
      sessionPanoCandidateCount: 0,
      panoSets: [],
      editorVisible: false,
      editingAlbum: null,
      ctxMenu: null,
      detectionModalOpen: false,
      manualCreateOpen: false
    }
  },
  computed: {
    panoCandidatesAlbum() {
      return this.globalAlbums.find(a => a.name === 'Panorama Candidates') || null
    }
  },
  watch: {
    activeSession: {
      immediate: true,
      async handler(session) {
        if (session) {
          const groups = await window.api.invoke('group:list', session.id)
          this.sessionGroups = Array.isArray(groups) ? groups : []
          const bwFiles = await window.api.invoke('tag:listByTag', 'bw-candidate', session.id)
          this.sessionBwCount = Array.isArray(bwFiles) ? bwFiles.length : 0
          const panoFiles = await window.api.invoke('tag:listByTag', 'pano-candidate', session.id)
          this.sessionPanoCandidateCount = Array.isArray(panoFiles) ? panoFiles.length : 0
          await this.loadPanoSets()
        } else {
          this.sessionGroups = []
          this.sessionBwCount = 0
          this.sessionPanoCandidateCount = 0
          this.panoSets = []
        }
      }
    }
  },
  async mounted() {
    await this.loadAlbums()
  },
  methods: {
    async loadAlbums() {
      const albums = await window.api.invoke('album:list', 'global')
      this.globalAlbums = Array.isArray(albums) ? albums : []
    },
    async loadPanoSets() {
      if (!this.activeSession) { this.panoSets = []; return }
      const sets = await window.api.invoke('pano:listSets', this.activeSession.id)
      this.panoSets = Array.isArray(sets) ? sets : []
    },
    statusLabel(status) {
      return { pending: 'Pending', confirmed: 'Confirmed', stitched: 'Stitched', archived: 'Archived' }[status] || status
    },
    async handleSequencesConfirmed(payload) {
      this.detectionModalOpen = false
      await this.loadPanoSets()
      if (this.activeSession) {
        const panoFiles = await window.api.invoke('tag:listByTag', 'pano-candidate', this.activeSession.id)
        this.sessionPanoCandidateCount = Array.isArray(panoFiles) ? panoFiles.length : 0
      }
      await this.loadAlbums()
      this.$emit('sequences-confirmed', payload)
    },
    async handlePanoSetCreated() {
      this.manualCreateOpen = false
      await this.loadPanoSets()
    },
    selectAlbum(album) {
      this.$emit('select', { type: 'album', albumId: album.id }, album.name)
    },
    isSourceActive(source) {
      const s = this.selectedSource
      if (!s || !source) return false
      if (s.type !== source.type) return false
      switch (source.type) {
        case 'album':          return s.albumId === source.albumId
        case 'session-all':    return s.sessionId === source.sessionId
        case 'session-status': return s.sessionId === source.sessionId && s.status === source.status
        case 'session-group':  return s.groupId === source.groupId
        case 'session-tag':    return s.sessionId === source.sessionId && s.tagName === source.tagName
        default: return false
      }
    },
    openEditor(album) {
      this.editingAlbum = album
      this.editorVisible = true
    },
    async onAlbumSaved(savedAlbum) {
      this.editorVisible = false
      this.editingAlbum = null
      await this.loadAlbums()
      // Re-select to refresh file list if it was active
      if (this.selectedSource?.type === 'album' && this.selectedSource.albumId === savedAlbum?.id) {
        this.$emit('select', this.selectedSource, savedAlbum.name)
      }
    },
    async deleteAlbum(album) {
      if (!window.confirm(`Delete album "${album.name}"?`)) return
      await window.api.invoke('album:delete', album.id)
      if (this.selectedSource?.type === 'album' && this.selectedSource.albumId === album.id) {
        this.$emit('select', null, null)
      }
      await this.loadAlbums()
    },
    openCtxMenu(e, album) {
      this.ctxMenu = { x: e.clientX, y: e.clientY, album }
    }
  }
}
</script>

<style scoped>
.albums-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-section {
  flex-shrink: 0;
}

.sidebar-section + .sidebar-section {
  border-top: 1px solid var(--border);
  margin-top: 4px;
  padding-top: 4px;
}

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 4px 12px;
}

.sidebar-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text2);
  opacity: 0.5;
}

.add-icon-btn {
  background: none;
  border: none;
  color: var(--text2);
  font-size: 18px;
  line-height: 1;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
}
.add-icon-btn:hover {
  opacity: 1;
  background: var(--surface2);
}
.add-icon-btn:disabled {
  opacity: 0.2;
  cursor: default;
}

.header-btn-group {
  display: flex;
  gap: 2px;
}

.album-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px 5px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.1s;
  min-height: 26px;
}
.album-row:hover {
  background: var(--surface2);
}
.album-row.active {
  border-left-color: var(--accent);
  background: rgba(201, 168, 76, 0.08);
  padding-left: 9px;
}

.album-row-icon {
  flex-shrink: 0;
  color: var(--text2);
  opacity: 0.7;
}

.pano-icon {
  color: #4a90d9;
  opacity: 1;
}

.pano-set-row {
  gap: 6px;
}

.pano-set-count {
  font-size: 10px;
  color: var(--text2);
  opacity: 0.5;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.status-pill {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}
.status-pending   { background: var(--surface2); color: var(--text2); }
.status-confirmed { background: rgba(74, 144, 217, 0.15); color: #4a90d9; }
.status-stitched  { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
.status-archived  { background: var(--surface2); color: var(--text2); opacity: 0.6; }

.album-row-name {
  flex: 1;
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.album-row-count {
  font-size: 10px;
  color: var(--text2);
  opacity: 0.5;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.album-row-group .album-row-name,
.group-name {
  color: var(--text2);
  padding-left: 6px;
}

.sidebar-empty {
  font-size: 11px;
  color: var(--text2);
  opacity: 0.4;
  padding: 6px 12px 10px;
}

.sidebar-footer {
  margin-top: auto;
  padding: 10px 8px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.new-album-btn {
  width: 100%;
  padding: 6px 10px;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 5px;
  color: var(--text2);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.new-album-btn:hover {
  background: var(--surface2);
  color: var(--text);
  border-color: var(--text2);
}

/* Context menu */
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 190;
}

.ctx-menu {
  position: fixed;
  z-index: 191;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.ctx-item {
  padding: 7px 14px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s;
}
.ctx-item:hover { background: var(--surface2); }
.ctx-danger { color: #ef5350; }
</style>
