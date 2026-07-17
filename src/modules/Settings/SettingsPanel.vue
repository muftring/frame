<template>
  <div class="settings-backdrop" @click.self="$emit('close')">
    <transition name="slide-in">
      <div class="settings-panel">
        <div class="panel-header">
          <h3>Settings</h3>
          <button class="btn-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="panel-body">
          <!-- Tool paths -->
          <section class="settings-section">
            <h4>Tool Paths</h4>
            <div class="setting-row">
              <label>Darktable</label>
              <div class="path-input">
                <span class="path-value">{{ settings.darktablePath || 'Auto-detect' }}</span>
                <button class="btn-sm" @click="pickExecutable('darktablePath')">Browse</button>
                <button v-if="settings.darktablePath" class="btn-sm" @click="clearSetting('darktablePath')">Clear</button>
              </div>
            </div>
            <div class="setting-row">
              <label>RawTherapee</label>
              <div class="path-input">
                <span class="path-value">{{ settings.rawtherapeePath || 'Auto-detect' }}</span>
                <button class="btn-sm" @click="pickExecutable('rawtherapeePath')">Browse</button>
                <button v-if="settings.rawtherapeePath" class="btn-sm" @click="clearSetting('rawtherapeePath')">Clear</button>
              </div>
            </div>
            <div class="setting-row">
              <label>PDF Guide</label>
              <div class="path-input">
                <span class="path-value">{{ settings.guidePath || 'Not set' }}</span>
                <button class="btn-sm" @click="pickPdf">Browse</button>
                <button v-if="settings.guidePath" class="btn-sm" @click="clearSetting('guidePath')">Clear</button>
              </div>
            </div>
            <div class="setting-row">
              <label>ffmpeg</label>
              <div class="path-input">
                <span class="path-value">{{ settings.ffmpegPath || 'Auto-detect' }}</span>
                <button class="btn-sm" @click="pickExecutable('ffmpegPath')">Browse</button>
                <button v-if="settings.ffmpegPath" class="btn-sm" @click="clearSetting('ffmpegPath')">Clear</button>
              </div>
              <div class="path-hint">{{ standardPaths.ffmpeg ? 'Auto-detected: ' + standardPaths.ffmpeg : 'Not found in standard locations' }}</div>
            </div>
            <div class="setting-row">
              <label>Hugin</label>
              <div class="path-input">
                <span class="path-value">{{ settings.huginPath || 'Auto-detect' }}</span>
                <button class="btn-sm" @click="pickExecutable('huginPath')">Browse</button>
                <button v-if="settings.huginPath" class="btn-sm" @click="clearSetting('huginPath')">Clear</button>
              </div>
              <div class="path-hint">{{ standardPaths.hugin ? 'Auto-detected: ' + standardPaths.hugin : 'Not found in standard locations' }}</div>
            </div>
          </section>

          <!-- Publish -->
          <section class="settings-section">
            <h4>Publish</h4>
            <div class="setting-row">
              <label>ArchiVault CLI path</label>
              <div class="path-input">
                <span class="path-value">{{ settings.archivaultCliPath || 'archivault (default)' }}</span>
                <button class="btn-sm" @click="pickExecutable('archivaultCliPath')">Browse</button>
                <button v-if="settings.archivaultCliPath" class="btn-sm" @click="clearSetting('archivaultCliPath')">Clear</button>
              </div>
            </div>
            <div class="setting-row">
              <label>Default tag</label>
              <input
                type="text"
                class="text-input"
                :value="settings.archivaultTag || ''"
                @input="settings.archivaultTag = $event.target.value"
                placeholder="e.g. lacrosse-2026"
              />
            </div>
            <div class="setting-row">
              <label>Uploaded by</label>
              <input
                type="text"
                class="text-input"
                :value="settings.archivaultUploadedBy || ''"
                @input="settings.archivaultUploadedBy = $event.target.value"
                placeholder="e.g. michael"
              />
            </div>
          </section>

          <!-- Sequence Detection -->
          <section class="settings-section">
            <h4>Sequence Detection</h4>

            <div class="settings-subheading">Panorama defaults</div>

            <div class="setting-row">
              <label>Max gap between frames <span class="reset-link" @click="resetSeqField('maxGapSeconds')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="5" max="120" step="5" v-model.number="seqOptions.maxGapSeconds" class="slider" />
                <span class="slider-value">{{ seqOptions.maxGapSeconds }}s</span>
              </div>
            </div>

            <div class="setting-row">
              <label>Min gap between pano frames <span class="reset-link" @click="resetSeqField('panoMinGapSeconds')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="0.5" max="5" step="0.5" v-model.number="seqOptions.panoMinGapSeconds" class="slider" />
                <span class="slider-value">{{ seqOptions.panoMinGapSeconds }}s</span>
              </div>
            </div>

            <div class="setting-row">
              <label>Max shutter speed for panorama <span class="reset-link" @click="resetSeqField('panoMaxShutterSpeed')">Reset</span></label>
              <div class="slider-row">
                <select v-model.number="seqOptions.panoMaxShutterSpeed" class="text-input">
                  <option :value="125">1/125</option>
                  <option :value="250">1/250</option>
                  <option :value="500">1/500</option>
                  <option :value="1000">1/1000</option>
                  <option :value="999999">No limit</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <label>Max frames per panorama <span class="reset-link" @click="resetSeqField('panoMaxFrames')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="5" max="30" step="1" v-model.number="seqOptions.panoMaxFrames" class="slider" />
                <span class="slider-value">{{ seqOptions.panoMaxFrames }}</span>
              </div>
            </div>

            <div class="setting-row">
              <label>Min frames per group <span class="reset-link" @click="resetSeqField('minFrames')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="2" max="10" step="1" v-model.number="seqOptions.minFrames" class="slider" />
                <span class="slider-value">{{ seqOptions.minFrames }}</span>
              </div>
            </div>

            <div class="setting-row toggle-row">
              <label>Require consecutive filenames <span class="reset-link" @click="resetSeqField('requireConsecutiveNames')">Reset</span></label>
              <button class="toggle-btn" :class="{ on: seqOptions.requireConsecutiveNames }" @click="seqOptions.requireConsecutiveNames = !seqOptions.requireConsecutiveNames">
                <span class="toggle-knob"></span>
              </button>
            </div>

            <div class="setting-row toggle-row">
              <label>Match focal length <span class="reset-link" @click="resetFocalLength">Reset</span></label>
              <button class="toggle-btn" :class="{ on: matchFocalLength }" @click="matchFocalLength = !matchFocalLength">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="setting-row" v-if="matchFocalLength">
              <label>Focal length tolerance</label>
              <div class="slider-row">
                <input type="range" min="1" max="10" step="1" v-model.number="focalTolerance" class="slider" />
                <span class="slider-value">{{ focalTolerance }}mm</span>
              </div>
            </div>

            <div class="settings-subheading">Burst defaults</div>

            <div class="setting-row">
              <label>Max gap between burst frames <span class="reset-link" @click="resetSeqField('burstMaxGapSeconds')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="0.5" max="5" step="0.5" v-model.number="seqOptions.burstMaxGapSeconds" class="slider" />
                <span class="slider-value">{{ seqOptions.burstMaxGapSeconds }}s</span>
              </div>
            </div>

            <div class="setting-row">
              <label>Min shutter speed for burst <span class="reset-link" @click="resetSeqField('burstMinShutterSpeed')">Reset</span></label>
              <div class="slider-row">
                <select v-model.number="seqOptions.burstMinShutterSpeed" class="text-input">
                  <option :value="125">1/125</option>
                  <option :value="250">1/250</option>
                  <option :value="500">1/500</option>
                  <option :value="0">No minimum</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <label>Max frames per burst <span class="reset-link" @click="resetSeqField('burstMaxFrames')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="10" max="100" step="1" v-model.number="seqOptions.burstMaxFrames" class="slider" />
                <span class="slider-value">{{ seqOptions.burstMaxFrames }}</span>
              </div>
            </div>

            <div class="settings-subheading">Advanced defaults</div>

            <div class="setting-row toggle-row">
              <label>Use histogram comparison <span class="reset-link" @click="resetSeqField('useHistogramComparison')">Reset</span></label>
              <button class="toggle-btn" :class="{ on: seqOptions.useHistogramComparison }" @click="seqOptions.useHistogramComparison = !seqOptions.useHistogramComparison">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="setting-row" v-if="seqOptions.useHistogramComparison">
              <label>Histogram similarity min <span class="reset-link" @click="resetSeqField('histogramSimilarityMin')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="0.5" max="0.95" step="0.05" v-model.number="seqOptions.histogramSimilarityMin" class="slider" />
                <span class="slider-value">{{ seqOptions.histogramSimilarityMin.toFixed(2) }}</span>
              </div>
            </div>

            <div class="settings-subheading">Composite defaults</div>

            <div class="setting-row">
              <label>Default composite mode <span class="reset-link" @click="resetSeqField('defaultCompositeMode')">Reset</span></label>
              <div class="radio-group">
                <button class="btn-sm" :class="{ active: seqOptions.defaultCompositeMode === 'lighten' }" @click="seqOptions.defaultCompositeMode = 'lighten'">Motion trail</button>
                <button class="btn-sm" :class="{ active: seqOptions.defaultCompositeMode === 'stabilized' }" @click="seqOptions.defaultCompositeMode = 'stabilized'">Stabilized</button>
                <button class="btn-sm" :class="{ active: seqOptions.defaultCompositeMode === 'strip' }" @click="seqOptions.defaultCompositeMode = 'strip'">Strip</button>
              </div>
            </div>

            <div class="setting-row">
              <label>Default blend mode <span class="reset-link" @click="resetSeqField('defaultBlendMode')">Reset</span></label>
              <div class="slider-row">
                <select v-model="seqOptions.defaultBlendMode" class="text-input">
                  <option value="lighten">Lighten</option>
                  <option value="screen">Screen</option>
                  <option value="multiply">Multiply</option>
                  <option value="average">Average</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <label>Default JPEG quality <span class="reset-link" @click="resetSeqField('defaultCompositeQuality')">Reset</span></label>
              <div class="slider-row">
                <input type="range" min="70" max="100" step="1" v-model.number="seqOptions.defaultCompositeQuality" class="slider" />
                <span class="slider-value">{{ seqOptions.defaultCompositeQuality }}</span>
              </div>
            </div>

            <button class="btn-sm reset-all-btn" @click="resetAllSeqDefaults">Reset all sequence settings to defaults</button>
          </section>

          <!-- Composite Output -->
          <section class="settings-section">
            <h4>Composite Output</h4>
            <div class="setting-row">
              <label>Default composite output folder</label>
              <div class="path-input">
                <span class="path-value">{{ compositeOutputFolder || 'Source burst folder' }}</span>
                <button class="btn-sm" @click="pickCompositeOutputFolder">Browse</button>
                <button v-if="compositeOutputFolder" class="btn-sm" @click="clearCompositeOutputFolder">Clear</button>
              </div>
              <div class="path-hint">Leave blank to use the source burst folder</div>
            </div>
            <div class="setting-row">
              <label>Default panorama output folder</label>
              <div class="path-input">
                <span class="path-value">{{ panoOutputFolder || 'Source pano folder' }}</span>
                <button class="btn-sm" @click="pickPanoOutputFolder">Browse</button>
                <button v-if="panoOutputFolder" class="btn-sm" @click="clearPanoOutputFolder">Clear</button>
              </div>
            </div>
          </section>

          <!-- Library (Export / Import) -->
          <section class="settings-section">
            <ExportPanel />
            <ImportPanel ref="importPanel" />
          </section>

          <!-- Thumbnail cache -->
          <section class="settings-section">
            <h4>Thumbnail Cache</h4>
            <div class="cache-info" v-if="cacheInfo">
              <span>{{ cacheInfo.count }} files &middot; {{ formatSize(cacheInfo.size) }}</span>
              <button class="btn-sm" @click="clearCache" :disabled="!cacheInfo.count || cacheClearing">
                {{ cacheClearing ? 'Clearing...' : 'Clear Cache' }}
              </button>
            </div>
            <div v-else class="cache-info">
              <span class="muted">Loading...</span>
            </div>
          </section>

          <!-- Appearance -->
          <section class="settings-section">
            <h4>Appearance</h4>
            <div class="setting-row">
              <label>Theme</label>
              <div class="theme-picker">
                <button
                  v-for="t in themeOptions" :key="t.value"
                  class="theme-swatch"
                  :class="{ active: settings.theme === t.value }"
                  :style="{ background: t.swatch }"
                  @click="settings.theme = t.value"
                  :title="t.label"
                >
                  <span class="swatch-label">{{ t.label }}</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Defaults -->
          <section class="settings-section">
            <h4>Defaults</h4>
            <div class="setting-row">
              <label>Gap threshold</label>
              <div class="slider-row">
                <input
                  type="range" min="5" max="240" step="5"
                  :value="settings.defaultGapThreshold"
                  @input="settings.defaultGapThreshold = +$event.target.value"
                  class="slider"
                />
                <span class="slider-value">{{ gapLabel }}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>Thumbnail size</label>
              <div class="radio-group">
                <button
                  v-for="opt in thumbSizeOptions" :key="opt.value"
                  class="btn-sm" :class="{ active: settings.thumbnailSize === opt.value }"
                  @click="settings.thumbnailSize = opt.value"
                >{{ opt.label }}</button>
              </div>
            </div>
          </section>

          <!-- About -->
          <section class="settings-section about">
            <h4>About</h4>
            <div class="about-title">Frame — Photo Workflow Studio</div>
            <div class="about-version">Version {{ appVersion }}</div>
            <div class="about-credits">Created by Michael Uftring</div>
            <div class="about-credits">
              <a @click="openUrl('https://github.com/muftring/frame')">View on GitHub</a>
            </div>
            <div class="about-credits">
              <a @click="openUrl('https://github.com/muftring/frame/blob/master/LICENSE')">MIT License</a>
            </div>
            <div class="about-credits">
              Built with
              <a @click="openUrl('https://www.darktable.org')">Darktable</a>,
              <a @click="openUrl('https://www.rawtherapee.com')">RawTherapee</a>,
              and <a @click="openUrl('https://sharp.pixelplumbing.com')">Sharp</a>
            </div>
          </section>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
