<template>
  <div class="us-panel">

    <div class="us-header">
      Stage photos for upload
      <span class="us-subtitle">
        Export web-optimized copies to a folder for drag-and-drop upload to TeamSnap, Sprocket, or any team site.
      </span>
    </div>

    <!-- Photo selection -->
    <div class="us-section">
      <div class="us-section-label">Photos</div>

      <div v-if="selectedFileIds.length === 0" class="us-empty-selection">
        No photos selected.
        <a @click="openPhotoPicker">Choose photos</a>
        or select from Gallery and use right-click &rarr; "Stage for upload".
      </div>

      <div v-else class="us-selection-summary">
        <span class="us-count">{{ selectedFileIds.length }} photos selected</span>
        <a @click="openPhotoPicker">Change</a>
        <a @click="selectedFileIds = []">Clear</a>
      </div>
    </div>

    <!-- Preset selection -->
    <div class="us-section">
      <div class="us-section-label">Export quality</div>
      <div class="us-presets">
        <div
          v-for="p in presets" :key="p.id"
          class="us-preset"
          :class="{ selected: preset === p.id }"
          @click="preset = p.id"
        >
          <div class="us-preset-label">{{ p.label }}</div>
          <div class="us-preset-desc">{{ p.description }}</div>
        </div>
      </div>
    </div>

    <!-- Destination folder -->
    <div class="us-section">
      <div class="us-section-label">Destination folder</div>

      <div class="us-folder-row">
        <div class="us-folder-path">{{ destFolder || 'No folder selected' }}</div>
        <button class="btn-sm" @click="chooseFolderParent">Browse&hellip;</button>
      </div>

      <div class="us-folder-name-row">
        <span class="us-folder-prefix">{{ stagingRoot }}/</span>
        <input
          v-model="folderName"
          placeholder="June 28 Tournament"
          @input="updateDestFolder"
          class="us-folder-name-input"
        />
      </div>
      <div class="us-folder-hint">Frame will create this folder if it doesn't exist.</div>
    </div>

    <!-- Stage button -->
    <div class="us-actions" v-if="!staging">
      <button class="btn-primary" :disabled="!canStage" @click="stageNow">
        Stage for upload
      </button>
    </div>

    <!-- Progress -->
    <div class="us-progress" v-else>
      <div class="us-progress-bar">
        <div class="us-progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="us-progress-label">
        {{ stageProgress.current }} of {{ stageProgress.total }} — {{ stageProgress.filename }}
      </div>
    </div>

    <!-- Result -->
    <div class="us-result" v-if="lastResult && !staging">
      <div class="us-result-success" v-if="lastResult.success">
        &check; {{ lastResult.successCount }} photos staged
        <button class="btn-sm" @click="revealFolder">Open folder &#8599;</button>
      </div>
      <div class="us-result-partial" v-else-if="lastResult.successCount > 0">
        &#9888; {{ lastResult.successCount }} staged, {{ lastResult.errorCount }} failed
        <button class="btn-sm" @click="revealFolder">Open folder &#8599;</button>
      </div>
      <div class="us-result-error" v-else>
        &#10007; Staging failed — check that source files exist
      </div>
    </div>

    <!-- Photo picker modal -->
    <div v-if="pickerOpen" class="modal-overlay" @click.self="pickerOpen = false">
      <div class="modal us-picker-modal">
        <h4>Choose photos from session</h4>
        <div v-if="!availableFiles.length" class="us-picker-empty">No kept files available.</div>
        <div class="us-picker-list">
          <div
            v-for="f in availableFiles" :key="f.id"
            class="us-picker-item"
            :class="{ selected: pickerSelected.includes(f.id) }"
            @click="togglePickerSelect(f.id)"
          >
            {{ f.filename }}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="pickerOpen = false">Cancel</button>
          <button class="btn btn-primary" @click="confirmPickerSelection">
            Select {{ pickerSelected.length || '' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: 'UploadStagingPanel',
  inject: ['toast', 'session'],
  props: {
    initialFileIds: { type: Array, default: () => [] }
  },
  data() {
    return {
      selectedFileIds: [...this.initialFileIds],
      preset: 'web',
      presets: [],
      stagingRoot: '',
      folderName: '',
      destFolder: '',
      staging: false,
      stageProgress: { current: 0, total: 0, filename: '' },
      lastResult: null,
      pickerOpen: false,
      availableFiles: [],
      pickerSelected: []
    }
  },
  computed: {
    canStage() {
      return this.selectedFileIds.length > 0 && this.destFolder.length > 0 && !this.staging
    },
    progressPercent() {
      if (!this.stageProgress.total) return 0
      return Math.round((this.stageProgress.current / this.stageProgress.total) * 100)
    }
  },
  async created() {
    this.presets = await window.api.invoke('upload:getPresets')
    this.stagingRoot = await window.api.invoke('upload:getStagingRoot')
    this.destFolder = this.stagingRoot
    this._progressCleanup = window.api.on('upload:stageProgress', (data) => {
      this.stageProgress = data
    })
  },
  beforeUnmount() {
    if (this._progressCleanup) this._progressCleanup()
  },
  methods: {
    // Exposed for the "already on this tab" navigation edge case, where
    // Vue reuses the existing PublishModule/panel instance instead of
    // remounting it — see PublishModule.vue's openStagingWithFiles.
    setFiles(fileIds) {
      this.selectedFileIds = [...fileIds]
    },
    async openPhotoPicker() {
      if (!this.session?.id) {
        this.toast('No active session to pick photos from', 'error')
        return
      }
      const files = await window.api.invoke('file:listBySession', this.session.id, { status: 'kept' })
      this.availableFiles = Array.isArray(files) ? files : []
      this.pickerSelected = [...this.selectedFileIds]
      this.pickerOpen = true
    },
    togglePickerSelect(fileId) {
      const idx = this.pickerSelected.indexOf(fileId)
      if (idx === -1) this.pickerSelected.push(fileId)
      else this.pickerSelected.splice(idx, 1)
    },
    confirmPickerSelection() {
      this.selectedFileIds = [...this.pickerSelected]
      this.pickerOpen = false
    },
    async chooseFolderParent() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.destFolder = folder
        this.folderName = ''
      }
    },
    updateDestFolder() {
      const safe = this.folderName.replace(/[/\\:*?"<>|]/g, '-').trim()
      this.destFolder = safe ? `${this.stagingRoot}/${safe}` : this.stagingRoot
    },
    async stageNow() {
      this.staging = true
      this.lastResult = null
      this.stageProgress = { current: 0, total: this.selectedFileIds.length, filename: '' }

      this.lastResult = await window.api.invoke('upload:stageFiles', {
        // Spread — a Vue-reactive array passed as-is fails contextBridge's
        // structured-clone step ("An object could not be cloned"), even
        // though the same array works fine everywhere it stays inside Vue.
        fileIds: [...this.selectedFileIds],
        destFolder: this.destFolder,
        presetId: this.preset
      })

      this.staging = false
      if (this.lastResult.success) {
        this.toast(`${this.lastResult.successCount} photos staged`, 'success')
      } else if (this.lastResult.successCount > 0) {
        this.toast(`${this.lastResult.successCount} staged, ${this.lastResult.errorCount} failed`, 'warn')
      } else {
        this.toast('Staging failed — check that source files exist', 'error')
      }
    },
    async revealFolder() {
      if (this.lastResult?.destFolder) {
        await window.api.invoke('upload:revealFolder', { folderPath: this.lastResult.destFolder })
      }
    }
  }
}
</script>

<style scoped>
.us-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.us-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-lg);
  color: var(--color-text);
}
.us-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  font-weight: 400;
}

