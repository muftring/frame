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

    <!-- Section 5: Panorama Stitching -->
    <section class="section">
      <h3 class="collapsible" @click="panoSectionOpen = !panoSectionOpen">
        Panorama Stitching
        <span class="collapse-icon">{{ panoSectionOpen ? '▾' : '▸' }}</span>
      </h3>

      <div class="tip-card">
        <span class="tip-card-icon">💡</span>
        <div class="tip-card-text">
          <strong>D80 panorama tip:</strong> Shoot in Manual mode with fixed ISO and shutter speed — exposure
          differences between frames cause visible seams. Lock white balance to Direct Sunlight. Use 30-40%
          overlap. At 80mm on the D80 crop sensor, expect 4-6 frames for a 180° panorama.
        </div>
      </div>

      <div v-if="panoSectionOpen" class="section-body">

        <!-- Hugin status -->
        <div class="tool-card pano-tool-card">
          <div class="tool-header">
            <h4>Hugin</h4>
            <span v-if="tools.hugin" class="badge installed">Installed</span>
            <span v-else class="badge missing">Not Found</span>
          </div>
          <div v-if="tools.hugin" class="tool-path">{{ tools.hugin }}</div>
          <div v-else class="tool-missing">
            <span class="expected">Expected: /Applications/Hugin/Hugin.app</span>
            <a class="install-link" @click="openUrl('https://hugin.sourceforge.io')">Download Hugin</a>
            <span class="brew-note">macOS: brew install hugin</span>
          </div>
        </div>

        <!-- Pano set selector -->
        <template v-if="session.pendingPanoSetId && !changingSet">
          <div class="picker-row">
            <label class="row-label">Set:</label>
            <span class="path-display">{{ selectedPanoSet?.name || 'Panorama set' }} — {{ panoSetFiles.length }} frames</span>
            <button class="btn" @click="changingSet = true">Change</button>
          </div>
        </template>
        <template v-else-if="session.id">
          <div class="picker-row">
            <label class="row-label">Set:</label>
            <select v-model.number="selectedPanoSetId" class="setting-select" @change="selectPanoSet(selectedPanoSetId)">
              <option :value="null" disabled>Select a confirmed panorama set…</option>
              <option v-for="s in confirmedPanoSets" :key="s.id" :value="s.id">{{ s.name }} ({{ s.frame_count }} frames)</option>
            </select>
          </div>
          <div v-if="!confirmedPanoSets.length" class="preset-note">
            No confirmed panorama sets in this session yet. Confirm a set in Gallery first.
          </div>
        </template>
        <template v-else>
          <div class="picker-row">
            <button class="btn" @click="pickFolderDirect">Select Folder</button>
            <span v-if="folderFiles.length" class="path-display">{{ folderFiles.length }} images</span>
          </div>
        </template>

        <!-- Selected set preview -->
        <div v-if="panoSetFiles.length" class="pano-preview">
          <div class="pano-thumb-strip">
            <div v-for="(f, i) in panoSetFiles" :key="f.id || f.full_path" class="pano-preview-thumb">
              <img v-if="panoThumbnails[f.id || f.full_path]" :src="panoThumbnails[f.id || f.full_path]" />
              <div v-else class="pano-preview-thumb-placeholder"></div>
              <span class="frame-number">{{ i + 1 }}</span>
            </div>
          </div>
          <div class="pano-preview-meta">{{ panoSetFiles.length }} frames  ·  {{ panoTimeSpanText }}</div>
          <div class="pano-preview-meta">Output: <span class="output-filename">{{ outputFilename }}</span></div>
        </div>

        <!-- Output folder -->
        <div class="picker-row">
          <label class="row-label">Output:</label>
          <button class="btn" @click="pickOutputFolder">Select Folder</button>
          <span v-if="outputFolder" class="path-display">{{ outputFolder }}</span>
        </div>

        <!-- Advanced options -->
        <div class="settings-section">
          <h4 class="settings-heading collapsible" @click="advancedPanoOpen = !advancedPanoOpen">
            Advanced options
            <span class="collapse-icon">{{ advancedPanoOpen ? '▾' : '▸' }}</span>
          </h4>
          <template v-if="advancedPanoOpen">
            <div class="radio-group-vertical">
              <label class="radio-option">
                <input type="radio" :value="0" v-model.number="projection" />
                <span>Rectilinear <span class="setting-helper">Best for small angle panoramas (&lt;120°)</span></span>
              </label>
              <label class="radio-option">
                <input type="radio" :value="2" v-model.number="projection" />
                <span>Cylindrical <span class="setting-helper">Best for wide landscape panoramas</span></span>
              </label>
              <label class="radio-option">
                <input type="radio" :value="4" v-model.number="projection" />
                <span>Equirectangular <span class="setting-helper">Best for 360° panoramas</span></span>
              </label>
            </div>

            <div class="setting-row">
              <label class="setting-label">Output quality</label>
              <input type="range" min="70" max="100" step="1" v-model.number="quality" class="slider" />
              <span class="setting-value">JPEG quality: {{ quality }}</span>
            </div>

            <div class="setting-row toggle-row">
              <label class="setting-label">Output size</label>
              <div class="dir-toggle">
                <button class="dir-btn" :class="{ active: outputSizeMode === 'auto' }" @click="outputSizeMode = 'auto'">Auto</button>
                <button class="dir-btn" :class="{ active: outputSizeMode === 'custom' }" @click="outputSizeMode = 'custom'">Custom</button>
              </div>
            </div>
            <div class="setting-row" v-if="outputSizeMode === 'custom'">
              <label class="setting-label">Width (px)</label>
              <input type="number" min="500" max="20000" v-model.number="customWidth" class="field-input-sm" />
              <span class="setting-value">height auto</span>
            </div>
          </template>
        </div>

        <!-- Launch mode -->
        <div class="settings-section">
          <h4 class="settings-heading">Launch mode</h4>
          <label class="launch-mode-option">
            <input type="radio" value="hugin" v-model="launchMode" />
            <div>
              <div class="launch-mode-title">Open in Hugin (interactive)</div>
              <div class="setting-helper">Hugin opens with your frames loaded. Complete the stitch in Hugin.</div>
            </div>
          </label>
          <label class="launch-mode-option" :class="{ disabled: !quickStitchAvailable }">
            <input type="radio" value="quickstitch" v-model="launchMode" :disabled="!quickStitchAvailable" />
            <div>
              <div class="launch-mode-title">Quick stitch (automatic CLI)</div>
              <div class="setting-helper">Frame attempts automatic stitching. Works best with level horizon and consistent exposure.</div>
              <div v-if="!quickStitchAvailable" class="setting-helper quick-stitch-disabled-reason">Requires nona, enblend, and cpfind (bundled with Hugin installation)</div>
            </div>
          </label>
        </div>

        <!-- Launch -->
        <div class="launch-row">
          <button class="btn btn-accent" :disabled="!canLaunch" @click="launch">
            {{ launchMode === 'hugin' ? 'Open in Hugin' : 'Run quick stitch' }}
          </button>
        </div>

        <!-- Quick stitch progress -->
        <div v-if="stitching || stitchResult" class="stitch-progress">
          <div class="stitch-steps">
            <div
              v-for="step in STITCH_STEPS"
              :key="step.id"
              class="stitch-step"
              :class="{ active: stitchStep === step.id, done: isStepDone(step.id) }"
            >{{ isStepDone(step.id) ? '✓ ' : '' }}{{ step.label }}</div>
          </div>

          <div v-if="stitchLog.length" class="log-wrap" ref="stitchLogWrap">
            <pre class="log-output">{{ stitchLog.join('\n') }}</pre>
          </div>

          <div v-if="stitching" class="stitch-actions">
            <button class="btn btn-danger" @click="cancelStitch">Cancel</button>
          </div>

          <div v-if="stitchResult && stitchResult.success" class="stitch-complete">
            <div class="stitch-complete-filename">{{ outputFilename }}</div>
            <img v-if="stitchThumbnail" :src="stitchThumbnail" class="stitch-complete-thumb" />
            <div class="stitch-complete-actions">
              <button class="btn" @click="revealStitchOutput">Reveal in Finder</button>
              <button class="btn btn-accent" @click="openStitchInGallery">Open in Gallery</button>
            </div>
          </div>
          <div v-if="stitchResult && !stitchResult.success" class="stitch-error">
            Stitch failed at step "{{ stitchResult.step }}": {{ stitchResult.error }}
          </div>
        </div>

      </div>
    </section>
  </div>