// Mirrors SequenceDetectionModal.vue's DEFAULT_OPTIONS (pano/burst/advanced
// fields) plus the three composite defaults this panel additionally owns.
// Both read/write the same 'sequenceDetectionOptions' store key; the modal
// only ever reads it as a starting point for a given run and never writes
// back, so Settings is the single place these defaults are edited.
const SEQ_DEFAULTS = {
  minFrames: 3,
  maxGapSeconds: 45,
  requireConsecutiveNames: true,
  panoMaxShutterSpeed: 500,
  panoMaxFrames: 20,
  panoMinGapSeconds: 1.5,
  panoFocalTolerance: 5,
  burstMaxGapSeconds: 2.0,
  burstMinShutterSpeed: 250,
  burstMaxFrames: 60,
  useHistogramComparison: false,
  histogramSimilarityMin: 0.7,
  defaultCompositeMode: 'lighten',
  defaultBlendMode: 'lighten',
  defaultCompositeQuality: 92
}

// "Match focal length: OFF" is stored as a sentinel tolerance wide enough
// that sequenceDetector.js's focal-length check can never trigger — same
// approach SequenceDetectionModal.vue uses for its own focal-length toggle.
const FOCAL_TOLERANCE_OFF = 99999

import ExportPanel from './ExportPanel.vue'
import ImportPanel from './ImportPanel.vue'

