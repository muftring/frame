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
export default {
  name: 'SettingsPanel',
  props: {
    settings: { type: Object, required: true }
  },
  emits: ['close'],
  data() {
    return {
      cacheInfo: null,
      cacheClearing: false,
      appVersion: '0.1.0',
      thumbSizeOptions: [
        { label: 'Small (120px)', value: 120 },
        { label: 'Medium (180px)', value: 180 },
        { label: 'Large (240px)', value: 240 }
      ]
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
  async mounted() {
    this.loadCacheInfo()
    this.appVersion = await window.api.invoke('app:getVersion')
    this._keyHandler = (e) => { if (e.key === 'Escape') this.$emit('close') }
    window.addEventListener('keydown', this._keyHandler)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
  },
  methods: {
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
.btn-sm:hover { background: #383838; }
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
</style>