</template>

<script>
const STITCH_STEPS = [
  { id: 'pto', label: 'Generate .pto' },
  { id: 'findpoints', label: 'Find control points' },
  { id: 'optimise', label: 'Optimise' },
  { id: 'remap', label: 'Remap' },
  { id: 'blend', label: 'Blend' },
  { id: 'done', label: 'Done' }
]
const STITCH_STEP_ORDER = STITCH_STEPS.map(s => s.id)

export default {
  name: 'ProcessModule',
  inject: ['toast', 'session', 'updatePipeline'],
  emits: ['navigate'],
  data() {
    return {
      tools: { darktable: null, rawtherapee: null, hugin: null, huginCli: { nona: null, enblend: null, autooptimiser: null, cpfind: null } },
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
      bwLaunching: false,
      STITCH_STEPS,
      panoSectionOpen: false,
      advancedPanoOpen: false,
      confirmedPanoSets: [],
      selectedPanoSetId: null,
      changingSet: false,
      panoSetFiles: [],
      panoThumbnails: {},
      folderFiles: [],
      outputFolder: null,
      projection: 2,
      quality: 92,
      outputSizeMode: 'auto',
      customWidth: 4000,
      launchMode: 'hugin',
      stitching: false,
      stitchStep: null,
      stitchLog: [],
      stitchResult: null,
      stitchThumbnail: null,
      _stitchCancelled: false
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
    },
    selectedPanoSet() {
      return this.confirmedPanoSets.find(s => s.id === this.selectedPanoSetId) || null
    },
    quickStitchAvailable() {
      return !!(this.tools.huginCli?.nona && this.tools.huginCli?.enblend && this.tools.huginCli?.autooptimiser && this.tools.huginCli?.cpfind)
    },
    canLaunch() {
      if (!this.panoSetFiles.length) return false
      if (this.launchMode === 'hugin') return !!this.tools.hugin
      return this.quickStitchAvailable && !!this.outputFolder
    },
    panoTimeSpanText() {
      const ts = this.panoSetFiles.map(f => f.exif_ts).filter(t => t != null)
      if (ts.length < 2) return '—'
      const spanSec = (Math.max(...ts) - Math.min(...ts)) / 1000
      if (spanSec < 60) return `${spanSec.toFixed(0)}s span`
      const min = Math.floor(spanSec / 60)
      const sec = Math.round(spanSec % 60)
      return sec > 0 ? `${min}m ${sec}s span` : `${min}m span`
    },
    outputFilename() {
      const sanitize = (s) => (s || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
      const sessionName = sanitize(this.session?.name) || 'Session'
      const setName = sanitize(this.selectedPanoSet?.name) || 'Panorama'
      return `${sessionName}_${setName}_panorama.jpg`
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

    this.outputFolder = await window.api.invoke('store:get', 'panoOutputFolder') || null
    if (this.session?.id) {
      const sets = await window.api.invoke('pano:listSets', this.session.id)
      this.confirmedPanoSets = Array.isArray(sets) ? sets.filter(s => s.status === 'confirmed') : []
    }
    if (this.session?.pendingPanoSetId) {
      this.panoSectionOpen = true
      await this.selectPanoSet(this.session.pendingPanoSetId)
    }

    this._panoProgressCleanup = window.api.on('tools:panoProgress', ({ step, line }) => {
      this.stitchStep = step
      this.stitchLog.push(line)
      this.$nextTick(() => {
        const wrap = this.$refs.stitchLogWrap
        if (wrap) wrap.scrollTop = wrap.scrollHeight
      })
    })
  },
  beforeUnmount() {
    if (this._panoProgressCleanup) this._panoProgressCleanup()
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
    },
    isStepDone(stepId) {
      if (this.stitchResult?.success) return true
      if (!this.stitchStep) return false
      return STITCH_STEP_ORDER.indexOf(stepId) < STITCH_STEP_ORDER.indexOf(this.stitchStep)
    },
    async selectPanoSet(id) {
      this.selectedPanoSetId = id
      this.changingSet = false
      const files = await window.api.invoke('pano:listFiles', id)
      this.panoSetFiles = Array.isArray(files) ? files : []
      await this.loadPanoThumbnails()
      if (!this.outputFolder && this.panoSetFiles.length) {
        this.outputFolder = this.panoSetFiles[0].full_path.replace(/\/[^/]+$/, '')
      }
    },
    async pickFolderDirect() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (!folder) return
      const files = await window.api.invoke('fs:scanFolder', folder)
      this.folderFiles = Array.isArray(files) ? files : []
      this.panoSetFiles = this.folderFiles.map(f => ({ full_path: f.path, filename: f.name }))
      await this.loadPanoThumbnails()
      if (!this.outputFolder) this.outputFolder = folder
    },
    async loadPanoThumbnails() {
      for (const f of this.panoSetFiles) {
        const key = f.id || f.full_path
        if (this.panoThumbnails[key]) continue
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 80, height: 54 })
        this.panoThumbnails = { ...this.panoThumbnails, [key]: thumb }
      }
    },
    async pickOutputFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.outputFolder = folder
        await window.api.invoke('store:set', 'panoOutputFolder', folder)
      }
    },
    launch() {
      if (this.launchMode === 'hugin') this.openInHugin()
      else this.runQuickStitchNow()
    },
    async openInHugin() {
      if (!this.tools.hugin || !this.panoSetFiles.length) return
      await window.api.invoke('tools:openHugin', this.tools.hugin, this.panoSetFiles.map(f => f.full_path))
    },
    async runQuickStitchNow() {
      if (!this.canLaunch || this.stitching) return
      this.stitching = true
      this.stitchLog = []
      this.stitchResult = null
      this.stitchStep = 'pto'
      this._stitchCancelled = false

      const outputPath = `${this.outputFolder}/${this.outputFilename}`
      const result = await window.api.invoke('tools:runQuickStitch', {
        nonaPath: this.tools.huginCli.nona,
        enblendPath: this.tools.huginCli.enblend,
        autooptimiserPath: this.tools.huginCli.autooptimiser,
        cpfindPath: this.tools.huginCli.cpfind,
        inputFiles: this.panoSetFiles.map(f => f.full_path),
        outputPath,
        projection: this.projection,
        quality: this.quality,
        outputWidth: this.outputSizeMode === 'custom' ? this.customWidth : null
      })

      this.stitching = false
      this.stitchResult = result

      if (result.success) {
        this.stitchStep = 'done'
        this.stitchThumbnail = await window.api.invoke('img:thumbnail', result.outputPath, { width: 200, height: 150 })
        if (this.selectedPanoSet) {
          await window.api.invoke('pano:updateSet', this.selectedPanoSet.id, { status: 'stitched', output_path: result.outputPath })
        }
      } else if (!this._stitchCancelled) {
        this.toast(`Stitch failed: ${result.error}`, 'error')
      }
    },
    async cancelStitch() {
      this._stitchCancelled = true
      await window.api.invoke('tools:cancelQuickStitch')
    },
    async revealStitchOutput() {
      if (this.stitchResult?.outputPath) await window.api.invoke('tools:revealInFinder', this.stitchResult.outputPath)
    },
    async openStitchInGallery() {
      if (!this.stitchResult?.outputPath) return
      if (!this.session?.id) {
        this.$emit('navigate', 'gallery')
        return
      }
      const meta = await window.api.invoke('img:getMetadata', this.stitchResult.outputPath)
      const groupId = this.panoSetFiles[0]?.group_id || null
      const res = await window.api.invoke('file:upsert', this.session.id, groupId, {
        filename: this.outputFilename,
        full_path: this.stitchResult.outputPath,
        size_bytes: meta?.size || 0,
        exif_ts: Date.now()
      })
      this.$emit('navigate', 'gallery', { type: 'session-all', sessionId: this.session.id, focusFileId: res?.id })
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

/* ── Panorama Stitching ───────────────────────── */
.pano-tool-card {
  margin-bottom: 4px;
}

.brew-note {
  font-size: 11px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.field-input-sm {
  width: 100px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
}

.pano-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
}

.pano-thumb-strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.pano-preview-thumb {
  position: relative;
  width: 80px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 3px;
  overflow: hidden;
  background: var(--surface2);
}

.pano-preview-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pano-preview-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface2);
}

