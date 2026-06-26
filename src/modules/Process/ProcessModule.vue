<template>
  <div class="process">
    <!-- Tool status -->
    <div class="tool-status">
      <div class="tool-card">
        <div class="tool-header">
          <h4>Darktable</h4>
          <span v-if="tools.darktable" class="badge installed">Installed</span>
          <span v-else class="badge missing">Not Found</span>
        </div>
        <div v-if="tools.darktable" class="tool-path">{{ tools.darktable }}</div>
        <div v-else class="tool-missing">
          <span class="expected">Expected: /Applications/darktable.app</span>
          <a class="install-link" @click="openUrl('https://www.darktable.org')">Install from darktable.org</a>
        </div>
      </div>
      <div class="tool-card">
        <div class="tool-header">
          <h4>RawTherapee</h4>
          <span v-if="tools.rawtherapee" class="badge installed">Installed</span>
          <span v-else class="badge missing">Not Found</span>
        </div>
        <div v-if="tools.rawtherapee" class="tool-path">{{ tools.rawtherapee }}</div>
        <div v-else class="tool-missing">
          <span class="expected">Expected: /Applications/RawTherapee.app</span>
          <a class="install-link" @click="openUrl('https://www.rawtherapee.com')">Install from rawtherapee.com</a>
        </div>
      </div>
    </div>

    <!-- Section 1: Open in tool -->
    <section class="section">
      <h3>Open in External Tool</h3>
      <div class="section-body">
        <div class="picker-row">
          <button class="btn" @click="pickOpenTarget('file')">Select File</button>
          <button class="btn" @click="pickOpenTarget('folder')">Select Folder</button>
          <span v-if="openTarget" class="path-display">{{ openTarget }}</span>
        </div>
        <div class="launch-row">
          <button
            class="btn btn-launch"
            :disabled="!openTarget || !tools.darktable"
            :title="!tools.darktable ? 'Darktable is not installed' : ''"
            @click="launchTool('darktable')"
          >Open in Darktable</button>
          <button
            class="btn btn-launch"
            :disabled="!openTarget || !tools.rawtherapee"
            :title="!tools.rawtherapee ? 'RawTherapee is not installed' : ''"
            @click="launchTool('rawtherapee')"
          >Open in RawTherapee</button>
        </div>
      </div>
    </section>

    <!-- Section 2: Batch export -->
    <section v-if="tools.rawtherapee" class="section">
      <h3>RawTherapee Batch Export</h3>
      <div class="section-body">
        <div class="picker-row">
          <label class="row-label">Source:</label>
          <button class="btn" @click="pickBatchSource">Select Folder</button>
          <span v-if="batchSource" class="path-display">{{ batchSource }}</span>
        </div>
        <div class="picker-row">
          <label class="row-label">Output:</label>
          <button class="btn" @click="pickBatchOutput">Select Folder</button>
          <span v-if="batchOutput" class="path-display">{{ batchOutput }}</span>
        </div>
        <div class="picker-row">
          <label class="row-label">Preset:</label>
          <button class="btn" @click="pickPreset">Select .pp3</button>
          <span v-if="batchPreset" class="path-display">
            {{ batchPreset }}
            <button class="btn-clear" @click="batchPreset = null; saveSettings()">x</button>
          </span>
        </div>
        <div class="preset-note">
          Presets are RawTherapee .pp3 files saved from within RawTherapee. Leave blank to use RawTherapee defaults.
        </div>

        <div class="batch-actions">
          <button
            class="btn btn-accent"
            :disabled="!batchSource || !batchOutput || batchRunning"
            @click="runBatch"
          >{{ batchRunning ? 'Running...' : 'Run Batch Export' }}</button>
          <span v-if="batchRunning" class="batch-progress">
            {{ batchProcessed }} files processed
          </span>
          <button v-if="batchDone" class="btn" @click="openOutputFolder">
            Open Output Folder in Finder
          </button>
        </div>

        <div v-if="logLines.length" class="log-wrap" ref="logWrap">
          <pre class="log-output">{{ logLines.join('\n') }}</pre>
        </div>

        <div v-if="batchDone" class="batch-result" :class="{ error: batchError }">
          {{ batchError ? 'Export failed: ' + batchError : 'Export complete' }}
        </div>
      </div>
    </section>

    <!-- Section 3: Workflow tips -->
    <section class="section">
      <h3 class="collapsible" @click="tipsOpen = !tipsOpen">
        Workflow Tips
        <span class="collapse-icon">{{ tipsOpen ? '▾' : '▸' }}</span>
      </h3>
      <div v-if="tipsOpen" class="section-body tips">
        <div class="tip">
          <strong>Darktable</strong> — Best for automated noise reduction using the Denoise Profiled module.
          Ideal for high-ISO action shots from cameras like the D80.
        </div>
        <div class="tip">
          <strong>RawTherapee</strong> — Excellent for fine detail recovery and batch exporting large sets
          with consistent presets. Use the CLI for automated processing.
        </div>
        <div class="tip">
          <strong>Recommended workflow:</strong> Triage to group shots by event, Sort to pick keepers,
          then Process batches through RawTherapee for export. Use Darktable for individual images
          that need noise cleanup.
        </div>
        <div class="tip-link" v-if="guidePath">
          <a @click="openGuide">Open Photography Field Guide (PDF)</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'ProcessModule',
  inject: ['toast'],
  data() {
    return {
      tools: { darktable: null, rawtherapee: null },
      openTarget: null,
      openTargetType: null,
      batchSource: null,
      batchOutput: null,
      batchPreset: null,
      batchRunning: false,
      batchDone: false,
      batchError: null,
      batchProcessed: 0,
      logLines: [],
      tipsOpen: false,
      guidePath: null
    }
  },
  async mounted() {
    this.tools = await window.api.invoke('tools:findInstalled')
    await this.loadSettings()

    this._progressCleanup = window.api.on('tools:batchProgress', (line) => {
      this.logLines.push(line)
      if (line.toLowerCase().includes('processing')) {
        this.batchProcessed++
      }
      this.$nextTick(() => {
        const wrap = this.$refs.logWrap
        if (wrap) wrap.scrollTop = wrap.scrollHeight
      })
    })

    const guideCandidates = [
      '/Users/Shared/D80_Lacrosse_Photography_Guide.pdf',
      await window.api.invoke('app:getTempDir').then(d =>
        d.replace('/.frame/temp', '/Documents/D80_Lacrosse_Photography_Guide.pdf')
      )
    ]
    for (const p of guideCandidates) {
      try {
        const result = await window.api.invoke('fs:scanFolder', p.replace(/\/[^/]+$/, '/'))
        if (!result.error) {
          const name = p.split('/').pop()
          const found = result.find && result.find(f => f.name === name)
          if (found) { this.guidePath = p; break }
        }
      } catch { /* ignore */ }
    }
  },
  beforeUnmount() {
    if (this._progressCleanup) this._progressCleanup()
    this.saveSettings()
  },
  methods: {
    async loadSettings() {
      this.openTarget = await window.api.invoke('store:get', 'process.openTarget') || null
      this.openTargetType = await window.api.invoke('store:get', 'process.openTargetType') || null
      this.batchSource = await window.api.invoke('store:get', 'process.batchSource') || null
      this.batchOutput = await window.api.invoke('store:get', 'process.batchOutput') || null
      this.batchPreset = await window.api.invoke('store:get', 'process.batchPreset') || null
    },
    async saveSettings() {
      await window.api.invoke('store:set', 'process.openTarget', this.openTarget)
      await window.api.invoke('store:set', 'process.openTargetType', this.openTargetType)
      await window.api.invoke('store:set', 'process.batchSource', this.batchSource)
      await window.api.invoke('store:set', 'process.batchOutput', this.batchOutput)
      await window.api.invoke('store:set', 'process.batchPreset', this.batchPreset)
    },
    async pickOpenTarget(type) {
      let result
      if (type === 'file') {
        result = await window.api.invoke('dialog:openFile')
      } else {
        result = await window.api.invoke('dialog:openFolder')
      }
      if (result) {
        this.openTarget = result
        this.openTargetType = type
        this.saveSettings()
      }
    },
    async launchTool(tool) {
      const toolPath = this.tools[tool]
      if (!toolPath || !this.openTarget) return
      if (this.openTargetType === 'file') {
        await window.api.invoke('tools:openFile', toolPath, this.openTarget)
      } else {
        await window.api.invoke('tools:openFolder', toolPath, this.openTarget)
      }
    },
    async pickBatchSource() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) { this.batchSource = folder; this.saveSettings() }
    },
    async pickBatchOutput() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) { this.batchOutput = folder; this.saveSettings() }
    },
    async pickPreset() {
      const file = await window.api.invoke('dialog:openPreset')
      if (file) { this.batchPreset = file; this.saveSettings() }
    },
    async runBatch() {
      this.batchRunning = true
      this.batchDone = false
      this.batchError = null
      this.batchProcessed = 0
      this.logLines = []

      const files = await window.api.invoke('fs:scanFolder', this.batchSource)
      if (files.error || !files.length) {
        this.batchError = 'No image files found in source folder'
        this.batchRunning = false
        this.batchDone = true
        return
      }

      const inputPaths = files.map(f => f.path)
      const preset = this.batchPreset || ''

      const result = await window.api.invoke(
        'tools:runBatchExport',
        this.tools.rawtherapee,
        inputPaths,
        this.batchOutput,
        preset
      )

      this.batchRunning = false
      this.batchDone = true
      if (!result.success) {
        this.batchError = result.error
      }
    },
    async openOutputFolder() {
      await window.api.invoke('shell:openPath', this.batchOutput)
    },
    async openUrl(url) {
      await window.api.invoke('shell:openExternal', url)
    },
    async openGuide() {
      if (this.guidePath) {
        await window.api.invoke('shell:openPath', this.guidePath)
      }
    }
  }
}
</script>

