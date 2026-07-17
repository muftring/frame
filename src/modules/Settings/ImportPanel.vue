<template>
  <div class="import-panel">
    <h4>Import Frame Library</h4>
    <p class="section-desc">
      Replace your current library with a .framelib export.
      Your current library will be backed up first.
    </p>

    <button class="btn-sm import-btn" @click="openImport()">Import library…</button>

    <div v-if="modalOpen" class="import-backdrop" @click.self="canDismiss && closeModal()">
      <div class="import-modal">
        <div class="modal-header">
          <span>Import Frame Library</span>
          <span class="step-counter">Step {{ step }} of 5</span>
        </div>

        <div class="modal-body">
          <!-- Step 1: Select file -->
          <div v-if="step === 1" class="import-step">
            <p class="step-desc">Choose a .framelib export to import.</p>
            <button class="btn-sm" @click="pickFile">Select .framelib file…</button>
            <div v-if="fileError" class="warn-box">{{ fileError }}</div>
          </div>

          <!-- Step 2: Summary -->
          <div v-else-if="step === 2 && manifest" class="import-step">
            <p class="step-desc">This library contains:</p>
            <div class="summary-line">{{ manifest.sessionCount }} sessions &middot; {{ manifest.fileCount }} photos &middot; exported {{ formatDate(manifest.exportDate) }}</div>
            <div class="summary-line muted">From: {{ manifest.hostname }} on {{ manifest.platform }}</div>
            <div class="warn-box">
              Importing will replace your current Frame library. A backup of your current library will be created automatically before import.
            </div>
          </div>

          <!-- Step 3: Path remapping -->
          <div v-else-if="step === 3" class="import-step">
            <p class="step-desc">Some photo locations from the exported library weren't found on this machine.</p>
            <div v-for="root in manifest.photoRoots" :key="root" class="root-row">
              <div class="root-old">{{ root }}</div>
              <div v-if="rootChecks[root]" class="root-status found">&check; Found</div>
              <div v-else-if="mappings[root]?.skipped" class="root-status skip">Skipped</div>
              <div v-else-if="mappings[root]?.newRoot" class="root-status found">→ {{ mappings[root].newRoot }}</div>
              <div v-else class="root-actions">
                <button class="btn-sm" @click="pickNewLocation(root)">Pick new location</button>
                <a class="skip-link" @click="skipRoot(root)">Skip</a>
              </div>
            </div>
          </div>

          <!-- Step 4: Confirmation -->
          <div v-else-if="step === 4" class="import-step">
            <p class="step-desc">Ready to import:</p>
            <div class="confirm-line">&check; {{ manifest.sessionCount }} sessions, {{ manifest.fileCount }} photos</div>
            <div v-if="manifest.includedThumbs" class="confirm-line">&check; {{ manifest.thumbCount }} thumbnail files</div>
            <div class="confirm-line">&check; Settings from {{ manifest.hostname }}</div>
            <div class="confirm-line">&check; Your current library will be backed up first</div>
            <div v-for="root in skippedRoots" :key="root" class="confirm-line warn">&#9888; Skipped: {{ root }} (files under this path will have broken links)</div>
          </div>

          <!-- Step 5: Progress -->
          <div v-else-if="step === 5" class="import-step">
            <template v-if="!importResult && !importError">
              <p class="step-desc">Importing library…</p>
              <div v-for="(s, i) in PROGRESS_STEPS" :key="s.key" class="progress-line">
                <span class="progress-mark">{{ i <= progressStepIndex ? '✓' : '○' }}</span>
                {{ s.label }}
              </div>
            </template>
            <template v-else-if="importResult">
              <p class="step-desc success">Import complete! Frame will restart now.</p>
            </template>
            <template v-else>
              <div class="warn-box">{{ importError }}</div>
              <p class="step-desc">Your original library has been preserved as a backup.</p>
            </template>
          </div>
        </div>

        <div class="modal-footer">
          <template v-if="step === 1">
            <span></span>
            <span></span>
          </template>
          <template v-else-if="step === 2">
            <button class="btn-sm" @click="step = 1">Back</button>
            <button class="btn-sm primary" @click="continueFromSummary">Continue →</button>
          </template>
          <template v-else-if="step === 3">
            <button class="btn-sm" @click="step = 2">Back</button>
            <button class="btn-sm primary" :disabled="!allRootsResolved" @click="step = 4">Continue →</button>
          </template>
          <template v-else-if="step === 4">
            <button class="btn-sm" @click="backFromConfirm">Back</button>
            <button class="btn-sm primary" @click="confirmImport">Import and restart</button>
          </template>
          <template v-else-if="step === 5 && importError">
            <span></span>
            <button class="btn-sm" @click="closeModal">Close</button>
          </template>
          <template v-else>
            <span></span>
            <span></span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const PROGRESS_STEPS = [
  { key: 'backup', label: 'Creating backup of current library' },
  { key: 'extract', label: 'Extracting archive' },
  { key: 'validate', label: 'Validating database' },
  { key: 'remap', label: 'Applying path remappings' },
  { key: 'copy', label: 'Copying files' },
  { key: 'settings', label: 'Updating settings' }
]

