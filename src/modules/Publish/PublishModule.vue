<template>
  <div class="upload">
    <!-- Provider selection -->
    <div class="provider-cards">
      <div
        v-for="(p, id) in providers" :key="id"
        class="provider-card"
        :class="{ active: selectedProvider === id, unavailable: !p.available }"
        @click="selectProvider(id)"
      >
        <div class="provider-header">
          <h4>{{ p.name }}</h4>
          <span v-if="p.configured" class="badge configured">Ready</span>
          <span v-else class="badge not-configured">Not Configured</span>
        </div>
        <div class="provider-desc">{{ p.description }}</div>
        <div v-if="id === 'icloud'" class="provider-note">
          macOS only — imports into Photos.app
        </div>
      </div>
    </div>

    <!-- No providers -->
    <div v-if="!Object.keys(providers).length && !loadingProviders" class="empty-state-full">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 6v16M24 22l8-8M24 22l-8-8" />
        <path d="M8 28v10a2 2 0 002 2h28a2 2 0 002-2V28" />
      </svg>
      <div class="empty-title">No publish providers available</div>
      <div class="empty-hint">Install ArchiVault or run on macOS for iCloud Photos</div>
    </div>

    <!-- Provider config + upload area -->
    <div v-if="selectedProvider" class="upload-area">
      <!-- ArchiVault options -->
      <section v-if="selectedProvider === 'archivault'" class="section">
        <h3>ArchiVault Options</h3>
        <div class="section-body">
          <div class="field-row">
            <label>CLI Path</label>
            <div class="field-input">
              <input
                type="text"
                class="text-input"
                v-model="providerOptions.cliPath"
                placeholder="archivault (default)"
              />
              <button class="btn-sm" @click="pickCliPath">Browse</button>
            </div>
          </div>
          <div class="field-row">
            <label>Tag</label>
            <input
              type="text"
              class="text-input"
              v-model="providerOptions.tag"
              placeholder="e.g. lacrosse-2026"
            />
          </div>
          <div class="field-row">
            <label>Uploaded by</label>
            <input
              type="text"
              class="text-input"
              v-model="providerOptions.uploadedBy"
              placeholder="e.g. michael"
            />
          </div>
          <div v-if="!providers.archivault?.configured" class="config-warning">
            ArchiVault config not found at ~/.archivault/config.json.
            Run <code>archivault config --bucket &lt;name&gt; --region &lt;region&gt;</code> to set up.
          </div>
        </div>
      </section>

      <!-- iCloud options -->
      <section v-if="selectedProvider === 'icloud'" class="section">
        <h3>iCloud Photos</h3>
        <div class="section-body">
          <div class="info-box">
            Files will be imported into the Photos app on this Mac.
            If iCloud Photos is enabled, they will sync automatically.
          </div>
          <div class="field-row">
            <label>Album name <span class="field-hint">(optional — creates album if it doesn't exist)</span></label>
            <input
              type="text"
              class="text-input"
              v-model="providerOptions.albumName"
              placeholder="e.g. Lacrosse 2026-06"
            />
          </div>
        </div>
      </section>

      <!-- Source selection -->
      <section class="section">
        <h3>Source</h3>
        <div class="section-body">
          <div class="source-actions">
            <button class="btn" @click="pickFiles">Select Files</button>
            <button class="btn" @click="pickFolder">Select Folder</button>
            <button v-if="session.id" class="btn" @click="loadSessionKeptFiles">Session Kept Files</button>
            <button v-if="selectedFiles.length" class="btn-sm" @click="clearFiles">Clear</button>
          </div>
          <div v-if="selectedFiles.length" class="file-summary">
            {{ selectedFiles.length }} files selected
            <span v-if="sourceFolder" class="source-path">from {{ sourceFolderName }}</span>
          </div>
          <div v-if="selectedFiles.length && selectedFiles.length <= 12" class="file-list">
            <div v-for="f in selectedFiles" :key="f" class="file-item">{{ basename(f) }}</div>
          </div>
        </div>
      </section>

      <!-- Publish -->
      <section class="section">
        <h3>Publish</h3>
        <div class="section-body">
          <button
            class="btn btn-accent"
            :disabled="!selectedFiles.length || uploading"
            @click="startUpload"
          >
            {{ uploading ? 'Uploading...' : 'Upload ' + selectedFiles.length + ' files' }}
          </button>

          <div v-if="uploading" class="upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ uploadProgress.current }} / {{ uploadProgress.total }} files
            </div>
          </div>

          <div v-if="logLines.length" class="log-wrap" ref="logWrap">
            <pre class="log-output">{{ logLines.join('\n') }}</pre>
          </div>

          <div v-if="uploadDone" class="upload-result" :class="{ error: uploadError }">
            <template v-if="uploadError">
              Upload failed: {{ uploadError }}
            </template>
            <template v-else>
              Upload complete — {{ uploadResult.uploaded }} files uploaded
            </template>
          </div>

          <div v-if="uploadDone && uploadResult?.errors" class="upload-errors">
            <div v-for="(err, i) in uploadResult.errors" :key="i" class="error-line">{{ err }}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- Empty state when no provider selected -->
    <div v-if="!selectedProvider && Object.keys(providers).length && !loadingProviders" class="empty-state-full">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 6v16M24 22l8-8M24 22l-8-8" />
        <path d="M8 28v10a2 2 0 002 2h28a2 2 0 002-2V28" />
      </svg>
      <div class="empty-title">Select a provider</div>
      <div class="empty-hint">Choose a destination above to get started</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PublishModule',
  inject: ['toast', 'appSettings', 'session', 'updatePipeline'],
  data() {
    return {
      providers: {},
      loadingProviders: true,
      selectedProvider: null,
      providerOptions: {
        cliPath: '',
        tag: '',
        uploadedBy: '',
        albumName: ''
      },
      selectedFiles: [],
      fileTags: {},
      sourceFolder: null,
      uploading: false,
      uploadDone: false,
      uploadError: null,
      uploadResult: null,
      uploadProgress: { current: 0, total: 0 },
      logLines: []
    }
  },
  computed: {
    progressPercent() {
      if (!this.uploadProgress.total) return 0
      return Math.round((this.uploadProgress.current / this.uploadProgress.total) * 100)
    },
    sourceFolderName() {
      if (!this.sourceFolder) return ''
      return this.sourceFolder.replace(/\\/g, '/').split('/').pop()
    }
  },
  async mounted() {
    this.providers = await window.api.invoke('upload:getProviders')
    this.loadingProviders = false

    await this.loadSettings()

    this._progressCleanup = window.api.on('upload:progress', (data) => {
      if (data.line) {
        this.logLines.push(data.line)
        this.$nextTick(() => {
          const wrap = this.$refs.logWrap
          if (wrap) wrap.scrollTop = wrap.scrollHeight
        })
      }
      if (data.current !== undefined) {
        this.uploadProgress.current = data.current
      }
    })
  },
  beforeUnmount() {
    if (this._progressCleanup) this._progressCleanup()
    this.saveSettings()
  },
  methods: {
    selectProvider(id) {
      this.selectedProvider = id
      this.uploadDone = false
      this.uploadError = null
      this.logLines = []
    },
    async pickFiles() {
      const result = await window.api.invoke('dialog:openFile')
      if (result) {
        this.selectedFiles = [result]
        this.fileTags = {}
        this.sourceFolder = null
      }
    },
    async pickFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (!folder) return

      const files = await window.api.invoke('fs:scanFolder', folder)
      if (files.error) {
        this.toast(files.error, 'error')
        return
      }
      if (!files.length) {
        this.toast('No image files found in folder', 'error')
        return
      }
      this.selectedFiles = files.map(f => f.path)
      this.fileTags = {}
      this.sourceFolder = folder
    },
    async loadSessionKeptFiles() {
      const files = await window.api.invoke('file:listBySession', this.session.id, { status: 'kept' })
      if (!Array.isArray(files) || !files.length) {
        this.toast('No kept files in this session', 'info')
        return
      }
      this.selectedFiles = files.map(f => f.full_path)
      this.sourceFolder = null
      // Build per-file tags map for iCloud keyword publishing
      const fileTags = {}
      for (const f of files) {
        try {
          const tags = JSON.parse(f.tags || '[]')
          if (tags.length) fileTags[f.full_path] = tags
        } catch { /* empty */ }
      }
      this.fileTags = fileTags
    },
    clearFiles() {
      this.selectedFiles = []
      this.fileTags = {}
      this.sourceFolder = null
    },
    async pickCliPath() {
      const result = await window.api.invoke('dialog:openExecutable')
      if (result) this.providerOptions.cliPath = result
    },
    async startUpload() {
      this.uploading = true
      this.uploadDone = false
      this.uploadError = null
      this.uploadResult = null
      this.logLines = []
      this.uploadProgress = { current: 0, total: this.selectedFiles.length }

      const result = await window.api.invoke(
        'upload:run',
        this.selectedProvider,
        this.selectedFiles,
        { ...this.providerOptions, fileTags: this.fileTags }
      )

      this.uploading = false
      this.uploadDone = true
      this.uploadResult = result

      if (!result.success) {
        this.uploadError = result.error
        this.toast('Upload failed: ' + result.error, 'error')
      } else {
        this.toast(`Uploaded ${result.uploaded} files`, 'success')
        if (this.session?.id) {
          await this.recordPublishedFiles(this.selectedFiles)
        }
      }

      this.saveSettings()
    },
    async recordPublishedFiles(paths) {
      const providerName = this.selectedProvider === 'archivault' ? 'ArchiVault' : 'iCloud Photos'
      for (const path of paths) {
        const rec = await window.api.invoke('file:getByPath', path)
        if (!rec || rec.error) continue
        let published = []
        try { published = JSON.parse(rec.published_to || '[]') } catch { /* empty */ }
        if (!published.includes(providerName)) {
          await window.api.invoke('file:updatePublished', rec.id, [...published, providerName])
        }
      }
      const keptFiles = await window.api.invoke('file:listBySession', this.session.id, { status: 'kept' })
      if (!Array.isArray(keptFiles) || !keptFiles.length) return
      const allPublished = keptFiles.every(f => {
        try { return JSON.parse(f.published_to || '[]').length > 0 } catch { return false }
      })
      if (allPublished) {
        this.updatePipeline('publish', true)
        this.toast('Session complete! All kept files published.', 'success')
      }
    },
    basename(p) {
      return p.replace(/\\/g, '/').split('/').pop()
    },
    async loadSettings() {
      const saved = await window.api.invoke('store:get', 'upload')
      if (saved) {
        if (saved.provider) this.selectedProvider = saved.provider
        if (saved.options) Object.assign(this.providerOptions, saved.options)
      }
      if (this.appSettings) {
        if (!this.providerOptions.cliPath && this.appSettings.archivaultCliPath) {
          this.providerOptions.cliPath = this.appSettings.archivaultCliPath
        }
        if (!this.providerOptions.tag && this.appSettings.archivaultTag) {
          this.providerOptions.tag = this.appSettings.archivaultTag
        }
        if (!this.providerOptions.uploadedBy && this.appSettings.archivaultUploadedBy) {
          this.providerOptions.uploadedBy = this.appSettings.archivaultUploadedBy
        }
      }
    },
    async saveSettings() {
      await window.api.invoke('store:set', 'upload', {
        provider: this.selectedProvider,
        options: { ...this.providerOptions }
      })
    }
  }
}
</script>