<style scoped>
.process {
  padding: 32px;
  max-width: 900px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100%;
}

.tool-status {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

.tool-card {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.tool-header h4 {
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

.badge.installed { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
.badge.missing { background: rgba(239, 83, 80, 0.15); color: #ef5350; }

.tool-path {
  font-size: 11px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.tool-missing {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expected {
  font-size: 11px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.install-link {
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
}
.install-link:hover { color: #d4b35a; }

.section {
  margin-bottom: 28px;
}

.section h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 14px;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.row-label {
  font-size: 12px;
  color: var(--text2);
  width: 56px;
  flex-shrink: 0;
}

.path-display {
  font-size: 12px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  background: var(--surface);
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-clear {
  background: none;
  border: none;
  color: var(--text2);
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px;
}
.btn-clear:hover { color: var(--text); }

.preset-note {
  font-size: 11px;
  color: var(--text2);
  font-style: italic;
  padding-left: 66px;
}

.launch-row {
  display: flex;
  gap: 10px;
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
.btn:hover { background: var(--surface-hover); border-color: rgba(255,255,255,0.15); }
.btn:disabled { opacity: 0.4; cursor: default; }

.btn-launch { padding: 8px 18px; }

.btn-accent {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
  font-weight: 600;
}
.btn-accent:hover { background: #d4b35a; }

.batch-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
}

.batch-progress {
  font-size: 12px;
  color: var(--text2);
}

.log-wrap {
  max-height: 240px;
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

.batch-result {
  font-size: 13px;
  font-weight: 500;
  color: #66bb6a;
  margin-top: 4px;
}
.batch-result.error { color: #ef5350; }

.collapsible {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-icon {
  font-size: 12px;
  color: var(--text2);
}

.tips {
  padding-left: 4px;
}

.tip {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.6;
  margin-bottom: 10px;
}

.tip strong { color: var(--text); }

.tip-link a {
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
}
.tip-link a:hover { color: #d4b35a; }
</style>