.frame-number {
  position: absolute;
  bottom: 2px;
  right: 3px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
}

.pano-preview-meta {
  font-size: 12px;
  color: var(--text2);
}

.output-filename {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text);
}

.radio-group-vertical {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.radio-option {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}

.radio-option .setting-helper {
  margin-top: 0;
  margin-left: 6px;
}

.launch-mode-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  cursor: pointer;
}

.launch-mode-option.disabled {
  opacity: 0.5;
  cursor: default;
}

.launch-mode-option input[type='radio'] {
  margin-top: 3px;
  flex-shrink: 0;
}

.launch-mode-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.quick-stitch-disabled-reason {
  color: #ef5350;
  opacity: 1;
  font-style: normal;
}

.stitch-progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
}

.stitch-steps {
  display: flex;
  gap: 6px;
}

.stitch-step {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--text2);
  padding: 6px 4px;
  border-radius: 5px;
  background: var(--surface2);
  border: 1px solid var(--border);
}

.stitch-step.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(201, 168, 76, 0.1);
  font-weight: 600;
}

.stitch-step.done {
  color: #66bb6a;
  border-color: rgba(102, 187, 106, 0.4);
}

.stitch-actions {
  display: flex;
  justify-content: flex-end;
}

.stitch-complete {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.stitch-complete-filename {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.stitch-complete-thumb {
  max-width: 240px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.stitch-complete-actions {
  display: flex;
  gap: 10px;
}

.stitch-error {
  font-size: 13px;
  color: #ef5350;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}
</style>
