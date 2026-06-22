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
        <span v-if="meta" class="bar-meta">
          {{ meta.width }} &times; {{ meta.height }} &middot;
          {{ formatSize(image.size) }}
          <template v-if="meta.exifDate"> &middot; {{ meta.exifDate }}</template>
        </span>
        <span v-else class="bar-meta">{{ formatSize(image.size) }}</span>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'ImageViewer',
  props: {
    visible: { type: Boolean, default: false },
    image: { type: Object, default: () => ({}) },
    hasPrev: { type: Boolean, default: false },
    hasNext: { type: Boolean, default: false }
  },
  emits: ['close', 'prev', 'next'],
  data() {
    return { meta: null }
  },
  computed: {
    imageUrl() {
      if (!this.image || !this.image.path) return ''
      return 'local-file://' + encodeURI(this.image.path)
    }
  },
  watch: {
    image: {
      immediate: true,
      handler(img) {
        this.meta = null
        if (img && img.path) this.loadMeta(img.path)
      }
    },
    visible(v) {
      if (v) {
        this._keyHandler = this.handleKey.bind(this)
        window.addEventListener('keydown', this._keyHandler)
      } else {
        window.removeEventListener('keydown', this._keyHandler)
      }
    }
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._keyHandler)
  },
  methods: {
    async loadMeta(filePath) {
      const m = await window.api.invoke('img:getMetadata', filePath)
      if (m.error) return
      const exif = await window.api.invoke('fs:readExif', filePath)
      this.meta = {
        width: m.width,
        height: m.height,
        exifDate: exif.timestamp
          ? new Date(exif.timestamp).toLocaleString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit'
            })
          : null
      }
    },
    handleKey(e) {
      switch (e.key) {
        case 'Escape': this.$emit('close'); break
        case 'ArrowLeft': this.$emit('prev'); e.preventDefault(); break
        case 'ArrowRight': this.$emit('next'); e.preventDefault(); break
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
}

.viewer-image-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
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
}
.nav-arrow:hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
.nav-arrow:disabled { opacity: 0.2; cursor: default; }

.viewer-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.bar-filename {
  font-size: 13px;
  color: var(--text);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.bar-meta {
  font-size: 12px;
  color: var(--text2);
}

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
