<template>
  <div class="editor-backdrop" @click.self="$emit('cancel')">
    <div class="editor-modal" @click.stop>

      <div class="editor-header">
        <h2 class="editor-title">{{ album ? 'Edit Album' : 'New Smart Album' }}</h2>
        <button class="editor-close" @click="$emit('cancel')">✕</button>
      </div>

      <div class="editor-body">

        <!-- Name -->
        <div class="field-group">
          <label class="field-label">Name</label>
          <input
            v-model="localAlbum.name"
            class="field-input"
            placeholder="Album name"
            maxlength="60"
            ref="nameInput"
          />
        </div>

        <!-- Rules -->
        <div class="field-group">
          <label class="field-label">Rules <span class="label-hint">(all must match)</span></label>

          <div class="rules-list">
            <div v-for="(rule, i) in localAlbum.rules" :key="i" class="rule-row">

              <!-- Field -->
              <select
                :value="rule.field"
                @change="onFieldChange(i, $event.target.value)"
                class="rule-select rule-field"
              >
                <option v-for="f in FIELDS" :key="f.value" :value="f.value">{{ f.label }}</option>
              </select>

              <!-- Operator -->
              <select
                :value="rule.operator"
                @change="onOpChange(i, $event.target.value)"
                class="rule-select rule-op"
              >
                <option v-for="[v, l] in fieldOps(rule.field)" :key="v" :value="v">{{ l }}</option>
              </select>

              <!-- Value -->
              <select
                v-if="rule.field === 'status'"
                :value="rule.value"
                @change="setRuleValue(i, $event.target.value)"
                class="rule-select rule-val"
              >
                <option value="unreviewed">Unreviewed</option>
                <option value="kept">Kept</option>
                <option value="deleted">Deleted</option>
                <option value="published">Published</option>
              </select>

              <input
                v-else-if="rule.field === 'rating'"
                type="number"
                min="0"
                max="5"
                :value="rule.value"
                @input="setRuleValue(i, Number($event.target.value))"
                class="rule-input rule-val-sm"
              />

              <input
                v-else-if="rule.field === 'exif_ts' && rule.operator === 'in_last_days'"
                type="number"
                min="1"
                :value="rule.value"
                @input="setRuleValue(i, Number($event.target.value))"
                class="rule-input rule-val-sm"
                placeholder="days"
              />

              <input
                v-else-if="rule.field === 'exif_ts'"
                type="date"
                :value="toDateStr(rule.value)"
                @change="setRuleValue(i, toMs($event.target.value))"
                class="rule-input rule-val"
              />

              <span v-else-if="rule.field === 'size_bytes'" class="rule-val-mb">
                <input
                  type="number"
                  min="0"
                  :value="toMb(rule.value)"
                  @input="setRuleValue(i, fromMb($event.target.value))"
                  class="rule-input rule-val-sm"
                />
                <span class="unit-label">MB</span>
              </span>

              <input
                v-else
                type="text"
                :value="rule.value"
                @input="setRuleValue(i, $event.target.value)"
                class="rule-input rule-val"
                placeholder="value"
              />

              <button
                class="rule-remove"
                @click="removeRule(i)"
                :disabled="localAlbum.rules.length === 1"
                title="Remove rule"
              >✕</button>
            </div>
          </div>

          <button class="add-rule-btn" @click="addRule">+ Add rule</button>
        </div>

        <!-- Sort -->
        <div class="field-row">
          <div class="field-group field-group-sm">
            <label class="field-label">Sort by</label>
            <select v-model="localAlbum.sort_by" class="field-input">
              <option value="exif_ts">Date taken</option>
              <option value="filename">Filename</option>
              <option value="rating">Rating</option>
            </select>
          </div>
          <div class="field-group field-group-sm">
            <label class="field-label">Direction</label>
            <div class="dir-toggle">
              <button
                class="dir-btn"
                :class="{ active: localAlbum.sort_dir === 'asc' }"
                @click="localAlbum.sort_dir = 'asc'"
              >Asc</button>
              <button
                class="dir-btn"
                :class="{ active: localAlbum.sort_dir === 'desc' }"
                @click="localAlbum.sort_dir = 'desc'"
              >Desc</button>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div class="preview-row">
          <span class="preview-label">Preview:</span>
          <span v-if="previewCount === null" class="preview-count preview-loading">—</span>
          <span v-else class="preview-count">{{ previewCount }} {{ previewCount === 1 ? 'file' : 'files' }} match</span>
        </div>

      </div>

      <div class="editor-footer">
        <button class="btn-secondary" @click="$emit('cancel')">Cancel</button>
        <button class="btn-primary" @click="save" :disabled="saving || !localAlbum.name.trim()">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script>
