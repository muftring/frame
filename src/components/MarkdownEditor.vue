<template>
  <div class="md-editor" :class="{ editing }">

    <div
      v-if="!editing && modelValue"
      class="md-view"
      @click="startEdit"
      v-html="renderedContent"
    />
    <div
      v-if="!editing && !modelValue"
      class="md-placeholder"
      @click="startEdit"
    >{{ placeholder }}</div>

    <textarea
      v-if="editing"
      ref="textarea"
      class="md-textarea"
      v-model="localValue"
      @input="onInput"
      @keydown.escape="stopEdit"
      @keydown.meta.enter="stopEdit"
      :placeholder="placeholder"
      :style="{ minHeight }"
    />

    <div v-if="editing" class="md-toolbar">
      <span class="md-hint">esc or &#8984;&#8629; to finish &middot; Markdown supported</span>
      <span class="md-save-status" :class="saveStatus">
        <span v-if="saveStatus === 'saving'">Saving&hellip;</span>
        <span v-if="saveStatus === 'saved'">Saved &check;</span>
      </span>
    </div>

  </div>
</template>

<script>
import { marked } from 'marked'

export default {
  name: 'MarkdownEditor',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    minHeight: { type: String, default: '80px' },
    saveStatus: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'save'],
  data() {
    return {
      editing: false,
      localValue: ''
    }
  },
  computed: {
    renderedContent() {
      if (!this.modelValue) return ''
      return marked(this.modelValue)
    }
  },
  methods: {
    startEdit() {
      this.localValue = this.modelValue
      this.editing = true
      this.$nextTick(() => {
        this.$refs.textarea?.focus()
        this.autoResize()
      })
    },
    stopEdit() {
      this.editing = false
      this.$emit('update:modelValue', this.localValue)
      this.$emit('save', this.localValue)
    },
    onInput() {
      this.$emit('update:modelValue', this.localValue)
      this.$emit('save', this.localValue)
      this.autoResize()
    },
    autoResize() {
      const ta = this.$refs.textarea
      if (!ta) return
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }
}
</script>

<style scoped>
.md-editor {
  position: relative;
  width: 100%;
}

.md-view {
  cursor: text;
  min-height: v-bind(minHeight);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: border-color var(--dur-base);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-text);
}
.md-view:hover {
  border-color: var(--color-border-2);
  background: var(--color-surface-2);
}

.md-view :deep(p) { margin-bottom: 6px; }
.md-view :deep(h1),
.md-view :deep(h2),
.md-view :deep(h3) {
  color: var(--color-text);
  margin: 10px 0 4px;
  font-weight: 500;
}
.md-view :deep(h1) { font-size: var(--text-lg); }
.md-view :deep(h2) { font-size: var(--text-md); }
.md-view :deep(h3) { font-size: var(--text-base); }
.md-view :deep(a) { color: var(--color-accent); }
.md-view :deep(strong) { color: var(--color-text); }
.md-view :deep(em) { color: var(--color-text-2); }
.md-view :deep(ul),
.md-view :deep(ol) {
  padding-left: 18px;
  margin-bottom: 6px;
}
.md-view :deep(li) { margin-bottom: 2px; }
.md-view :deep(code) {
  background: var(--color-surface-3);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.md-view :deep(blockquote) {
  border-left: 3px solid var(--color-accent);
  padding-left: 10px;
  color: var(--color-text-2);
  margin: 6px 0;
}

.md-placeholder {
  cursor: text;
  min-height: v-bind(minHeight);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  color: var(--color-text-3);
  font-size: var(--text-base);
  font-style: italic;
  transition: border-color var(--dur-base);
}
.md-placeholder:hover {
  border-color: var(--color-border);
  background: var(--color-surface-2);
}

.md-textarea {
  width: 100%;
  min-height: v-bind(minHeight);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-2);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.6;
  resize: none;
  overflow: hidden;
  outline: none;
  transition: border-color var(--dur-base);
  box-sizing: border-box;
}
.md-textarea:focus {
  border-color: var(--color-accent);
}

.md-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px 0;
}
.md-hint {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}
.md-save-status {
  font-size: var(--text-xs);
  color: var(--color-text-3);
  transition: opacity 0.3s;
}
.md-save-status.saved {
  color: var(--color-keep-hover);
}
.md-save-status.saving {
  color: var(--color-text-3);
}
</style>
