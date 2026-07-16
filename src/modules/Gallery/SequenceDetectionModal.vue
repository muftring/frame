<template>
  <div class="editor-backdrop" @click.self="handleBackdropClick">
    <div class="editor-modal" @click.stop>

      <!-- ── OPTIONS STEP ── -->
      <template v-if="step === 'options'">
        <div class="editor-header">
          <div>
            <h2 class="editor-title">Detect panorama and burst sequences</h2>
            <div class="editor-subtitle">Scans your session photos for sequences that may be panoramas or action bursts</div>
          </div>
          <button class="editor-close" @click="$emit('close')">✕</button>
        </div>

        <div class="editor-body">

          <div class="settings-section">
            <h4 class="settings-heading">Time &amp; sequence</h4>

            <div class="setting-row">
              <label class="setting-label">Max gap between frames</label>
              <input type="range" min="5" max="120" step="5" v-model.number="options.maxGapSeconds" class="slider" />
              <span class="setting-value">{{ options.maxGapSeconds }} seconds</span>
            </div>

            <div class="setting-row">
              <label class="setting-label">Min frames per group</label>
              <input type="range" min="2" max="10" step="1" v-model.number="options.minFrames" class="slider" />
              <span class="setting-value">{{ options.minFrames }} frames</span>
            </div>

            <div class="setting-row toggle-row">
              <label class="setting-label">Require consecutive filenames</label>
              <button class="toggle-btn" :class="{ on: options.requireConsecutiveNames }" @click="options.requireConsecutiveNames = !options.requireConsecutiveNames">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="setting-helper">DSC_0042 → DSC_0043 → DSC_0044</div>
          </div>

          <div class="settings-section">
            <h4 class="settings-heading">Panorama signals</h4>

            <div class="setting-row">
              <label class="setting-label">Min gap between pano frames</label>
              <input type="range" min="0.5" max="5" step="0.5" v-model.number="options.panoMinGapSeconds" class="slider" />
              <span class="setting-value">{{ options.panoMinGapSeconds }}s</span>
            </div>
            <div class="setting-helper">Panoramas usually have &gt; 1.5s between shots</div>

            <div class="setting-row">
              <label class="setting-label">Max shutter speed for panorama</label>
              <select v-model.number="options.panoMaxShutterSpeed" class="setting-select">
                <option v-for="o in PANO_SHUTTER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div class="setting-helper">Faster shutter suggests action, not landscape</div>

            <div class="setting-row">
              <label class="setting-label">Max frames per panorama</label>
              <input type="range" min="5" max="30" step="1" v-model.number="options.panoMaxFrames" class="slider" />
              <span class="setting-value">{{ options.panoMaxFrames }} frames</span>
            </div>

            <div class="setting-row toggle-row">
              <label class="setting-label">Match focal length</label>
              <button class="toggle-btn" :class="{ on: matchFocalLength }" @click="matchFocalLength = !matchFocalLength">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="setting-helper">Only group frames at same zoom level</div>
            <div class="setting-row" v-if="matchFocalLength">
              <label class="setting-label">Tolerance</label>
              <input type="range" min="1" max="10" step="1" v-model.number="focalTolerance" class="slider" />
              <span class="setting-value">{{ focalTolerance }}mm</span>
            </div>
          </div>

          <div class="settings-section">
            <h4 class="settings-heading">Burst signals</h4>

            <div class="setting-row">
              <label class="setting-label">Max gap between burst frames</label>
              <input type="range" min="0.5" max="5" step="0.5" v-model.number="options.burstMaxGapSeconds" class="slider" />
              <span class="setting-value">{{ options.burstMaxGapSeconds }}s</span>
            </div>

            <div class="setting-row">
              <label class="setting-label">Min shutter speed for burst</label>
              <select v-model.number="options.burstMinShutterSpeed" class="setting-select">
                <option v-for="o in BURST_SHUTTER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div class="setting-helper">Fast shutter suggests sports action</div>

            <div class="setting-row">
              <label class="setting-label">Max frames per burst</label>
              <input type="range" min="10" max="100" step="1" v-model.number="options.burstMaxFrames" class="slider" />
              <span class="setting-value">{{ options.burstMaxFrames }} frames</span>
            </div>
          </div>

          <div class="settings-section">
            <h4 class="settings-heading collapsible" @click="advancedOpen = !advancedOpen">
              Advanced
              <span class="collapse-icon">{{ advancedOpen ? '▾' : '▸' }}</span>
            </h4>
            <template v-if="advancedOpen">
              <div class="setting-row toggle-row">
                <label class="setting-label">Use histogram comparison</label>
                <button class="toggle-btn" :class="{ on: options.useHistogramComparison }" @click="options.useHistogramComparison = !options.useHistogramComparison">
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="setting-helper">Compares scene content between frames. Slower but more accurate. Useful for mixed shooting sessions.</div>

              <div class="setting-row" v-if="options.useHistogramComparison">
                <label class="setting-label">Histogram similarity threshold</label>
                <input type="range" min="0.5" max="0.95" step="0.05" v-model.number="options.histogramSimilarityMin" class="slider" />
                <span class="setting-value">{{ options.histogramSimilarityMin.toFixed(2) }}</span>
              </div>
              <div class="setting-helper" v-if="options.useHistogramComparison">Higher = frames must look more similar</div>
            </template>
          </div>

          <a class="reset-link" @click="resetToDefaults">Reset to defaults</a>

        </div>

        <div class="editor-footer">
          <button class="btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn-primary" @click="runDetection">Detect sequences</button>
        </div>
      </template>

      <!-- ── DETECTING STEP ── -->
      <template v-else-if="step === 'detecting'">
        <div class="detecting-body">
          <div class="spinner"></div>
          <div class="detecting-text">Scanning session photos…</div>
        </div>
      </template>

      <!-- ── RESULTS STEP ── -->
      <template v-else-if="step === 'results'">
        <div class="editor-header">
          <div>
            <h2 class="editor-title">Detection complete</h2>
            <div class="editor-subtitle">
              {{ result.summary.panoramasFound }} panoramas · {{ result.summary.burstsFound }} bursts · {{ result.summary.ambiguousFound }} ambiguous
            </div>
          </div>
          <button class="editor-close" @click="$emit('close')">✕</button>
        </div>

        <div class="results-tabs">
          <button class="results-tab" :class="{ active: activeTab === 'panoramas' }" @click="activeTab = 'panoramas'">
            PANORAMAS ({{ result.panoramas.length }})
          </button>
          <button class="results-tab" :class="{ active: activeTab === 'bursts' }" @click="activeTab = 'bursts'">
            BURSTS ({{ result.bursts.length }})
          </button>
          <button class="results-tab" :class="{ active: activeTab === 'ambiguous' }" @click="activeTab = 'ambiguous'">
            AMBIGUOUS ({{ result.ambiguous.length }})
          </button>
        </div>

        <div class="editor-body results-body">

          <!-- Panoramas tab -->
          <template v-if="activeTab === 'panoramas'">
            <div v-if="!panoCards.length" class="results-empty">No new panorama sequences detected.</div>
            <div v-for="(p, i) in panoCards" :key="'pano' + i" class="result-card">
              <div class="result-card-top">
                <input type="checkbox" v-model="panoSelections[i].checked" />
                <input type="text" class="result-name-input" v-model="panoSelections[i].name" />
                <span class="confidence-badge" :class="'conf-' + p.confidence.level">{{ confidenceLabel(p.confidence.level) }}</span>
              </div>
              <div class="result-thumb-strip">
                <template v-for="f in p.files" :key="f.id">
                  <img v-if="panoThumbs[f.id]" :src="panoThumbs[f.id]" class="result-thumb" />
                </template>
              </div>
              <div class="result-metrics">
                {{ p.metrics.frameCount }} frames  ·  {{ p.metrics.timeSpanSeconds.toFixed(0) }} seconds span  ·  {{ p.files[0].filename }} → {{ p.files[p.files.length - 1].filename }}
              </div>
              <div class="result-flags" v-if="p.confidence.flags.length">
                <span v-for="(flag, fi) in p.confidence.flags" :key="fi" class="flag-pill" :class="'flag-' + flag.level">{{ flag.msg }}</span>
              </div>
            </div>

            <div v-if="result.summary.skippedExisting > 0" class="skipped-note">
              {{ result.summary.skippedExisting }} existing sets were skipped
            </div>
          </template>

          <!-- Bursts tab -->
          <template v-if="activeTab === 'bursts'">
            <div v-if="!burstCards.length" class="results-empty">No new burst sequences detected.</div>
            <div v-for="(b, i) in burstCards" :key="'burst' + i" class="result-card">
              <div class="result-card-top">
                <input type="checkbox" v-model="burstSelections[i].checked" />
                <input type="text" class="result-name-input" v-model="burstSelections[i].name" />
                <span class="confidence-badge" :class="'bconf-' + b.confidence.level">{{ burstConfidenceLabel(b.confidence.level) }}</span>
              </div>
              <div class="result-thumb-strip">
                <template v-for="f in b.files" :key="f.id">
                  <img v-if="burstThumbs[f.id]" :src="burstThumbs[f.id]" class="result-thumb" />
                </template>
              </div>
              <div class="result-metrics">
                {{ b.metrics.frameCount }} frames  ·  median {{ b.metrics.medianGapSeconds.toFixed(1) }}s between frames{{ b.metrics.medianShutter != null ? '  ·  1/' + b.metrics.medianShutter + 's typical' : '' }}
              </div>
              <div class="result-flags" v-if="b.confidence.flags.length">
                <span v-for="(flag, fi) in b.confidence.flags" :key="fi" class="flag-pill" :class="'flag-' + flag.level">{{ flag.msg }}</span>
              </div>
            </div>

            <div v-if="result.summary.skippedExisting > 0" class="skipped-note">
              {{ result.summary.skippedExisting }} existing sets were skipped
            </div>
          </template>

          <!-- Ambiguous tab -->
          <template v-if="activeTab === 'ambiguous'">
            <div v-if="!ambiguousCards.length" class="results-empty">No ambiguous sequences detected.</div>
            <div v-for="(a, i) in ambiguousCards" :key="'ambig' + i" class="result-card">
              <div class="result-card-top">
                <input type="checkbox" v-model="ambiguousSelections[i].checked" />
                <input type="text" class="result-name-input" v-model="ambiguousSelections[i].name" />
                <span class="confidence-badge conf-pano-score">Pano: {{ a.panoConfidence.score }}</span>
                <span class="confidence-badge conf-burst-score">Burst: {{ a.burstConfidence.score }}</span>
              </div>
              <div class="classify-toggle">
                <button class="classify-btn" :class="{ active: ambiguousSelections[i].classifyAs === 'pano' }" @click="ambiguousSelections[i].classifyAs = 'pano'">Treat as Panorama</button>
                <button class="classify-btn" :class="{ active: ambiguousSelections[i].classifyAs === 'burst' }" @click="ambiguousSelections[i].classifyAs = 'burst'">Treat as Burst</button>
              </div>
              <div class="result-thumb-strip">
                <template v-for="f in a.files" :key="f.id">
                  <img v-if="ambiguousThumbs[f.id]" :src="ambiguousThumbs[f.id]" class="result-thumb" />
                </template>
              </div>
              <div class="result-metrics">
                {{ a.metrics.frameCount }} frames  ·  {{ a.metrics.timeSpanSeconds.toFixed(0) }} seconds span  ·  {{ a.files[0].filename }} → {{ a.files[a.files.length - 1].filename }}
              </div>
              <div class="ambiguous-note">
                This sequence has characteristics of both panorama and burst. Review the thumbnails and choose how to classify it.
              </div>
            </div>
          </template>

        </div>

        <div class="editor-footer">
          <button class="btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn-secondary" @click="step = 'options'">Back to options</button>
          <button class="btn-primary" @click="confirmSelected" :disabled="confirming">
            {{ confirming ? 'Creating…' : 'Confirm selected' }}
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<script>
// Mirrors electron/services/sequenceDetector.js's DEFAULT_OPTIONS. The
// renderer can't require() that module directly (contextIsolation +
// nodeIntegration:false), so keep these two in sync by hand.
const DEFAULT_OPTIONS = {
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
  burstMinFrames: 3,
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,
  useHistogramComparison: false,
  histogramSimilarityMin: 0.7
}