.us-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.us-section-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.us-empty-selection,
.us-selection-summary {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 10px;
}
.us-count {
  color: var(--color-text);
  font-weight: 500;
}
.us-empty-selection a,
.us-selection-summary a {
  color: var(--color-accent);
  cursor: pointer;
}
.us-empty-selection a:hover,
.us-selection-summary a:hover {
  text-decoration: underline;
}

.us-presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.us-preset {
  padding: 10px 12px;
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--dur-base), background var(--dur-base);
}
.us-preset:hover {
  background: var(--color-surface-2);
}
.us-preset.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-dim);
}
.us-preset-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}
.us-preset-desc {
  font-size: var(--text-xs);
  color: var(--color-text-3);
  margin-top: 2px;
}

.us-folder-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.us-folder-path {
  flex: 1;
  padding: 6px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-2);
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.us-folder-name-row {
  display: flex;
  align-items: center;
  gap: 0;
}
.us-folder-prefix {
  font-size: var(--text-sm);
  color: var(--color-text-3);
  white-space: nowrap;
}
.us-folder-name-input {
  flex: 1;
  padding: 6px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
}
.us-folder-name-input:focus {
  border-color: var(--color-accent);
}
.us-folder-hint {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}

.us-actions {
  display: flex;
}

.btn-primary {
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #1a1a1a;
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 8px 18px;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: default; }

.btn, .btn-sm {
  padding: 7px 14px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  cursor: pointer;
}
.btn-sm { padding: 5px 10px; font-size: var(--text-xs); }
.btn:hover, .btn-sm:hover { background: var(--color-surface-3); }

.us-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.us-progress-bar {
  height: 3px;
  background: var(--color-surface-3);
  border-radius: 2px;
  overflow: hidden;
}
.us-progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.15s ease;
}
.us-progress-label {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}

.us-result {
  font-size: var(--text-sm);
}
.us-result-success { color: var(--color-keep-hover); }
.us-result-partial { color: var(--color-accent); }
.us-result-error { color: var(--color-delete-hover); }
.us-result button {
  margin-left: 10px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}
.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  padding: 20px;
  min-width: 320px;
  max-width: 480px;
}
.modal h4 {
  font-size: var(--text-md);
  margin-bottom: 8px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.us-picker-modal { width: 400px; }
.us-picker-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.us-picker-item {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-text);
}
.us-picker-item:hover { background: var(--color-surface-2); }
.us-picker-item.selected {
  background: var(--color-accent-dim);
  color: var(--color-accent);
}
.us-picker-empty {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  padding: 12px 0;
}
</style>
