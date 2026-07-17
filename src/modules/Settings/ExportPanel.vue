<template>
  <div class="export-panel">
    <h4>Export Frame Library</h4>
    <p class="section-desc">
      Create a portable backup of your sessions, metadata, and settings.
      Use this to move Frame to a new Mac or share your library.
    </p>

    <div v-if="dbWarning" class="warn-box">
      Your database may have integrity issues. Run a backup before exporting.
    </div>

    <div class="setting-row toggle-row">
      <label>Include thumbnail cache</label>
      <button class="toggle-btn" :class="{ on: includeThumbs }" @click="includeThumbs = !includeThumbs">
        <span class="toggle-knob"></span>
      </button>
    </div>
    <div class="path-hint">
      <template v-if="includeThumbs">Includes all cached thumbnails for faster startup. (~{{ sizeLabel }} total)</template>
      <template v-else>Thumbnails will be regenerated automatically on the new machine. (~{{ sizeLabel }})</template>
    </div>

    <button class="btn-sm export-btn" @click="startExport" :disabled="exporting">
      {{ exporting ? 'Exporting…' : 'Export library…' }}
    </button>

    <div v-if="exporting" class="export-progress">
      <div class="spinner"></div>
      <span>Exporting… {{ progressEntries }} files</span>
    </div>

    <div v-if="exportError" class="warn-box">{{ exportError }}</div>

    <div v-if="successInfo" class="export-success">
      <div class="success-title">Export complete</div>
      <div class="success-path" @click="revealInFinder" title="Reveal in Finder">{{ successInfo.outputPath }}</div>
      <div class="success-size">{{ formatSize(successInfo.sizeBytes) }}</div>
      <button class="btn-sm" @click="successInfo = null">Done</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExportPanel',
  data() {
    return {
      includeThumbs: false,
      sizeInfo: { dbBytes: 0, thumbBytes: 0, totalBytes: 0 },
      dbWarning: false,
      exporting: false,
      progressEntries: 0,
      exportError: null,
      successInfo: null,
      _unsubscribeProgress: null
    }
  },
  computed: {
    sizeLabel() {
      return this.formatSize(this.sizeInfo.totalBytes)
    }
  },
  watch: {
    includeThumbs() {
      this.loadSize()
    }
  },
  async mounted() {
    const check = await window.api.invoke('library:validateCurrentDb')
    this.dbWarning = !check?.valid
    await this.loadSize()
    this._unsubscribeProgress = window.api.on('library:exportProgress', (progress) => {
      this.progressEntries = progress.entries
    })
  },
  beforeUnmount() {
    if (this._unsubscribeProgress) this._unsubscribeProgress()
  },
  methods: {
    async loadSize() {
      this.sizeInfo = await window.api.invoke('library:getExportSize', this.includeThumbs)
    },
    async startExport() {
      const defaultPath = `Frame_Export_${new Date().toISOString().slice(0, 10)}.framelib`
      const outputPath = await window.api.invoke('dialog:saveFramelib', defaultPath)
      if (!outputPath) return

      this.exporting = true
      this.progressEntries = 0
      this.exportError = null
      this.successInfo = null

      const result = await window.api.invoke('library:export', { outputPath, includeThumbs: this.includeThumbs })
      this.exporting = false

      if (result.success) {
        this.successInfo = result
      } else {
        this.exportError = result.error || 'Export failed.'
      }
    },
    async revealInFinder() {
      if (this.successInfo) await window.api.invoke('tools:revealInFinder', this.successInfo.outputPath)
    },
    formatSize(bytes) {
      if (!bytes) return '0 B'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / 1048576).toFixed(1) + ' MB'
    }
  }
}
</script>

<style scoped>
.section-desc {
  font-size: 12px;
  color: var(--text2);
  margin-bottom: 12px;
  line-height: 1.5;
}

.warn-box {
  font-size: 12px;
  color: var(--text);
  background: rgba(178, 34, 34, 0.12);
  border: 1px solid rgba(178, 34, 34, 0.4);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 12px;
  line-height: 1.4;
}

.setting-row {
  margin-bottom: 8px;
}

.btn-sm {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.btn-sm:hover { background: var(--surface-hover); }
.btn-sm:disabled { opacity: 0.4; cursor: default; }

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.toggle-row label { margin-bottom: 0; font-size: 13px; color: var(--text); }

.toggle-btn {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface2);
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.toggle-btn.on {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text);
  transition: transform 0.15s;
}
.toggle-btn.on .toggle-knob {
  transform: translateX(16px);
  background: #1a1a1a;
}

.path-hint {
  font-size: 11px;
  color: var(--text2);
  opacity: 0.8;
  margin-bottom: 12px;
  line-height: 1.4;
}

.export-btn {
  width: 100%;
  text-align: center;
  padding: 7px 10px;
}

.export-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text2);
  margin-top: 10px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.export-success {
  margin-top: 12px;
  padding: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.success-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 6px;
}

.success-path {
  font-size: 11px;
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text2);
  cursor: pointer;
  word-break: break-all;
  margin-bottom: 4px;
}
.success-path:hover { color: var(--accent); text-decoration: underline; }

.success-size {
  font-size: 11px;
  color: var(--text2);
  margin-bottom: 8px;
}
</style>