// "Match focal length: OFF" and "No limit"/"No minimum" shutter dropdown
// choices don't exist as distinct backend flags — they're implemented as
// sentinel values wide enough that the corresponding sequenceDetector.js
// check can never trigger.
const FOCAL_TOLERANCE_OFF = 99999
const PANO_SHUTTER_NO_LIMIT = 999999
const BURST_SHUTTER_NO_MINIMUM = 0

const PANO_SHUTTER_OPTIONS = [
  { value: 125, label: '1/125' },
  { value: 250, label: '1/250' },
  { value: 500, label: '1/500' },
  { value: 1000, label: '1/1000' },
  { value: PANO_SHUTTER_NO_LIMIT, label: 'No limit' }
]

const BURST_SHUTTER_OPTIONS = [
  { value: 125, label: '1/125' },
  { value: 250, label: '1/250' },
  { value: 500, label: '1/500' },
  { value: BURST_SHUTTER_NO_MINIMUM, label: 'No minimum' }
]

export default {
  name: 'SequenceDetectionModal',
  props: {
    activeSession: { type: Object, default: null }
  },
  emits: ['close', 'confirmed'],
  data() {
    return {
      PANO_SHUTTER_OPTIONS,
      BURST_SHUTTER_OPTIONS,
      step: 'options',
      options: { ...DEFAULT_OPTIONS },
      matchFocalLength: true,
      focalTolerance: DEFAULT_OPTIONS.panoFocalTolerance,
      advancedOpen: false,
      result: null,
      activeTab: 'panoramas',
      panoSelections: [],
      burstSelections: [],
      ambiguousSelections: [],
      panoThumbs: {},
      burstThumbs: {},
      ambiguousThumbs: {},
      confirming: false
    }
  },
  computed: {
    panoCards() {
      if (!this.result) return []
      return this.result.panoramas.filter(p => !p.alreadyExists)
    },
    burstCards() {
      if (!this.result) return []
      return this.result.bursts.filter(b => !b.alreadyExists)
    },
    ambiguousCards() {
      if (!this.result) return []
      return this.result.ambiguous.filter(a => !a.alreadyExists)
    }
  },
  watch: {
    activeTab(tab) {
      if (tab === 'panoramas') this.loadPanoThumbs()
      if (tab === 'bursts') this.loadBurstThumbs()
      if (tab === 'ambiguous') this.loadAmbiguousThumbs()
    }
  },
  async mounted() {
    const saved = await window.api.invoke('store:get', 'sequenceDetectionOptions')
    if (saved && typeof saved === 'object') {
      this.options = { ...DEFAULT_OPTIONS, ...saved }
      this.matchFocalLength = this.options.panoFocalTolerance < FOCAL_TOLERANCE_OFF
      this.focalTolerance = this.matchFocalLength ? this.options.panoFocalTolerance : DEFAULT_OPTIONS.panoFocalTolerance
    }
  },
  methods: {
    resetToDefaults() {
      this.options = { ...DEFAULT_OPTIONS }
      this.matchFocalLength = true
      this.focalTolerance = DEFAULT_OPTIONS.panoFocalTolerance
    },
    handleBackdropClick() {
      if (this.step === 'options') this.$emit('close')
    },
    confidenceLabel(level) {
      return { high: 'High confidence', medium: 'Review recommended', low: 'Likely not panorama' }[level] || level
    },
    burstConfidenceLabel(level) {
      return { high: 'High confidence burst', medium: 'Possible burst', low: 'Low confidence' }[level] || level
    },
    async runDetection() {
      if (!this.activeSession) return
      const effectiveOptions = {
        ...this.options,
        panoFocalTolerance: this.matchFocalLength ? this.focalTolerance : FOCAL_TOLERANCE_OFF
      }
      await window.api.invoke('store:set', 'sequenceDetectionOptions', effectiveOptions)

      this.step = 'detecting'
      const result = await window.api.invoke('sequence:detectGroups', this.activeSession.id, effectiveOptions)
      this.result = result

      this.panoSelections = (result.panoramas || [])
        .filter(p => !p.alreadyExists)
        .map(p => ({ checked: p.defaultChecked, name: p.suggestedName }))

      this.burstSelections = (result.bursts || [])
        .filter(b => !b.alreadyExists)
        .map(b => ({ checked: b.defaultChecked, name: b.suggestedName }))

      this.ambiguousSelections = (result.ambiguous || [])
        .filter(a => !a.alreadyExists)
        .map(a => ({
          checked: false,
          name: a.suggestedName,
          classifyAs: a.panoConfidence.score >= a.burstConfidence.score ? 'pano' : 'burst'
        }))

      this.activeTab = 'panoramas'
      this.step = 'results'
      await this.loadPanoThumbs()
    },
    async loadPanoThumbs() {
      for (const p of this.panoCards) {
        for (const f of p.files) {
          if (this.panoThumbs[f.id]) continue
          const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 80, height: 54 })
          this.panoThumbs = { ...this.panoThumbs, [f.id]: thumb }
        }
      }
    },
    async loadBurstThumbs() {
      for (const b of this.burstCards) {
        for (const f of b.files) {
          if (this.burstThumbs[f.id]) continue
          const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 80, height: 54 })
          this.burstThumbs = { ...this.burstThumbs, [f.id]: thumb }
        }
      }
    },
    async loadAmbiguousThumbs() {
      for (const a of this.ambiguousCards) {
        for (const f of a.files) {
          if (this.ambiguousThumbs[f.id]) continue
          const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 80, height: 54 })
          this.ambiguousThumbs = { ...this.ambiguousThumbs, [f.id]: thumb }
        }
      }
    },
    async confirmSelected() {
      if (this.confirming) return
      this.confirming = true
      let panoCount = 0
      let burstCount = 0
      try {
        for (let i = 0; i < this.panoCards.length; i++) {
          const sel = this.panoSelections[i]
          if (!sel.checked) continue
          const fileIds = this.panoCards[i].files.map(f => f.id)
          await window.api.invoke('pano:confirmSet', this.activeSession.id, fileIds, sel.name.trim() || this.panoCards[i].suggestedName)
          panoCount++
        }

        for (let i = 0; i < this.burstCards.length; i++) {
          const sel = this.burstSelections[i]
          if (!sel.checked) continue
          const fileIds = this.burstCards[i].files.map(f => f.id)
          await window.api.invoke('burst:confirmSet', this.activeSession.id, fileIds, sel.name.trim() || this.burstCards[i].suggestedName)
          burstCount++
        }

        for (let i = 0; i < this.ambiguousCards.length; i++) {
          const sel = this.ambiguousSelections[i]
          if (!sel.checked) continue
          const fileIds = this.ambiguousCards[i].files.map(f => f.id)
          const name = sel.name.trim() || this.ambiguousCards[i].suggestedName
          if (sel.classifyAs === 'burst') {
            await window.api.invoke('burst:confirmSet', this.activeSession.id, fileIds, name)
            burstCount++
          } else {
            await window.api.invoke('pano:confirmSet', this.activeSession.id, fileIds, name)
            panoCount++
          }
        }

        this.$emit('confirmed', { panoCount, burstCount })
      } finally {
        this.confirming = false
      }
    }
  }
}
</script>

