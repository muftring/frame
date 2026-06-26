<template>
  <div class="triage">
    <!-- Step 1: Source Folder -->
    <section class="step">
      <div class="step-header">
        <div class="step-badge" :class="{ done: step1Complete }">{{ step1Complete ? '✓' : '1' }}</div>
        <h3>Source Folder</h3>
      </div>
      <div class="step-body">
        <button class="btn" @click="selectSource">Select Folder</button>
        <span v-if="sourceFolder" class="path">{{ sourceFolder }}</span>
      </div>
    </section>

    <!-- Step 2: Destination Folder -->
    <section class="step" :class="{ locked: !step1Complete }">
      <div class="step-header">
        <div class="step-badge" :class="{ done: step2Complete }">{{ step2Complete ? '✓' : '2' }}</div>
        <h3>Destination Folder</h3>
      </div>
      <div class="step-body" v-if="step1Complete">
        <button class="btn" @click="selectDest">Select Folder</button>
        <span v-if="destFolder" class="path">{{ destFolder }}</span>
      </div>
    </section>

    <!-- Step 3: Scan & Group -->
    <section class="step" :class="{ locked: !step2Complete }">
      <div class="step-header">
        <div class="step-badge" :class="{ done: step3Complete }">{{ step3Complete ? '✓' : '3' }}</div>
        <h3>Scan &amp; Group</h3>
      </div>
      <div class="step-body" v-if="step2Complete">
        <div class="scan-controls">
          <div class="threshold-control">
            <label>Gap threshold: <strong>{{ gapLabel }}</strong></label>
            <input type="range" min="5" max="240" step="5" v-model.number="gapThreshold" class="slider" />
          </div>
          <button class="btn" @click="scan" :disabled="scanning">
            {{ scanning ? 'Scanning...' : 'Scan' }}
          </button>
        </div>

        <div v-if="scanning" class="progress-info">
          Reading EXIF: {{ scanProgress.current }} / {{ scanProgress.total }} files
        </div>

        <div v-if="noFilesFound" class="empty-msg">
          No image files found in this folder.
        </div>

        <div v-if="scannedFiles.length && !scanning" class="scan-summary">
          {{ scannedFiles.length }} images found &middot; {{ groups.length }} groups detected
        </div>

        <div v-if="groups.length && !scanning" class="groups-list">
          <template v-for="(group, i) in groups" :key="group.label">
            <div class="group-card">
              <div class="group-info">
                <span class="group-label">{{ group.label }}</span>
                <span class="group-meta">
                  {{ formatDate(group.startTime) }} &middot;
                  {{ formatTime(group.startTime) }} — {{ formatTime(group.endTime) }} &middot;
                  {{ group.fileCount }} files
                </span>
              </div>
              <div class="thumb-row">
                <img
                  v-for="file in group.files.slice(0, 8)"
                  :key="file.path"
                  :src="thumbnails[file.path]"
                  v-show="thumbnails[file.path]"
                  class="thumb"
                />
              </div>
            </div>
            <div v-if="i < groups.length - 1" class="gap-divider">
              <span class="gap-line"></span>
              <span class="gap-text">{{ formatGap(gapBetween(groups[i], groups[i + 1])) }} gap</span>
              <span class="gap-line"></span>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- Step 4: Copy -->
    <section class="step" :class="{ locked: !step3Complete }">
      <div class="step-header">
        <div class="step-badge" :class="{ done: copyComplete }">{{ copyComplete ? '✓' : '4' }}</div>
        <h3>Copy</h3>
      </div>
      <div class="step-body" v-if="step3Complete">
        <button v-if="!copying && !copyComplete" class="btn btn-accent" @click="startCopy">
          Copy {{ groups.length }} groups to destination
        </button>

        <div v-if="copying" class="copy-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: copyPercent + '%' }"></div>
          </div>
          <div class="progress-info">
            {{ copyProgress.current }} / {{ copyProgress.total }} files &middot;
            <span class="current-file">{{ copyProgress.currentFile }}</span>
          </div>
        </div>

        <div v-if="copyComplete" class="copy-summary">
          <h4>Copy complete</h4>
          <div v-for="result in copyResults" :key="result.folder" class="result-row">
            {{ result.folder }} — {{ result.count }} files
          </div>
          <button class="btn btn-accent" style="margin-top: 16px" @click="$emit('navigate', 'sorter', firstEventPath)">
            Next: open in Sorter
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'TriageModule',
  inject: ['toast', 'appSettings'],
  emits: ['navigate'],
  data() {
    return {
      sourceFolder: null,
      destFolder: null,
      gapThreshold: 45,
      scanning: false,
      scanProgress: { current: 0, total: 0 },
      scannedFiles: [],
      noFilesFound: false,
      thumbnails: {},
      copying: false,
      copyProgress: { current: 0, total: 0, currentFile: '' },
      copyComplete: false,
      copyResults: []
    }
  },
  computed: {
    step1Complete() {
      return !!this.sourceFolder
    },
    step2Complete() {
      return !!this.destFolder
    },
    step3Complete() {
      return this.scannedFiles.length > 0 && !this.scanning
    },
    gapLabel() {
      if (this.gapThreshold < 60) return this.gapThreshold + ' min'
      const hr = Math.floor(this.gapThreshold / 60)
      const min = this.gapThreshold % 60
      return min > 0 ? hr + 'h ' + min + 'm' : hr + 'h'
    },
    groups() {
      if (!this.scannedFiles.length) return []

      const sorted = [...this.scannedFiles].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      )

      const gapMs = this.gapThreshold * 60 * 1000
      const result = []
      let current = [sorted[0]]

      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].timestamp).getTime()
        const curr = new Date(sorted[i].timestamp).getTime()

        if (curr - prev > gapMs) {
          result.push(current)
          current = [sorted[i]]
        } else {
          current.push(sorted[i])
        }
      }
      if (current.length) result.push(current)

      return result.map((files, i) => ({
        label: 'event-' + (i + 1),
        files,
        startTime: files[0].timestamp,
        endTime: files[files.length - 1].timestamp,
        fileCount: files.length
      }))
    },
    copyPercent() {
      if (!this.copyProgress.total) return 0
      return Math.round((this.copyProgress.current / this.copyProgress.total) * 100)
    },
    firstEventPath() {
      if (!this.copyResults.length || !this.destFolder) return ''
      return this.destFolder + '/' + this.copyResults[0].folder
    }
  },
  mounted() {
    if (this.appSettings && this.appSettings.defaultGapThreshold) {
      this.gapThreshold = this.appSettings.defaultGapThreshold
    }
  },
  watch: {
    groups() {
      this.loadThumbnails()
    }
  },
  methods: {
    async selectSource() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.sourceFolder = folder
        this.scannedFiles = []
        this.noFilesFound = false
        this.copyComplete = false
        this.copyResults = []
      }
    },
    async selectDest() {
      const folder = await window.api.invoke('dialog:openFolder')
      if (folder) {
        this.destFolder = folder
        this.copyComplete = false
        this.copyResults = []
      }
    },
    async scan() {
      this.scanning = true
      this.scannedFiles = []
      this.noFilesFound = false
      this.thumbnails = {}

      const files = await window.api.invoke('fs:scanFolder', this.sourceFolder)
      if (files.error) {
        this.scanning = false
        this.toast(files.error, 'error')
        return
      }
      if (!files.length) {
        this.scanning = false
        this.noFilesFound = true
        return
      }

      this.scanProgress = { current: 0, total: files.length }
      const results = []

      for (const file of files) {
        const exif = await window.api.invoke('fs:readExif', file.path)
        results.push({
          name: file.name,
          path: file.path,
          size: file.size,
          modifiedMs: file.modifiedMs,
          timestamp: exif.timestamp
        })
        this.scanProgress.current++
      }

      this.scannedFiles = results
      this.scanning = false
    },
    async loadThumbnails() {
      for (const group of this.groups) {
        for (const file of group.files.slice(0, 8)) {
          if (this.thumbnails[file.path]) continue
          const thumb = await window.api.invoke('img:thumbnail', file.path, { width: 120, height: 90 })
          this.thumbnails[file.path] = thumb
        }
      }
    },
    async startCopy() {
      this.copying = true
      this.copyProgress = { current: 0, total: this.scannedFiles.length, currentFile: '' }
      this.copyResults = []

      for (const group of this.groups) {
        const destDir = this.destFolder + '/' + group.label
        await window.api.invoke('fs:createDirectory', destDir)

        let groupCopied = 0
        for (const file of group.files) {
          this.copyProgress.currentFile = file.name
          const destPath = destDir + '/' + file.name
          await window.api.invoke('fs:copyFile', file.path, destPath)
          groupCopied++
          this.copyProgress.current++
        }

        this.copyResults.push({ folder: group.label, count: groupCopied })
      }

      this.copying = false
      this.copyComplete = true
    },
    formatDate(iso) {
      return new Date(iso).toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      })
    },
    formatTime(iso) {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit'
      })
    },
    formatGap(ms) {
      const min = Math.round(ms / 60000)
      if (min < 60) return min + ' min'
      const hr = Math.floor(min / 60)
      const rem = min % 60
      return rem > 0 ? hr + 'h ' + rem + 'm' : hr + 'h'
    },
    gapBetween(groupA, groupB) {
      return new Date(groupB.startTime) - new Date(groupA.endTime)
    }
  }
}
</script>

