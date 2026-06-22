<template>
  <div class="editor">
    <!-- Toolbar -->
    <div class="toolbar">
      <button class="btn" @click="openImage">Open Image</button>
      <span v-if="originalPath" class="file-name">{{ fileName }}</span>
      <div class="toolbar-spacer"></div>
      <button v-if="canUndo" class="btn" @click="undo">Undo ({{ undoStack.length }})</button>
      <button v-if="hasImage" class="btn" @click="confirmOverwrite = true">Save</button>
      <button v-if="hasImage" class="btn" @click="saveCopy">Save Copy</button>
    </div>

    <!-- Panel tabs -->
    <div class="tabs" v-if="hasImage">
      <button
        class="tab" :class="{ active: activePanel === 'rotate' }"
        @click="activePanel = 'rotate'"
      >Rotate</button>
      <button
        class="tab" :class="{ active: activePanel === 'crop' }"
        @click="activePanel = 'crop'"
      >Crop</button>
    </div>

    <!-- Rotate controls -->
    <div class="controls" v-if="hasImage && activePanel === 'rotate'">
      <button class="btn" @click="doRotate(270)">90° Left</button>
      <button class="btn" @click="doRotate(90)">90° Right</button>
      <button class="btn" @click="doRotate(180)">180°</button>
      <button class="btn" @click="doFlip">Flip Horizontal</button>
    </div>

    <!-- Crop controls -->
    <div class="controls" v-if="hasImage && activePanel === 'crop'">
      <span class="control-label">Aspect:</span>
      <button
        v-for="opt in aspectOptions" :key="opt.label"
        class="btn btn-small" :class="{ active: aspectRatio === opt.value }"
        @click="setAspect(opt.value)"
      >{{ opt.label }}</button>
      <span v-if="cropRect" class="crop-dims">
        {{ Math.round(cropRect.width) }} &times; {{ Math.round(cropRect.height) }}
      </span>
      <div class="toolbar-spacer"></div>
      <button class="btn" :disabled="!cropRect" @click="applyCrop">Apply Crop</button>
      <button class="btn" :disabled="!cropRect" @click="resetCrop">Reset</button>
    </div>

    <!-- Canvas -->
    <div class="canvas-wrap" ref="canvasWrap">
      <canvas
        ref="canvas"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      ></canvas>
      <div v-if="!hasImage" class="canvas-empty empty-state-full">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4v8M36 36v8M4 12h8M36 36h8" />
          <rect x="12" y="12" width="24" height="24" rx="2" />
        </svg>
        <div class="empty-title">No image open</div>
        <div class="empty-hint">Open an image to start editing</div>
      </div>
      <div v-if="operating" class="canvas-loading">
        <div class="spinner"></div>
      </div>
    </div>

    <!-- Confirm overwrite modal -->
    <div v-if="confirmOverwrite" class="modal-overlay" @click.self="confirmOverwrite = false">
      <div class="modal">
        <h4>Overwrite original file?</h4>
        <p>This will replace the original image. Use "Save Copy" to keep the original.</p>
        <div class="modal-actions">
          <button class="btn" @click="confirmOverwrite = false">Cancel</button>
          <button class="btn btn-accent" @click="saveOriginal">Overwrite</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EditorModule',
  inject: ['toast'],
  props: {
    imagePath: { type: String, default: null }
  },
  data() {
    return {
      originalPath: null,
      workingPath: null,
      tempDir: null,
      img: null,
      imageWidth: 0,
      operating: false,
      imageHeight: 0,
      transform: null,
      activePanel: 'rotate',
      undoStack: [],
      confirmOverwrite: false,

      cropRect: null,
      cropDragging: false,
      cropDragType: null,
      cropAnchor: null,
      cropMoveStart: null,
      aspectRatio: null,
      aspectOptions: [
        { label: 'Free', value: null },
        { label: '4:3', value: 4 / 3 },
        { label: '3:2', value: 3 / 2 },
        { label: '1:1', value: 1 },
        { label: '16:9', value: 16 / 9 }
      ]
    }
  },
  computed: {
    hasImage() { return !!this.img },
    canUndo() { return this.undoStack.length > 0 },
    fileName() {
      if (!this.originalPath) return ''
      return this.originalPath.replace(/\\/g, '/').split('/').pop()
    }
  },
  watch: {
    activePanel() {
      this.draw()
    }
  },
  async mounted() {
    this.tempDir = await window.api.invoke('app:getTempDir')
    this._resizeHandler = () => this.draw()
    window.addEventListener('resize', this._resizeHandler)
    if (this.imagePath) {
      await this.loadFile(this.imagePath)
    }
  },
  beforeUnmount() {
    window.removeEventListener('resize', this._resizeHandler)
  },
  methods: {
    // --- File management ---
    async openImage() {
      const file = await window.api.invoke('dialog:openFile')
      if (file) await this.loadFile(file)
    },
    async loadFile(filePath) {
      this.originalPath = filePath
      const ext = this.getExt()
      this.workingPath = this.tempDir + '/editor-working.' + ext
      await window.api.invoke('fs:copyFile', filePath, this.workingPath)
      this.undoStack = []
      this.cropRect = null
      this.activePanel = 'rotate'
      await this.loadImage()
    },
    async loadImage() {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          this.img = img
          this.imageWidth = img.naturalWidth
          this.imageHeight = img.naturalHeight
          this.draw()
          resolve()
        }
        img.onerror = () => resolve()
        img.src = 'local-file://' + encodeURI(this.workingPath) + '?t=' + Date.now()
      })
    },
    async pushUndo() {
      const ext = this.getExt()
      const undoPath = this.tempDir + '/editor-undo-' + Date.now() + '.' + ext
      await window.api.invoke('fs:copyFile', this.workingPath, undoPath)
      this.undoStack.push(undoPath)
      if (this.undoStack.length > 5) this.undoStack.shift()
    },
    async undo() {
      if (!this.undoStack.length) return
      const undoPath = this.undoStack.pop()
      await window.api.invoke('fs:copyFile', undoPath, this.workingPath)
      this.cropRect = null
      await this.loadImage()
    },
    async saveOriginal() {
      await window.api.invoke('fs:copyFile', this.workingPath, this.originalPath)
      this.confirmOverwrite = false
    },
    async saveCopy() {
      const dest = await window.api.invoke('dialog:saveFile', this.originalPath)
      if (dest) {
        await window.api.invoke('fs:copyFile', this.workingPath, dest)
      }
    },
    getExt() {
      if (!this.originalPath) return 'jpg'
      const parts = this.originalPath.split('.')
      return parts[parts.length - 1] || 'jpg'
    },

    // --- Rotate / flip ---
    async doRotate(degrees) {
      this.operating = true
      await this.pushUndo()
      const r = await window.api.invoke('img:rotate', this.workingPath, degrees, this.workingPath)
      if (r.error) this.toast(r.error, 'error')
      this.cropRect = null
      await this.loadImage()
      this.operating = false
    },
    async doFlip() {
      this.operating = true
      await this.pushUndo()
      const r = await window.api.invoke('img:flip', this.workingPath, 'horizontal', this.workingPath)
      if (r.error) this.toast(r.error, 'error')
      this.cropRect = null
      await this.loadImage()
      this.operating = false
    },

    // --- Crop ---
    setAspect(value) {
      this.aspectRatio = value
      if (this.cropRect && value) {
        this.cropRect.height = this.cropRect.width / value
        this.clampCrop()
        this.draw()
      }
    },
    async applyCrop() {
      if (!this.cropRect) return
      const region = {
        x: Math.round(this.cropRect.x),
        y: Math.round(this.cropRect.y),
        width: Math.round(this.cropRect.width),
        height: Math.round(this.cropRect.height)
      }
      if (region.width < 1 || region.height < 1) return
      await this.pushUndo()
      await window.api.invoke('img:crop', this.workingPath, region, this.workingPath)
      this.cropRect = null
      await this.loadImage()
    },
    resetCrop() {
      this.cropRect = null
      this.draw()
    },

    // --- Canvas drawing ---
    draw() {
      const canvas = this.$refs.canvas
      const wrap = this.$refs.canvasWrap
      if (!canvas || !wrap) return

      canvas.width = wrap.clientWidth
      canvas.height = wrap.clientHeight
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (!this.img) return

      const scale = Math.min(canvas.width / this.img.width, canvas.height / this.img.height)
      const dw = this.img.width * scale
      const dh = this.img.height * scale
      const dx = (canvas.width - dw) / 2
      const dy = (canvas.height - dh) / 2
      this.transform = { dx, dy, dw, dh, scale }

      ctx.drawImage(this.img, dx, dy, dw, dh)

      if (this.activePanel === 'crop' && this.cropRect) {
        this.drawCropOverlay(ctx)
      }
    },
    drawCropOverlay(ctx) {
      const t = this.transform
      const r = this.cropRect
      const cx = r.x * t.scale + t.dx
      const cy = r.y * t.scale + t.dy
      const cw = r.width * t.scale
      const ch = r.height * t.scale

      // Darken outside crop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(t.dx, t.dy, t.dw, cy - t.dy)
      ctx.fillRect(t.dx, cy + ch, t.dw, t.dy + t.dh - cy - ch)
      ctx.fillRect(t.dx, cy, cx - t.dx, ch)
      ctx.fillRect(cx + cw, cy, t.dx + t.dw - cx - cw, ch)

      // Border
      ctx.strokeStyle = '#c9a84c'
      ctx.lineWidth = 2
      ctx.strokeRect(cx, cy, cw, ch)

      // Rule-of-thirds lines
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.3)'
      ctx.lineWidth = 1
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(cx + (cw * i) / 3, cy)
        ctx.lineTo(cx + (cw * i) / 3, cy + ch)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx, cy + (ch * i) / 3)
        ctx.lineTo(cx + cw, cy + (ch * i) / 3)
        ctx.stroke()
      }

      // Corner handles
      const hs = 8
      ctx.fillStyle = '#c9a84c'
      const corners = [
        [cx, cy], [cx + cw, cy],
        [cx, cy + ch], [cx + cw, cy + ch]
      ]
      for (const [hx, hy] of corners) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
      }
    },

    // --- Crop mouse interaction ---
    canvasToImage(cx, cy) {
      const t = this.transform
      if (!t) return { x: 0, y: 0 }
      return { x: (cx - t.dx) / t.scale, y: (cy - t.dy) / t.scale }
    },
    imageToCanvas(ix, iy) {
      const t = this.transform
      if (!t) return { x: 0, y: 0 }
      return { x: ix * t.scale + t.dx, y: iy * t.scale + t.dy }
    },
    getCanvasPos(e) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    },
    hitHandle(pos) {
      if (!this.cropRect || !this.transform) return null
      const r = this.cropRect
      const handles = {
        nw: this.imageToCanvas(r.x, r.y),
        ne: this.imageToCanvas(r.x + r.width, r.y),
        sw: this.imageToCanvas(r.x, r.y + r.height),
        se: this.imageToCanvas(r.x + r.width, r.y + r.height)
      }
      for (const [name, h] of Object.entries(handles)) {
        if (Math.abs(pos.x - h.x) < 10 && Math.abs(pos.y - h.y) < 10) return name
      }
      return null
    },
    isInsideCrop(pos) {
      if (!this.cropRect || !this.transform) return false
      const tl = this.imageToCanvas(this.cropRect.x, this.cropRect.y)
      const br = this.imageToCanvas(
        this.cropRect.x + this.cropRect.width,
        this.cropRect.y + this.cropRect.height
      )
      return pos.x >= tl.x && pos.x <= br.x && pos.y >= tl.y && pos.y <= br.y
    },
    onMouseDown(e) {
      if (this.activePanel !== 'crop' || !this.hasImage) return
      const pos = this.getCanvasPos(e)

      if (this.cropRect) {
        const handle = this.hitHandle(pos)
        if (handle) {
          this.cropDragging = true
          this.cropDragType = 'resize'
          const anchors = {
            nw: { x: this.cropRect.x + this.cropRect.width, y: this.cropRect.y + this.cropRect.height },
            ne: { x: this.cropRect.x, y: this.cropRect.y + this.cropRect.height },
            sw: { x: this.cropRect.x + this.cropRect.width, y: this.cropRect.y },
            se: { x: this.cropRect.x, y: this.cropRect.y }
          }
          this.cropAnchor = anchors[handle]
          return
        }
        if (this.isInsideCrop(pos)) {
          this.cropDragging = true
          this.cropDragType = 'move'
          const imgPos = this.canvasToImage(pos.x, pos.y)
          this.cropMoveStart = {
            mx: imgPos.x, my: imgPos.y,
            rx: this.cropRect.x, ry: this.cropRect.y
          }
          return
        }
      }

      // New selection
      const imgPos = this.canvasToImage(pos.x, pos.y)
      if (imgPos.x >= 0 && imgPos.x <= this.imageWidth && imgPos.y >= 0 && imgPos.y <= this.imageHeight) {
        this.cropAnchor = { x: imgPos.x, y: imgPos.y }
        this.cropRect = { x: imgPos.x, y: imgPos.y, width: 0, height: 0 }
        this.cropDragging = true
        this.cropDragType = 'resize'
      }
    },
    onMouseMove(e) {
      if (!this.cropDragging) {
        this.updateCursor(e)
        return
      }
      const pos = this.getCanvasPos(e)
      const imgPos = this.canvasToImage(pos.x, pos.y)
      imgPos.x = Math.max(0, Math.min(this.imageWidth, imgPos.x))
      imgPos.y = Math.max(0, Math.min(this.imageHeight, imgPos.y))

      if (this.cropDragType === 'resize') {
        let w = imgPos.x - this.cropAnchor.x
        let h = imgPos.y - this.cropAnchor.y
        if (this.aspectRatio) {
          h = (Math.abs(w) / this.aspectRatio) * (h >= 0 ? 1 : -1)
        }
        const x = w >= 0 ? this.cropAnchor.x : this.cropAnchor.x + w
        const y = h >= 0 ? this.cropAnchor.y : this.cropAnchor.y + h
        this.cropRect = { x, y, width: Math.abs(w), height: Math.abs(h) }
        this.clampCrop()
      } else if (this.cropDragType === 'move') {
        const dx = imgPos.x - this.cropMoveStart.mx
        const dy = imgPos.y - this.cropMoveStart.my
        this.cropRect.x = Math.max(0, Math.min(this.cropMoveStart.rx + dx, this.imageWidth - this.cropRect.width))
        this.cropRect.y = Math.max(0, Math.min(this.cropMoveStart.ry + dy, this.imageHeight - this.cropRect.height))
      }
      this.draw()
    },
    onMouseUp() {
      if (!this.cropDragging) return
      this.cropDragging = false
      if (this.cropRect && this.cropRect.width < 5 && this.cropRect.height < 5) {
        this.cropRect = null
      }
      this.draw()
    },
    clampCrop() {
      if (!this.cropRect) return
      const r = this.cropRect
      r.x = Math.max(0, r.x)
      r.y = Math.max(0, r.y)
      r.width = Math.min(r.width, this.imageWidth - r.x)
      r.height = Math.min(r.height, this.imageHeight - r.y)
    },
    updateCursor(e) {
      const canvas = this.$refs.canvas
      if (!canvas) return
      if (this.activePanel !== 'crop') {
        canvas.style.cursor = 'default'
        return
      }
      if (!this.cropRect) {
        canvas.style.cursor = 'crosshair'
        return
      }
      const pos = this.getCanvasPos(e)
      const handle = this.hitHandle(pos)
      if (handle) {
        const cursors = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }
        canvas.style.cursor = cursors[handle]
      } else if (this.isInsideCrop(pos)) {
        canvas.style.cursor = 'move'
      } else {
        canvas.style.cursor = 'crosshair'
      }
    }
  }
}
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.toolbar-spacer { flex: 1; }

.file-name {
  font-size: 13px;
  color: var(--text2);
  font-family: 'SF Mono', 'Menlo', monospace;
}

.tabs {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  flex-shrink: 0;
}

.tab {
  padding: 8px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text2);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.tab:hover { color: var(--text); }
.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.control-label {
  font-size: 12px;
  color: var(--text2);
  margin-right: 4px;
}

.crop-dims {
  font-size: 12px;
  color: var(--accent);
  font-family: 'SF Mono', 'Menlo', monospace;
  margin-left: 12px;
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
.btn:hover { background: #383838; border-color: rgba(255,255,255,0.15); }
.btn:disabled { opacity: 0.4; cursor: default; }
.btn.active { border-color: var(--accent); color: var(--accent); }

.btn-accent {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
  font-weight: 600;
}
.btn-accent:hover { background: #d4b35a; }

.btn-small { padding: 4px 10px; font-size: 11px; }

.canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg);
}

.canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.canvas-empty {
  position: absolute;
  inset: 0;
}

.canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 26, 0.6);
  z-index: 5;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  max-width: 380px;
  width: 90%;
}

.modal h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.modal p {
  font-size: 13px;
  color: var(--text2);
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