const FIELDS = [
  { value: 'status',       label: 'Status' },
  { value: 'rating',       label: 'Rating' },
  { value: 'exif_ts',      label: 'Date taken' },
  { value: 'filename',     label: 'Filename' },
  { value: 'size_bytes',   label: 'File size' },
  { value: 'published_to', label: 'Published to' },
]

const FIELD_OPS = {
  status:       [['eq','is'], ['neq','is not']],
  rating:       [['gte','≥'], ['gt','>'], ['eq','='], ['lte','≤'], ['lt','<']],
  exif_ts:      [['in_last_days','within last N days'], ['gte','on/after'], ['lte','on/before']],
  filename:     [['contains','contains'], ['not_contains','does not contain'], ['eq','is'], ['neq','is not']],
  size_bytes:   [['gte','at least'], ['lte','at most'], ['gt','>'], ['lt','<']],
  published_to: [['eq','is'], ['neq','is not'], ['contains','contains'], ['not_contains','does not contain']],
}

function defaultValueFor(field, op) {
  if (field === 'status') return 'kept'
  if (field === 'rating') return 3
  if (field === 'exif_ts') return op === 'in_last_days' ? 7 : Date.now()
  if (field === 'size_bytes') return 10000000
  return ''
}

export default {
  name: 'SmartAlbumEditor',
  props: {
    album: { type: Object, default: null }
  },
  emits: ['saved', 'cancel'],
  data() {
    return {
      FIELDS,
      localAlbum: {
        name: '',
        rules: [{ field: 'status', operator: 'eq', value: 'kept' }],
        sort_by: 'exif_ts',
        sort_dir: 'asc',
      },
      previewCount: null,
      previewTimer: null,
      saving: false
    }
  },
  watch: {
    'localAlbum.rules': {
      deep: true,
      handler() { this.schedulePreview() }
    }
  },
  created() {
    if (this.album) {
      this.localAlbum = {
        name: this.album.name,
        rules: JSON.parse(JSON.stringify(this.album.rules || [])),
        sort_by: this.album.sortBy || this.album.sort_by || 'exif_ts',
        sort_dir: this.album.sortDir || this.album.sort_dir || 'asc',
      }
    }
    this.runPreview()
  },
  mounted() {
    this.$nextTick(() => this.$refs.nameInput?.focus())
  },
  beforeUnmount() {
    clearTimeout(this.previewTimer)
  },
  methods: {
    fieldOps(field) {
      return FIELD_OPS[field] || [['eq','is']]
    },

    onFieldChange(i, field) {
      const ops = FIELD_OPS[field] || [['eq', 'is']]
      const op = ops[0][0]
      const rules = [...this.localAlbum.rules]
      rules[i] = { field, operator: op, value: defaultValueFor(field, op) }
      this.localAlbum = { ...this.localAlbum, rules }
    },

    onOpChange(i, op) {
      const rule = this.localAlbum.rules[i]
      let value = rule.value
      // When switching in_last_days ↔ date operators, reset value to avoid type mismatch
      if (rule.field === 'exif_ts') {
        value = defaultValueFor('exif_ts', op)
      }
      const rules = [...this.localAlbum.rules]
      rules[i] = { ...rules[i], operator: op, value }
      this.localAlbum = { ...this.localAlbum, rules }
    },

    setRuleValue(i, val) {
      const rules = [...this.localAlbum.rules]
      rules[i] = { ...rules[i], value: val }
      this.localAlbum = { ...this.localAlbum, rules }
    },

    addRule() {
      this.localAlbum = {
        ...this.localAlbum,
        rules: [...this.localAlbum.rules, { field: 'status', operator: 'eq', value: 'kept' }]
      }
    },

    removeRule(i) {
      if (this.localAlbum.rules.length <= 1) return
      this.localAlbum = {
        ...this.localAlbum,
        rules: this.localAlbum.rules.filter((_, idx) => idx !== i)
      }
    },

    schedulePreview() {
      clearTimeout(this.previewTimer)
      this.previewCount = null
      this.previewTimer = setTimeout(() => this.runPreview(), 350)
    },

    async runPreview() {
      const result = await window.api.invoke('album:preview', this.localAlbum.rules, 'global', null)
      if (result && !result.error) this.previewCount = result.count
    },

    async save() {
      if (!this.localAlbum.name.trim() || this.saving) return
      this.saving = true
      try {
        let id
        if (this.album) {
          await window.api.invoke('album:update', this.album.id, {
            name:     this.localAlbum.name.trim(),
            rules:    this.localAlbum.rules,
            sort_by:  this.localAlbum.sort_by,
            sort_dir: this.localAlbum.sort_dir,
          })
          id = this.album.id
        } else {
          const result = await window.api.invoke('album:create',
            this.localAlbum.name.trim(),
            this.localAlbum.rules,
            'global',
            null,
            this.localAlbum.sort_by,
            this.localAlbum.sort_dir
          )
          id = result?.id
        }
        this.$emit('saved', { id, name: this.localAlbum.name.trim() })
      } finally {
        this.saving = false
      }
    },

    toDateStr(ms) {
      if (!ms) return ''
      try { return new Date(ms).toISOString().slice(0, 10) } catch { return '' }
    },
    toMs(str) {
      if (!str) return 0
      return new Date(str).getTime()
    },
    toMb(bytes) {
      return bytes ? Math.round(bytes / 1e6) : ''
    },
    fromMb(mb) {
      return Number(mb) * 1e6
    }
  }
}
</script>

