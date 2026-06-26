<template>
  <transition name="viewer-fade">
    <div v-if="visible" class="viewer-overlay" @click.self="$emit('close')">
      <div class="viewer-body">
        <button class="nav-arrow nav-left" @click.stop="$emit('prev')" :disabled="!hasPrev">&lsaquo;</button>
        <div class="viewer-image-area">
          <transition name="img-fade" mode="out-in">
            <img :key="image.path" :src="imageUrl" class="viewer-img" @error="handleError" />
          </transition>
        </div>
        <button class="nav-arrow nav-right" @click.stop="$emit('next')" :disabled="!hasNext">&rsaquo;</button>
      </div>

      <div class="viewer-bar">
        <span class="bar-filename">{{ image.name }}</span>
        <span class="bar-meta">{{ formatSize(image.size) }}</span>
        <button
          class="bar-info-btn"
          :class="{ active: showMeta }"
          @click.stop="showMeta = !showMeta"
          title="Image info (i)"
        >ⓘ</button>
      </div>

      <!-- Metadata panel — slides in from right -->
      <MetadataPanel
        :visible="showMeta"
        :image="image"
        @close="showMeta = false"
      />
    </div>
  </transition>
</template>

<script>
import MetadataPanel from './MetadataPanel.vue'

export default {
  name: 'ImageViewer',
  components: { MetadataPanel },
  props: {
    visible: { type: Boolean, default: false },
    image:   { type: Object, default: () => ({}) },
    hasPrev: { type: Boolean, default: false },
    hasNext: { type: Boolean, default: false }
  },
  emits: ['close', 'prev', 'next'],
  data() {
    return { showMeta: false }
  },
  computed: {
    imageUrl() {
      if (!this.image || !this.image.path) return ''
      return 'local-file://' + encodeURI(this.image.path)
    }
  },
  watch: {
    visible(v) {
      if (v) {
        this._keyHandler = this.handleKey.bind(this)
        window.addEventListener('keydown', this._keyHandler)
      } else {
        window.removeEventListener('keydown', this._keyHandler)
        this.showMeta = false
      }
    },
    // close panel when navigating to a new image
    'image.path'() {
      // keep panel open but MetadataPanel will reload via its own watcher
    }
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
  },
  methods: {
    handleKey(e) {
      switch (e.key) {
        case 'Escape':
          if (this.showMeta) { this.showMeta = false; return }
          this.$emit('close')
          break
        case 'ArrowLeft':  this.$emit('prev'); e.preventDefault(); break
        case 'ArrowRight': this.$emit('next'); e.preventDefault(); break
        case 'i':
        case 'I':
          this.showMeta = !this.showMeta
          break
      }
    },
    handleError(e) {
      if (this.image && this.image.thumbnail) {
        e.target.src = this.image.thumbnail
      }
    },
    formatSize(bytes) {
      if (!bytes) return ''
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / 1048576).toFixed(1) + ' MB'
    }
  }
}
</script>

<style scoped>
.viewer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  z-index: 200;
}

.viewer-body {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  position: relative; /* MetadataPanel positions relative to this */
}

.viewer-image-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  transition: padding-right 0.22s ease;
}

.viewer-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.nav-arrow {
  width: 56px;
  height: 100%;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 48px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
  z-index: 1;
}
.nav-arrow:hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
.nav-arrow:disabled { opacity: 0.2; cursor: default; }

/* ── Bottom bar ───────────────────────────────── */
.viewer-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
  padding: 0 12px;
  position: relative;
  z-index: 11; /* above the panel */
}

.bar-filename {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'SF Mono', 'Menlo', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.bar-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.bar-info-btn {
  margin-left: auto;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 16px;
  width: 28px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  flex-shrink: 0;
  line-height: 1;
  padding: 0;
}
.bar-info-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  border-color: rgba(255, 255, 255, 0.3);
}
.bar-info-btn.active {
  color: #c9a84c;
  border-color: rgba(201, 168, 76, 0.5);
  background: rgba(201, 168, 76, 0.1);
}

/* ── Transitions ──────────────────────────────── */
.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.2s ease;
}
.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}

.img-fade-enter-active,
.img-fade-leave-active {
  transition: opacity 0.15s ease;
}
.img-fade-enter-from,
.img-fade-leave-to {
  opacity: 0;
}
</style>