<style scoped>
.upload {
  padding: 32px;
  max-width: 900px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100%;
}

.provider-cards {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

.provider-card {
  flex: 1;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.provider-card:hover {
  border-color: var(--text2);
}

.provider-card.active {
  border-color: var(--accent);
}

.provider-card.unavailable {
  opacity: 0.4;
  pointer-events: none;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.provider-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge.configured { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
.badge.not-configured { background: rgba(255, 183, 77, 0.15); color: #ffb74d; }

.provider-desc {
  font-size: 12px;
  color: var(--text2);
}

.provider-note {
  font-size: 11px;
  color: var(--text2);
  font-style: italic;
  margin-top: 4px;
}

.upload-area {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-row label {
  font-size: 12px;
  color: var(--text2);
}

.field-hint {
  font-size: 11px;
  opacity: 0.6;
  font-weight: 400;
}

.field-input {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.text-input:focus {
  border-color: var(--accent);
}

.text-input::placeholder {
  color: var(--text2);
  opacity: 0.6;
}

.config-warning {
  font-size: 12px;
  color: #ffb74d;
  background: rgba(255, 183, 77, 0.08);
  border: 1px solid rgba(255, 183, 77, 0.2);
  border-radius: 6px;
  padding: 10px 12px;
  line-height: 1.5;
}

.config-warning code {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 5px;
  border-radius: 3px;
}

.info-box {
  font-size: 13px;
  color: var(--text2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 14px;
  line-height: 1.5;
}

.source-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.file-summary {
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
}

.source-path {
  font-weight: 400;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 12px;
}

.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.file-item {
  font-size: 11px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  background: var(--surface);
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid var(--border);
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
.btn:hover { background: var(--surface-hover); border-color: var(--border-hover); }
.btn:disabled { opacity: 0.4; cursor: default; }

.btn-accent {
  background: var(--accent);
  color: #1a1a1a;
  border-color: var(--accent);
  font-weight: 600;
  padding: 8px 22px;
}
.btn-accent:hover { background: #d4b35a; }

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

.upload-progress {
  margin-top: 4px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--surface2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.15s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text2);
  margin-top: 6px;
}

.log-wrap {
  max-height: 200px;
  overflow-y: auto;
  background: #111;
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-top: 4px;
}

.log-output {
  font-size: 11px;
  font-family: 'SF Mono', 'Menlo', monospace;
  color: #aaa;
  padding: 10px 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.upload-result {
  font-size: 13px;
  font-weight: 500;
  color: #66bb6a;
  margin-top: 8px;
}
.upload-result.error { color: #ef5350; }

.upload-errors {
  margin-top: 4px;
}

.error-line {
  font-size: 11px;
  color: #ef5350;
  font-family: 'SF Mono', 'Menlo', monospace;
  padding: 2px 0;
}
</style>
