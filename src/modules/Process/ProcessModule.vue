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
          <button v-if="session.id" class="btn" @click="loadSessionKeptFiles">Session Kept Files</button>
          <span v-if="batchSource && !sessionInputFiles.length" class="path-display">{{ batchSource }}</span>
          <span v-if="sessionInputFiles.length" class="path-display">{{ sessionInputFiles.length }} session files</span>
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

    <!-- Section 4: B&W Conversion -->
    <section class="section">
      <h3 class="collapsible" @click="bwSectionOpen = !bwSectionOpen">
        B&amp;W Conversion
        <span class="collapse-icon">{{ bwSectionOpen ? '▾' : '▸' }}</span>
      </h3>

      <!-- Always visible, even while the section is collapsed -->
      <div class="tip-card">
        <span class="tip-card-icon">💡</span>
        <div class="tip-card-text">
          <strong>B&amp;W conversion tip for the Nikon D80:</strong> In Darktable, use the Color Calibration
          module in B&amp;W filmstock mode. The D80's CCD sensor has strong color channel separation — try
          boosting the Red channel slightly to brighten skin tones and darken blue skies. Combine with the
          Tone Equalizer for local contrast.
        </div>
      </div>

      <div v-if="bwSectionOpen" class="section-body">

        <!-- Candidate count -->
        <div class="stat-card">
          <svg class="bw-stat-icon" viewBox="0 0 16 16" width="20" height="20" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M8 1.5 A6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
          </svg>
          <div class="stat-card-text">
            <template v-if="session.id">
              <span v-if="bwCandidates.length">
                {{ bwCandidates.length }} photo{{ bwCandidates.length === 1 ? '' : 's' }} tagged as B&amp;W
                Candidates in {{ session.name }}
              </span>
              <span v-else>
                No B&amp;W candidates tagged in this session. Tag photos with B in the Sorter.
              </span>
            </template>
            <template v-else>
              <span>
                {{ bwCandidates.length }} photo{{ bwCandidates.length === 1 ? '' : 's' }} tagged as B&amp;W
                Candidates across all sessions
              </span>
              <div class="stat-card-note">Start a session to work with a specific shoot.</div>
            </template>
          </div>
        </div>

        <!-- File list -->
        <div v-if="bwCandidates.length" class="bw-file-list-wrap">
          <div class="collapsible bw-file-list-toggle" @click="bwFileListOpen = !bwFileListOpen">
            <span class="collapse-icon">{{ bwFileListOpen ? '▾' : '▸' }}</span>
            <span>{{ bwCandidates.length }} file{{ bwCandidates.length === 1 ? '' : 's' }}</span>
          </div>
          <div v-if="bwFileListOpen" class="bw-file-list">
            <div v-for="f in bwCandidatesDisplayed" :key="f.id" class="bw-file-row">
              <img v-if="bwThumbnails[f.id]" :src="bwThumbnails[f.id]" class="bw-file-thumb" />
              <div v-else class="bw-file-thumb-placeholder"></div>
              <span class="bw-file-name">{{ f.filename }}</span>
              <span v-if="f.groupLabel" class="bw-file-group">{{ f.groupLabel }}</span>
            </div>
            <div v-if="bwCandidates.length > 10" class="bw-file-more">
              and {{ bwCandidates.length - 10 }} more...
            </div>
          </div>
        </div>

        <!-- Darktable style preset -->
        <div class="bw-preset-block">
          <label class="row-label-full">Darktable style preset (optional)</label>
          <div class="picker-row">
            <button class="btn" @click="pickBwStylePreset">Select .dtstyle</button>
            <span v-if="bwStylePresetPath" class="path-display">
              {{ bwStylePresetPath }}
              <button class="btn-clear" @click="clearBwStylePreset">x</button>
            </span>
          </div>
          <div class="preset-note bw-preset-note">
            A .dtstyle file saved from Darktable's Style Manager. If provided, Frame will apply it
            automatically when opening files. Leave blank to apply your B&amp;W style manually in Darktable.
          </div>
        </div>

        <!-- Launch -->
        <div class="launch-row">
          <button
            class="btn btn-accent"
            :disabled="!tools.darktable || !bwCandidates.length || bwLaunching"
            :title="bwLaunchDisabledReason"
            @click="launchBwInDarktable"
          >{{ bwLaunching ? 'Opening…' : 'Open B&W Candidates in Darktable' }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'ProcessModule',
  inject: ['toast', 'session', 'updatePipeline'],
  data() {
    return {
      tools: { darktable: null, rawtherapee: null },
      openTarget: null,
      openTargetType: null,
      batchSource: null,
      batchOutput: null,
      batchPreset: null,
      sessionInputFiles: [],
      batchRunning: false,
      batchDone: false,
      batchError: null,
      batchProcessed: 0,
      logLines: [],
      tipsOpen: false,
      guidePath: null,
      bwSectionOpen: false,
      bwFileListOpen: false,
      bwCandidates: [],
      bwThumbnails: {},
      bwStylePresetPath: null,
      bwLaunching: false
    }
  },
  computed: {
    bwCandidatesDisplayed() {
      return this.bwCandidates.slice(0, 10)
    },
    bwLaunchDisabledReason() {
      if (!this.tools.darktable) return 'Darktable not found'
      if (!this.bwCandidates.length) return 'No B&W candidates in this session'
      return ''
    },
    mostCommonBwGroupFolder() {
      const counts = {}
      for (const f of this.bwCandidates) {
        if (!f.groupFolderPath) continue
        counts[f.groupFolderPath] = (counts[f.groupFolderPath] || 0) + 1
      }
      let best = null
      let bestCount = 0
      for (const [folder, count] of Object.entries(counts)) {
        if (count > bestCount) { best = folder; bestCount = count }
      }
      return best
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

    this.bwStylePresetPath = await window.api.invoke('store:get', 'bwStylePresetPath') || null
    await this.loadBwCandidates()
    this.bwSectionOpen = !!(this.session?.id && this.bwCandidates.length)
    this.loadBwThumbnails()
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
    async loadSessionKeptFiles() {
      const files = await window.api.invoke('file:listBySession', this.session.id, { status: 'kept' })
      if (!Array.isArray(files) || !files.length) {
        this.toast('No kept files in this session', 'info')
        return
      }
      this.sessionInputFiles = files.map(f => f.full_path)
      this.batchSource = null
      this.saveSettings()
    },
    async pickBatchSource() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) { this.sessionInputFiles = []; this.batchSource = folder; this.saveSettings() }
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

      let inputPaths
      if (this.sessionInputFiles.length) {
        inputPaths = this.sessionInputFiles
      } else {
        const files = await window.api.invoke('fs:scanFolder', this.batchSource)
        if (files.error || !files.length) {
          this.batchError = 'No image files found in source folder'
          this.batchRunning = false
          this.batchDone = true
          return
        }
        inputPaths = files.map(f => f.path)
      }

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
      } else if (this.session?.id) {
        this.updatePipeline('process', true)
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
    },
    async loadBwCandidates() {
      const sessionId = this.session?.id || null
      const files = await window.api.invoke('tag:listByTag', 'bw-candidate', sessionId)
      this.bwCandidates = Array.isArray(files) ? files : []
    },
    async loadBwThumbnails() {
      for (const f of this.bwCandidatesDisplayed) {
        if (this.bwThumbnails[f.id]) continue
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 48, height: 36 })
        this.bwThumbnails = { ...this.bwThumbnails, [f.id]: thumb }
      }
    },
    async pickBwStylePreset() {
      const file = await window.api.invoke('dialog:openDarktableStyle')
      if (file) {
        this.bwStylePresetPath = file
        await window.api.invoke('store:set', 'bwStylePresetPath', file)
      }
    },
    async clearBwStylePreset() {
      this.bwStylePresetPath = null
      await window.api.invoke('store:set', 'bwStylePresetPath', null)
    },
    async launchBwInDarktable() {
      if (!this.tools.darktable || !this.bwCandidates.length || this.bwLaunching) return
      this.bwLaunching = true
      try {
        const filePaths = this.bwCandidates.map(f => f.full_path)
        const presetExists = this.bwStylePresetPath &&
          await window.api.invoke('fs:fileExists', this.bwStylePresetPath)

        if (presetExists) {
          const styleName = this.bwStylePresetPath.split('/').pop().replace(/\.dtstyle$/i, '')
          await window.api.invoke('tools:openFiles', this.tools.darktable, filePaths, styleName)
        } else if (this.mostCommonBwGroupFolder) {
          await window.api.invoke('tools:openFolder', this.tools.darktable, this.mostCommonBwGroupFolder)
        } else {
          await window.api.invoke('tools:openFiles', this.tools.darktable, filePaths, null)
        }

        this.toast(`Opening ${filePaths.length} files in Darktable`, 'info')
      } finally {
        this.bwLaunching = false
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

/* ── B&W Conversion ───────────────────────────── */
.stat-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

.bw-stat-icon {
  flex-shrink: 0;
  color: var(--text2);
  margin-top: 1px;
}

.stat-card-text {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
}

.stat-card-note {
  font-size: 12px;
  color: var(--text2);
  margin-top: 4px;
}

.bw-file-list-wrap {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.bw-file-list-toggle {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text2);
  background: var(--surface);
}

.bw-file-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.bw-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px;
}

.bw-file-thumb {
  width: 48px;
  height: 36px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.bw-file-thumb-placeholder {
  width: 48px;
  height: 36px;
  border-radius: 3px;
  background: var(--surface2);
  flex-shrink: 0;
}

.bw-file-name {
  font-size: 12px;
  color: var(--text);
  font-family: 'SF Mono', 'Menlo', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.bw-file-group {
  font-size: 11px;
  color: var(--text2);
  flex-shrink: 0;
}

.bw-file-more {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text2);
  font-style: italic;
}

.bw-preset-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row-label-full {
  font-size: 12px;
  color: var(--text2);
}

.bw-preset-note {
  padding-left: 0;
}

.tip-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 14px;
}

.tip-card-icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.4;
}

.tip-card-text {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.6;
}

.tip-card-text strong {
  color: var(--text);
}
</style>