<style scoped>
/* TODO Branding-B: migrate to tokens.css variables */
.editor-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 640px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 12px;
}

.editor-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.editor-subtitle {
  font-size: 12px;
  color: var(--text2);
  margin-top: 4px;
}

.editor-close {
  background: none;
  border: none;
  color: var(--text2);
  font-size: 14px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
  flex-shrink: 0;
}
.editor-close:hover { opacity: 1; background: var(--surface2); }

.editor-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-heading {
  font-size: 11px;
  font-weight: 700;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.settings-heading.collapsible {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.collapse-icon {
  font-size: 10px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-label {
  font-size: 12px;
  color: var(--text);
  flex: 1;
  min-width: 0;
}

.setting-value {
  font-size: 12px;
  color: var(--text2);
  flex-shrink: 0;
  width: 90px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.setting-helper {
  font-size: 11px;
  color: var(--text2);
  opacity: 0.6;
  font-style: italic;
  margin-top: -4px;
}

.setting-select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  flex-shrink: 0;
}

.slider {
  flex: 1;
  accent-color: var(--accent);
}

.toggle-row {
  justify-content: space-between;
}

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

.reset-link {
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
  align-self: flex-start;
}
.reset-link:hover { color: #d4b35a; }

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.btn-secondary {
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text2);
  font-size: 13px;
  padding: 7px 18px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-secondary:hover { background: var(--surface2); color: var(--text); }

.btn-primary {
  background: var(--accent);
  border: none;
  border-radius: 5px;
  color: #1a1a1a;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 22px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: default; }

/* ── Detecting step ───────────────────────────── */
.detecting-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.detecting-text {
  font-size: 13px;
  color: var(--text2);
}

/* ── Results step ─────────────────────────────── */
.results-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  padding: 0 20px;
}

.results-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 10px 14px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.results-tab:hover { color: var(--text); }
.results-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.results-body {
  gap: 14px;
}

.results-empty {
  font-size: 13px;
  color: var(--text2);
  text-align: center;
  padding: 30px 10px;
}

.result-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-name-input {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  min-width: 0;
}
.result-name-input:focus { border-color: var(--accent); }

.confidence-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}
.conf-high   { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
.conf-medium { background: rgba(230, 168, 63, 0.15); color: #e6a83f; }
.conf-low    { background: rgba(239, 83, 80, 0.15); color: #ef5350; }
.bconf-high   { background: rgba(232, 148, 58, 0.15); color: #e8943a; }
.bconf-medium { background: rgba(230, 168, 63, 0.15); color: #e6a83f; }
.bconf-low    { background: var(--surface); color: var(--text2); }
.conf-pano-score  { background: rgba(74, 144, 217, 0.15); color: #4a90d9; }
.conf-burst-score { background: rgba(232, 148, 58, 0.15); color: #e8943a; }

.classify-toggle {
  display: flex;
  gap: 6px;
}

.classify-btn {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text2);
  font-size: 11px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.classify-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(201, 168, 76, 0.1);
}

.result-thumb-strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.result-thumb {
  width: 80px;
  height: 54px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.result-metrics {
  font-size: 11px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.result-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.flag-pill {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 8px;
}
.flag-warn { background: rgba(230, 168, 63, 0.15); color: #e6a83f; }
.flag-info { background: rgba(74, 144, 217, 0.15); color: #4a90d9; }

.ambiguous-note {
  font-size: 11px;
  color: var(--text2);
  font-style: italic;
  line-height: 1.5;
}

.skipped-note {
  font-size: 11px;
  color: var(--text2);
  opacity: 0.6;
  text-align: center;
  padding: 8px;
}
</style>