<style scoped>
.triage {
  padding: 32px;
  max-width: 900px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100%;
}

.step {
  margin-bottom: 28px;
  transition: opacity 0.2s;
}

.step.locked {
  opacity: 0.35;
  pointer-events: none;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.step-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.step-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface2);
  color: var(--text2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-badge.done {
  background: var(--accent);
  color: var(--bg);
}

.step-body {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn:hover {
  background: var(--surface-hover);
  border-color: rgba(255, 255, 255, 0.15);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-accent {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
  font-weight: 600;
}

.btn-accent:hover {
  background: #d4b35a;
}

.path {
  font-size: 13px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
  background: var(--surface);
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.scan-controls {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  width: 100%;
}

.threshold-control {
  flex: 1;
  max-width: 400px;
}

.threshold-control label {
  display: block;
  font-size: 13px;
  color: var(--text2);
  margin-bottom: 6px;
}

.threshold-control strong {
  color: var(--text);
}

.slider {
  width: 100%;
  accent-color: var(--accent);
  height: 4px;
}

.progress-info {
  width: 100%;
  font-size: 13px;
  color: var(--text2);
  margin-top: 12px;
}

.empty-msg {
  width: 100%;
  font-size: 13px;
  color: var(--text2);
  margin-top: 12px;
  font-style: italic;
}

.scan-summary {
  width: 100%;
  font-size: 13px;
  color: var(--accent);
  font-weight: 500;
  margin-top: 12px;
}

.groups-list {
  width: 100%;
  margin-top: 16px;
}

.group-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

.group-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 10px;
}

.group-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
}

.group-meta {
  font-size: 12px;
  color: var(--text2);
}

.thumb-row {
  display: flex;
  gap: 6px;
  overflow: hidden;
}

.thumb {
  width: 90px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.gap-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.gap-line {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.gap-text {
  font-size: 11px;
  color: var(--text2);
  white-space: nowrap;
}

.copy-progress {
  width: 100%;
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

.current-file {
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text2);
}

.copy-summary {
  width: 100%;
}

.copy-summary h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 10px;
}

.result-row {
  font-size: 13px;
  color: var(--text);
  padding: 4px 0;
}
</style>
