<template>
  <transition name="meta-slide">
    <div v-if="visible" class="meta-panel" @click.stop>

      <!-- Close -->
      <button class="panel-close" @click="$emit('close')" title="Close (i)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>

      <!-- Shimmer while loading -->
      <div v-if="loading" class="panel-scroll">
        <div class="section-header">FILE</div>
        <div v-for="n in 5" :key="'fs'+n" class="sk-row">
          <div class="sk-label shimmer"></div>
          <div class="sk-value shimmer"></div>
        </div>
        <div class="section-header" style="margin-top:20px">CAPTURE</div>
        <div v-for="n in 12" :key="'cs'+n" class="sk-row">
          <div class="sk-label shimmer"></div>
          <div class="sk-value shimmer"></div>
        </div>
      </div>

      <!-- Content -->
      <div v-else class="panel-scroll">

        <!-- ── FILE ── -->
        <div class="section-header">FILE</div>

        <div class="meta-row">
          <span class="meta-label">Filename</span>
          <span class="meta-value filename-val" :title="metadata.filename">{{ metadata.filename }}</span>
        </div>
        <div class="meta-row path-row" @click="copyPath" :title="copied ? 'Copied!' : 'Click to copy'">
          <span class="meta-label">Path</span>
          <span class="meta-value path-val">
            <span v-if="copied" class="copy-confirm">✓ Copied</span>
            <span v-else>{{ metadata.fullPath }}</span>
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Size</span>
          <span class="meta-value">{{ fmtSize(metadata.sizeBytes) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Format</span>
          <span class="meta-value">{{ fmtFormat(metadata.format) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Dimensions</span>
          <span class="meta-value">{{ fmtDims(metadata.dimensions) }}</span>
        </div>

        <!-- ── CAPTURE ── -->
        <div class="section-header">CAPTURE</div>

        <div class="meta-row">
          <span class="meta-label">Date &amp; time</span>
          <span class="meta-value">{{ exif.dateTimeOriginal || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Camera</span>
          <span class="meta-value">{{ exif.cameraModel || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Lens</span>
          <span class="meta-value">{{ exif.lens || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Focal length</span>
          <span class="meta-value">{{ fmtFocal(exif) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Aperture</span>
          <span class="meta-value">{{ exif.aperture || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Shutter speed</span>
          <span class="meta-value">{{ exif.shutterSpeed ? exif.shutterSpeed + ' s' : '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ISO</span>
          <span class="meta-value">{{ exif.iso || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Exp. mode</span>
          <span class="meta-value">{{ exif.exposureMode || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Metering</span>
          <span class="meta-value">{{ exif.meteringMode || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">White balance</span>
          <span class="meta-value">{{ exif.whiteBalance || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Flash</span>
          <span class="meta-value">{{ exif.flash || '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Exp. comp.</span>
          <span class="meta-value">{{ exif.exposureComp || '—' }}</span>
        </div>

        <!-- ── FRAME STATUS ── -->
        <div class="section-header">FRAME STATUS</div>

        <div class="meta-row">
          <span class="meta-label">Session</span>
          <span class="meta-value">{{ fileRecord ? fileRecord.sessionName || '—' : '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Status</span>
          <span class="meta-value status-val" :class="statusClass">{{ statusLabel }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Published to</span>
          <span class="meta-value">{{ publishedTo }}</span>
        </div>
        <div class="meta-row rating-row">
          <span class="meta-label">Rating</span>
          <span class="rating-stars">
            <button
              v-for="n in 5"
              :key="n"
              class="star-btn"
              :class="{ filled: n <= currentRating }"
              @click="setRating(n)"
              :title="n + ' star' + (n > 1 ? 's' : '')"
            >★</button>
          </span>
        </div>

        <!-- ── HISTOGRAM ── -->
        <!-- TODO: add RGB histogram rendered on <canvas> by sampling
             full-res pixel data via an offscreen canvas drawImage pass -->

      </div>
    </div>
  </transition>
</template>

<script>
const FORMAT_LABELS = {
  nef:  'NEF — Nikon RAW',
  cr2:  'CR2 — Canon RAW',
  arw:  'ARW — Sony RAW',
  dng:  'DNG — Adobe RAW',
  orf:  'ORF — Olympus RAW',
  rw2:  'RW2 — Panasonic RAW',
  tiff: 'TIFF',
  tif:  'TIFF',
  jpeg: 'JPEG',
  jpg:  'JPEG',
  png:  'PNG',
  heic: 'HEIC',
  heif: 'HEIF',
}

const STATUS_LABEL = {
  unreviewed: 'Unreviewed',
  kept:       'Kept',
  deleted:    'Deleted',
  published:  'Published',
}

export default {
  name: 'MetadataPanel',
  props: {
    visible: { type: Boolean, default: false },
    image:   { type: Object, default: () => ({}) }
  },
  emits: ['close'],
  data() {
    return {
      loading: false,
      metadata: null,
      fileRecord: null,
      copied: false,
      _copyTimer: null
    }
  },
  computed: {
    exif() {
      return this.metadata?.exif || {}
    },
    statusClass() {
      const s = this.fileRecord?.status || 'unreviewed'
      return `status-${s}`
    },
    statusLabel() {
      const s = this.fileRecord?.status || 'unreviewed'
      return STATUS_LABEL[s] || s
    },
    publishedTo() {
      if (!this.fileRecord) return '—'
      try {
        const list = JSON.parse(this.fileRecord.published_to || '[]')
        return list.length ? list.join(', ') : '—'
      } catch {
        return '—'
      }
    },
    currentRating() {
      return this.fileRecord?.rating || 0
    }
  },
  watch: {
    image: {
      immediate: true,
      handler() { this.loadData() }
    },
    visible(v) {
      if (v && !this.metadata) this.loadData()
    }
  },
  beforeUnmount() {
    clearTimeout(this._copyTimer)
  },
  methods: {
    async loadData() {
      if (!this.image?.path) return
      this.loading = true
      this.metadata = null
      this.fileRecord = null

      const [meta, rec] = await Promise.all([
        window.api.invoke('img:getFullMetadata', this.image.path),
        window.api.invoke('file:getByPath', this.image.path)
      ])

      this.metadata = meta?.error ? this.fallbackMeta() : meta
      this.fileRecord = rec?.error ? null : rec
      this.loading = false
    },
    fallbackMeta() {
      return {
        filename: this.image.name || '',
        fullPath: this.image.path || '',
        sizeBytes: this.image.size || null,
        format: null,
        dimensions: { width: null, height: null, megapixels: null },
        exif: {}
      }
    },
    fmtSize(bytes) {
      if (!bytes) return '—'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / 1048576).toFixed(1) + ' MB'
    },
    fmtFormat(fmt) {
      if (!fmt) return '—'
      return FORMAT_LABELS[fmt.toLowerCase()] || fmt.toUpperCase()
    },
    fmtDims(dims) {
      if (!dims || !dims.width) return '—'
      const px = `${dims.width} × ${dims.height}`
      return dims.megapixels ? `${px}  ·  ${dims.megapixels} MP` : px
    },
    fmtFocal(exif) {
      if (!exif.focalLength) return '—'
      if (exif.focalLength35mm && exif.focalLength35mm !== exif.focalLength) {
        return `${exif.focalLength}  (${exif.focalLength35mm} equiv.)`
      }
      return exif.focalLength
    },
    async copyPath() {
      if (!this.metadata?.fullPath) return
      try {
        await navigator.clipboard.writeText(this.metadata.fullPath)
        this.copied = true
        clearTimeout(this._copyTimer)
        this._copyTimer = setTimeout(() => { this.copied = false }, 1500)
      } catch {
        // clipboard may be blocked in some contexts
      }
    },
    async setRating(n) {
      if (!this.fileRecord) return
      // clicking the current rating again clears it
      const newRating = this.fileRecord.rating === n ? 0 : n
      await window.api.invoke('file:setRating', this.fileRecord.id, newRating)
      this.fileRecord = { ...this.fileRecord, rating: newRating }
    }
  }
}
</script>

<style scoped>
/* ── Panel shell ──────────────────────────────── */
.meta-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 44px; /* leave the viewer bar visible */
  width: 280px;
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 26px;
  height: 26px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 0;
  transition: background 0.15s, color 0.15s;
  z-index: 1;
}
.panel-close:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
.panel-close svg {
  width: 10px;
  height: 10px;
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 0 24px;
}

/* ── Section headers ──────────────────────────── */
.section-header {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.3);
  padding: 14px 16px 6px;
  text-transform: uppercase;
}
.section-header:first-child {
  padding-top: 6px;
}

/* ── Meta rows ────────────────────────────────── */
.meta-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 16px;
  min-height: 22px;
}

.meta-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  width: 84px;
  flex-shrink: 0;
}

.meta-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
  line-height: 1.4;
}

.filename-val {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
}

/* ── Path row ─────────────────────────────────── */
.path-row {
  cursor: pointer;
}
.path-row:hover .path-val {
  color: #fff;
}
.path-val {
  word-break: break-all;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.15s;
}
.copy-confirm {
  color: #66bb6a;
  font-size: 11px;
}

/* ── Status colors ────────────────────────────── */
.status-val { font-weight: 600; }
.status-kept       { color: #66bb6a; }
.status-deleted    { color: #ef5350; }
.status-unreviewed { color: rgba(255, 255, 255, 0.4); }
.status-published  { color: #c9a84c; }

/* ── Rating stars ─────────────────────────────── */
.rating-row {
  align-items: center;
}

.rating-stars {
  display: flex;
  gap: 2px;
}

.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.2);
  padding: 0 1px;
  line-height: 1;
  transition: color 0.1s, transform 0.1s;
}
.star-btn.filled {
  color: #c9a84c;
}
.star-btn:hover {
  color: #c9a84c;
  transform: scale(1.15);
}

/* ── Shimmer skeletons ────────────────────────── */
.sk-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px;
}
.sk-label {
  width: 72px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.sk-value {
  flex: 1;
  height: 10px;
  border-radius: 3px;
  max-width: 140px;
}
.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(255, 255, 255, 0.1)  50%,
    rgba(255, 255, 255, 0.05) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}

/* ── Slide transition ─────────────────────────── */
.meta-slide-enter-active,
.meta-slide-leave-active {
  transition: transform 0.22s ease;
}
.meta-slide-enter-from,
.meta-slide-leave-to {
  transform: translateX(100%);
}
</style>