<style scoped>
/* TODO Branding-B: migrate to tokens.css variables */
/* ── Modal shell ──────────────────────────────── */
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
  width: 560px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* ── Header ───────────────────────────────────── */
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

/* ── Body ─────────────────────────────────────── */
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

.field-row {
  display: flex;
  gap: 12px;
}

.field-group-sm { flex: 1; }

/* ── Rules ────────────────────────────────────── */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rule-select,
.rule-input {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
  transition: border-color 0.15s;
}
.rule-select:focus,
.rule-input:focus {
  border-color: var(--accent);
}

.rule-field { flex: 0 0 108px; }
.rule-op    { flex: 0 0 130px; }
.rule-val   { flex: 1; }
.rule-val-sm { flex: 0 0 68px; }

.rule-val-mb {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.unit-label {
  font-size: 11px;
  color: var(--text2);
  white-space: nowrap;
}

.rule-remove {
  background: none;
  border: none;
  color: var(--text2);
  font-size: 11px;
  cursor: pointer;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.4;
  flex-shrink: 0;
  transition: opacity 0.15s, background 0.15s;
}
.rule-remove:hover:not(:disabled) { opacity: 1; background: rgba(239, 83, 80, 0.15); color: #ef5350; }
.rule-remove:disabled { cursor: default; opacity: 0.15; }

.add-rule-btn {
  align-self: flex-start;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 5px;
  color: var(--text2);
  font-size: 11px;
  padding: 5px 12px;
  cursor: pointer;
  margin-top: 2px;
  transition: background 0.15s, color 0.15s;
}
.add-rule-btn:hover { background: var(--surface2); color: var(--text); }

/* ── Sort / Direction ─────────────────────────── */
.dir-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 5px;
  overflow: hidden;
}

.dir-btn {
  flex: 1;
  background: none;
  border: none;
  color: var(--text2);
  font-size: 12px;
  padding: 7px 12px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.dir-btn + .dir-btn {
  border-left: 1px solid var(--border);
}
.dir-btn.active {
  background: var(--accent);
  color: #1a1a1a;
  font-weight: 600;
}
.dir-btn:not(.active):hover { background: var(--surface2); color: var(--text); }

/* ── Preview ──────────────────────────────────── */
.preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
}

.preview-label {
  font-size: 11px;
  color: var(--text2);
  font-weight: 600;
}

.preview-count {
  font-size: 12px;
  color: var(--text);
}

.preview-loading {
  color: var(--text2);
  opacity: 0.4;
}

/* ── Footer ───────────────────────────────────── */
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