export default {
  name: 'ImportPanel',
  inject: {
    setModalOpen: { default: () => () => {} }
  },
  data() {
    return {
      PROGRESS_STEPS,
      modalOpen: false,
      step: 1,
      filePath: null,
      manifest: null,
      fileError: null,
      rootChecks: {},
      mappings: {},
      importing: false,
      progressStepIndex: -1,
      importResult: null,
      importError: null,
      _unsubscribeProgress: null
    }
  },
  computed: {
    missingRoots() {
      if (!this.manifest) return []
      return this.manifest.photoRoots.filter(r => this.rootChecks[r] === false)
    },
    allRootsResolved() {
      return this.missingRoots.every(r => this.mappings[r]?.newRoot || this.mappings[r]?.skipped)
    },
    skippedRoots() {
      return this.missingRoots.filter(r => this.mappings[r]?.skipped)
    },
    pathMappingsList() {
      return this.missingRoots
        .filter(r => this.mappings[r]?.newRoot)
        .map(r => ({ oldRoot: r, newRoot: this.mappings[r].newRoot }))
    },
    canDismiss() {
      return this.step < 5 || !!this.importError
    }
  },
  beforeUnmount() {
    if (this._unsubscribeProgress) this._unsubscribeProgress()
  },
  methods: {
    async openImport(prefilledPath = null) {
      this.resetState()
      this.modalOpen = true
      this.setModalOpen(true)
      if (prefilledPath) {
        this.filePath = prefilledPath
        await this.fetchManifest()
      }
    },
    resetState() {
      this.step = 1
      this.filePath = null
      this.manifest = null
      this.fileError = null
      this.rootChecks = {}
      this.mappings = {}
      this.importing = false
      this.progressStepIndex = -1
      this.importResult = null
      this.importError = null
    },
    closeModal() {
      this.modalOpen = false
      this.setModalOpen(false)
    },
    async pickFile() {
      const picked = await window.api.invoke('dialog:openFramelib')
      if (!picked) return
      this.filePath = picked
      await this.fetchManifest()
    },
    async fetchManifest() {
      this.fileError = null
      const result = await window.api.invoke('library:getManifest', this.filePath)
      if (!result.success) {
        this.fileError = result.error
        return
      }
      this.manifest = result.manifest
      this.step = 2
      this.checkRoots()
    },
    async checkRoots() {
      for (const root of this.manifest.photoRoots) {
        const exists = await window.api.invoke('fs:pathExists', root)
        this.rootChecks = { ...this.rootChecks, [root]: exists }
        if (!exists && !this.mappings[root]) {
          this.mappings = { ...this.mappings, [root]: { newRoot: null, skipped: false } }
        }
      }
    },
    continueFromSummary() {
      this.step = this.missingRoots.length === 0 ? 4 : 3
    },
    backFromConfirm() {
      this.step = this.missingRoots.length === 0 ? 2 : 3
    },
    async pickNewLocation(root) {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.mappings = { ...this.mappings, [root]: { newRoot: folder, skipped: false } }
      }
    },
    skipRoot(root) {
      this.mappings = { ...this.mappings, [root]: { newRoot: null, skipped: true } }
    },
    async confirmImport() {
      this.step = 5
      this.importing = true
      this.progressStepIndex = -1
      this._unsubscribeProgress = window.api.on('library:importProgress', ({ step }) => {
        this.progressStepIndex = PROGRESS_STEPS.findIndex(s => s.key === step)
      })

      const result = await window.api.invoke('library:import', this.filePath, this.pathMappingsList)

      this.importing = false
      if (this._unsubscribeProgress) {
        this._unsubscribeProgress()
        this._unsubscribeProgress = null
      }

      if (result.success) {
        this.importResult = result
        setTimeout(() => window.api.invoke('app:relaunch'), 2000)
      } else {
        this.importError = result.error || 'Import failed.'
      }
    },
    formatDate(iso) {
      if (!iso) return ''
      return new Date(iso).toLocaleDateString()
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

.import-btn {
  width: 100%;
  text-align: center;
  padding: 7px 10px;
}

.warn-box {
  font-size: 12px;
  color: var(--text);
  background: rgba(178, 34, 34, 0.12);
  border: 1px solid rgba(178, 34, 34, 0.4);
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 10px;
  line-height: 1.4;
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

.import-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.import-modal {
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.step-counter {
  font-size: 11px;
  font-weight: 400;
  color: var(--text2);
}

.modal-body {
  padding: 16px;
  flex: 1;
}

.step-desc {
  font-size: 13px;
  color: var(--text);
  margin-bottom: 10px;
}
.step-desc.success { color: var(--accent); }

.summary-line {
  font-size: 12px;
  color: var(--text);
  margin-bottom: 6px;
}
.summary-line.muted { color: var(--text2); }

.root-row {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.root-row:last-child { border-bottom: none; }

.root-old {
  font-size: 11px;
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text2);
  margin-bottom: 6px;
  word-break: break-all;
}

.root-status.found { font-size: 12px; color: var(--accent); word-break: break-all; }
.root-status.skip { font-size: 12px; color: var(--text2); }

.root-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.skip-link {
  font-size: 11px;
  color: var(--text2);
  cursor: pointer;
  text-decoration: underline;
}
.skip-link:hover { color: var(--text); }

.confirm-line {
  font-size: 12px;
  color: var(--text);
  margin-bottom: 6px;
}
.confirm-line.warn { color: #d99a3a; }

.progress-line {
  font-size: 12px;
  color: var(--text2);
  margin-bottom: 8px;
}

.progress-mark {
  display: inline-block;
  width: 16px;
  color: var(--accent);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.btn-sm.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a1a1a;
  font-weight: 600;
}
.btn-sm.primary:disabled { opacity: 0.4; }
</style>