export default {
  name: 'SettingsPanel',
  components: { ExportPanel, ImportPanel },
  props: {
    settings: { type: Object, required: true }
  },
  emits: ['close'],
  data() {
    return {
      cacheInfo: null,
      cacheClearing: false,
      themeOptions: [
        { label: 'Dark', value: 'dark', swatch: '#1a1a1a' },
        { label: 'Gray', value: 'gray', swatch: '#808080' },
        { label: 'Light', value: 'light', swatch: '#f0f0f0' }
      ],
      appVersion: '0.1.0',
      thumbSizeOptions: [
        { label: 'Small (120px)', value: 120 },
        { label: 'Medium (180px)', value: 180 },
        { label: 'Large (240px)', value: 240 }
      ],
      seqOptions: { ...SEQ_DEFAULTS },
      matchFocalLength: true,
      focalTolerance: SEQ_DEFAULTS.panoFocalTolerance,
      seqOptionsReady: false,
      standardPaths: { ffmpeg: null, hugin: null },
      compositeOutputFolder: null,
      panoOutputFolder: null
    }
  },
  computed: {
    gapLabel() {
      const v = this.settings.defaultGapThreshold
      if (v < 60) return v + ' min'
      const hr = Math.floor(v / 60)
      const min = v % 60
      return min > 0 ? hr + 'h ' + min + 'm' : hr + 'h'
    }
  },
  watch: {
    seqOptions: {
      deep: true,
      handler() { if (this.seqOptionsReady) this.saveSeqOptions() }
    },
    matchFocalLength() { if (this.seqOptionsReady) this.saveSeqOptions() },
    focalTolerance() { if (this.seqOptionsReady) this.saveSeqOptions() }
  },
  async mounted() {
    this.loadCacheInfo()
    this.appVersion = await window.api.invoke('app:getVersion')
    this._keyHandler = (e) => { if (e.key === 'Escape') this.$emit('close') }
    window.addEventListener('keydown', this._keyHandler)

    const savedSeq = await window.api.invoke('store:get', 'sequenceDetectionOptions')
    if (savedSeq && typeof savedSeq === 'object') {
      this.seqOptions = { ...SEQ_DEFAULTS, ...savedSeq }
      this.matchFocalLength = this.seqOptions.panoFocalTolerance < FOCAL_TOLERANCE_OFF
      this.focalTolerance = this.matchFocalLength ? this.seqOptions.panoFocalTolerance : SEQ_DEFAULTS.panoFocalTolerance
    }
    this.seqOptionsReady = true

    this.standardPaths = await window.api.invoke('tools:findStandardPaths') || { ffmpeg: null, hugin: null }
    this.compositeOutputFolder = await window.api.invoke('store:get', 'compositeOutputFolder') || null
    this.panoOutputFolder = await window.api.invoke('store:get', 'panoOutputFolder') || null
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
  },
  methods: {
    openImport(filePath) {
      this.$refs.importPanel.openImport(filePath)
    },
    async saveSeqOptions() {
      const effective = {
        ...this.seqOptions,
        panoFocalTolerance: this.matchFocalLength ? this.focalTolerance : FOCAL_TOLERANCE_OFF
      }
      await window.api.invoke('store:set', 'sequenceDetectionOptions', effective)
    },
    resetSeqField(key) {
      this.seqOptions[key] = SEQ_DEFAULTS[key]
    },
    resetFocalLength() {
      this.matchFocalLength = true
      this.focalTolerance = SEQ_DEFAULTS.panoFocalTolerance
    },
    resetAllSeqDefaults() {
      this.seqOptions = { ...SEQ_DEFAULTS }
      this.matchFocalLength = true
      this.focalTolerance = SEQ_DEFAULTS.panoFocalTolerance
    },
    async pickCompositeOutputFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.compositeOutputFolder = folder
        await window.api.invoke('store:set', 'compositeOutputFolder', folder)
      }
    },
    async clearCompositeOutputFolder() {
      this.compositeOutputFolder = null
      await window.api.invoke('store:set', 'compositeOutputFolder', null)
    },
    async pickPanoOutputFolder() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.panoOutputFolder = folder
        await window.api.invoke('store:set', 'panoOutputFolder', folder)
      }
    },
    async clearPanoOutputFolder() {
      this.panoOutputFolder = null
      await window.api.invoke('store:set', 'panoOutputFolder', null)
    },
    async loadCacheInfo() {
      this.cacheInfo = await window.api.invoke('cache:getInfo')
    },
    async clearCache() {
      this.cacheClearing = true
      await window.api.invoke('cache:clear')
      await this.loadCacheInfo()
      this.cacheClearing = false
    },
    async pickExecutable(key) {
      const result = await window.api.invoke('dialog:openExecutable')
      if (result) this.settings[key] = result
    },
    async pickPdf() {
      const result = await window.api.invoke('dialog:openPdf')
      if (result) this.settings.guidePath = result
    },
    clearSetting(key) {
      this.settings[key] = null
    },
    async openUrl(u) {
      await window.api.invoke('shell:openExternal', u)
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
/* TODO Branding-B: migrate to tokens.css variables */
.settings-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}

