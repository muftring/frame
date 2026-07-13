<template>
  <div class="editor-backdrop" @click.self="$emit('close')">
    <div class="editor-modal" @click.stop>

      <div class="editor-header">
        <h2 class="editor-title">New Burst Set</h2>
        <button class="editor-close" @click="$emit('close')">✕</button>
      </div>

      <div class="editor-body">
        <div class="field-group">
          <label class="field-label">Name</label>
          <input
            v-model="name"
            class="field-input"
            placeholder="Burst set name"
            maxlength="60"
            ref="nameInput"
          />
        </div>

        <div class="field-group">
          <label class="field-label">Files <span class="label-hint">({{ selectedIds.length }} selected)</span></label>
          <div v-if="loading" class="file-list-loading">Loading session files…</div>
          <div v-else-if="!availableFiles.length" class="file-list-empty">
            No unassigned files in this session — every file already belongs to a burst set.
          </div>
          <div v-else class="file-list">
            <label v-for="f in availableFiles" :key="f.id" class="file-row">
              <input type="checkbox" :value="f.id" v-model="selectedIds" />
              <img v-if="thumbnails[f.id]" :src="thumbnails[f.id]" class="file-thumb" />
              <div v-else class="file-thumb-placeholder"></div>
              <span class="file-name">{{ f.filename }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn-primary" @click="create" :disabled="creating || !name.trim() || selectedIds.length < 2">
          {{ creating ? 'Creating…' : 'Create Burst Set' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script>
export default {
  name: 'ManualBurstSetModal',
  props: {
    activeSession: { type: Object, default: null }
  },
  emits: ['close', 'created'],
  data() {
    return {
      name: 'New Burst',
      loading: false,
      availableFiles: [],
      selectedIds: [],
      thumbnails: {},
      creating: false
    }
  },
  async mounted() {
    this.$nextTick(() => this.$refs.nameInput?.focus())
    await this.loadFiles()
  },
  methods: {
    async loadFiles() {
      if (!this.activeSession) return
      this.loading = true
      const files = await window.api.invoke('file:listBySession', this.activeSession.id, {})
      this.availableFiles = Array.isArray(files) ? files.filter(f => !f.burst_set_id) : []
      this.loading = false
      for (const f of this.availableFiles) {
        const thumb = await window.api.invoke('img:thumbnail', f.full_path, { width: 48, height: 36 })
        this.thumbnails = { ...this.thumbnails, [f.id]: thumb }
      }
    },
    async create() {
      if (!this.name.trim() || this.selectedIds.length < 2 || this.creating) return
      this.creating = true
      try {
        await window.api.invoke('burst:confirmSet', this.activeSession.id, [...this.selectedIds], this.name.trim())
        this.$emit('created')
      } finally {
        this.creating = false
      }
    }
  }
}
</script>

<style scoped>
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
  width: 420px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.editor-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
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
}
.editor-close:hover { opacity: 1; background: var(--surface2); }

.editor-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.label-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.6;
}

.field-input {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 13px;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus { border-color: var(--accent); }

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.file-row:hover { background: var(--surface2); }

.file-thumb {
  width: 40px;
  height: 30px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.file-thumb-placeholder {
  width: 40px;
  height: 30px;
  border-radius: 3px;
  background: var(--surface2);
  flex-shrink: 0;
}

.file-name {
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-list-loading,
.file-list-empty {
  font-size: 12px;
  color: var(--text2);
  padding: 10px;
  text-align: center;
}

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
</style>