.settings-panel {
  width: 380px;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.3);
  animation: slide-in 0.2s ease;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.panel-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.btn-close {
  background: none;
  border: none;
  color: var(--text2);
  font-size: 22px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.btn-close:hover { color: var(--text); }

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}

.setting-row {
  margin-bottom: 12px;
}

.setting-row label {
  display: block;
  font-size: 13px;
  color: var(--text);
  margin-bottom: 6px;
}

.theme-picker {
  display: flex;
  gap: 8px;
}

.theme-swatch {
  width: 64px;
  height: 44px;
  border-radius: 6px;
  border: 2px solid var(--border);
  cursor: pointer;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
  transition: border-color 0.15s;
}

.theme-swatch.active {
  border-color: var(--accent);
}

.theme-swatch:hover {
  border-color: var(--accent);
}

.swatch-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: inherit;
  mix-blend-mode: difference;
  opacity: 0.7;
}

.text-input {
  width: 100%;
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
.text-input:focus { border-color: var(--accent); }
.text-input::placeholder { color: var(--text2); opacity: 0.6; }

.path-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.path-value {
  flex: 1;
  font-size: 11px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  background: var(--bg);
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.btn-sm.active { border-color: var(--accent); color: var(--accent); }

.cache-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text);
}

.muted { color: var(--text2); }

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  accent-color: var(--accent);
}

.slider-value {
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
  min-width: 56px;
}

.radio-group {
  display: flex;
  gap: 6px;
}

.about {
  border-top: 1px solid var(--border);
  padding-top: 20px;
}

.about-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
}

.about-version {
  font-size: 12px;
  color: var(--text2);
  margin-bottom: 8px;
}

.about-credits {
  font-size: 12px;
  color: var(--text2);
}

.about-credits a {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}
.about-credits a:hover { text-decoration: underline; }

.settings-subheading {
  font-size: 11px;
  font-weight: 700;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
  margin: 16px 0 8px;
}
.settings-subheading:first-of-type { margin-top: 0; }

.reset-link {
  font-weight: 400;
  font-size: 11px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
  margin-left: 6px;
}
.reset-link:hover { color: #d4b35a; }

.path-hint {
  font-size: 11px;
  color: var(--text2);
  opacity: 0.7;
  margin-top: 4px;
}

.reset-all-btn {
  width: 100%;
  text-align: center;
  margin-top: 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.toggle-row label { margin-bottom: 0; }

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
</style>
