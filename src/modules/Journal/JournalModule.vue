<template>
  <div class="journal">
    <div class="journal-topbar">
      <span class="journal-title">Journal</span>
      <div class="journal-actions">
        <span class="journal-status" :class="saveStatus">
          <span v-if="saveStatus === 'saving'">Saving&hellip;</span>
          <span v-if="saveStatus === 'saved'">Saved &check;</span>
        </span>
        <span class="journal-wordcount">{{ wordCount }} word{{ wordCount === 1 ? '' : 's' }}</span>
        <button class="btn-ghost" @click="togglePreview">{{ previewMode ? 'Edit' : 'Preview' }}</button>
        <button
          class="btn-ghost"
          :disabled="!obsidianVaultPath"
          :title="obsidianVaultPath ? '' : 'Configure an Obsidian vault path in Settings first'"
          @click="exportToObsidian"
        >Export to Obsidian</button>
        <button class="btn-ghost" @click="openInEditor">Open in editor</button>
      </div>
    </div>

    <div v-if="activeSession" class="journal-context-bar" @click="$emit('navigate', 'home')">
      Active session: {{ activeSession.name }} &mdash; Add a session note on the Home screen
    </div>

    <div class="journal-editor-area">
      <div class="journal-column">
        <div v-show="!previewMode" class="journal-editor-wrap">
          <MarkdownEditor
            v-model="content"
            :placeholder="placeholder"
            minHeight="100%"
            alwaysEdit
            :saveStatus="saveStatus"
            @save="onSave"
          />
        </div>
        <div v-show="previewMode" class="journal-preview" v-html="renderedPreview"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from 'marked'
import MarkdownEditor from '../../components/MarkdownEditor.vue'

const PLACEHOLDER = `Your photographer's journal…

Start writing. This is your space for reflections,
observations, and notes about your work with Frame.
No structure required.`

export default {
  name: 'JournalModule',
  components: { MarkdownEditor },
  inject: {
    toast: { default: () => () => {} }
  },
  props: {
    activeSession: { type: Object, default: null }
  },
  emits: ['navigate'],
  data() {
    return {
      content: '',
      placeholder: PLACEHOLDER,
      saveStatus: '',
      saveTimer: null,
      previewMode: false,
      obsidianVaultPath: null
    }
  },
  computed: {
    wordCount() {
      if (!this.content) return 0
      return this.content.trim().split(/\s+/).filter(Boolean).length
    },
    renderedPreview() {
      if (!this.content) return ''
      return marked(this.content)
    }
  },
  async created() {
    const result = await window.api.invoke('journal:read')
    this.content = result.content
    const vault = await window.api.invoke('settings:get', 'obsidianVaultPath', null)
    this.obsidianVaultPath = vault?.value || null
  },
  methods: {
    onSave(text) {
      clearTimeout(this.saveTimer)
      this.saveStatus = 'saving'
      this.saveTimer = setTimeout(async () => {
        await window.api.invoke('journal:write', text)
        this.saveStatus = 'saved'
        setTimeout(() => { this.saveStatus = '' }, 2000)
      }, 800)
    },
    togglePreview() {
      this.previewMode = !this.previewMode
    },
    async openInEditor() {
      const p = await window.api.invoke('journal:getPath')
      await window.api.invoke('shell:openPath', p)
    },
    async exportToObsidian() {
      if (!this.obsidianVaultPath) return
      const result = await window.api.invoke('library:exportObsidian', 'journal')
      if (result.success) {
        this.toast('Journal exported to Obsidian', 'success')
      } else {
        this.toast(result.error || 'Obsidian export failed', 'error')
      }
    }
  }
}
</script>

<style scoped>
.journal {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg);
}

.journal-topbar {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.journal-title {
  font-size: var(--text-base);
  color: var(--color-text-2);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.journal-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.journal-status {
  font-size: var(--text-xs);
  color: var(--color-text-3);
  min-width: 60px;
}
.journal-status.saved { color: var(--color-keep-hover); }

.journal-wordcount {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-border-2);
  color: var(--color-text-2);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--dur-base), border-color var(--dur-base);
}
.btn-ghost:hover { background: var(--color-surface-2); }
.btn-ghost:disabled { opacity: 0.4; cursor: default; }

.journal-context-bar {
  padding: 6px 20px;
  background: var(--color-accent-dim);
  border-bottom: 1px solid rgba(201, 168, 76, 0.2);
  font-size: var(--text-xs);
  color: var(--color-accent);
  cursor: pointer;
  flex-shrink: 0;
}
.journal-context-bar:hover { text-decoration: underline; }

.journal-editor-area {
  flex: 1;
  display: flex;
  overflow-y: auto;
  padding: 24px 32px 32px;
}

.journal-column {
  max-width: 680px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.journal-editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.journal-editor-wrap :deep(.md-editor) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.journal-editor-wrap :deep(.md-textarea) {
  flex: 1;
}

.journal-preview {
  flex: 1;
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--color-text);
}

/* Mirrors MarkdownEditor.vue's .md-view rendered-content rules — scoped
   styles don't cross component boundaries, so a v-html preview rendered
   directly in this template needs its own copy. */
.journal-preview :deep(p) { margin-bottom: 12px; }
.journal-preview :deep(h1),
.journal-preview :deep(h2),
.journal-preview :deep(h3) {
  color: var(--color-text);
  margin: 20px 0 8px;
  font-weight: 500;
}
.journal-preview :deep(h1) { font-size: 1.6em; }
.journal-preview :deep(h2) { font-size: 1.3em; }
.journal-preview :deep(h3) { font-size: 1.1em; }
.journal-preview :deep(a) { color: var(--color-accent); }
.journal-preview :deep(strong) { color: var(--color-text); }
.journal-preview :deep(em) { color: var(--color-text-2); }
.journal-preview :deep(ul),
.journal-preview :deep(ol) {
  padding-left: 22px;
  margin-bottom: 12px;
}
.journal-preview :deep(li) { margin-bottom: 4px; }
.journal-preview :deep(code) {
  background: var(--color-surface-3);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.journal-preview :deep(blockquote) {
  border-left: 3px solid var(--color-accent);
  padding-left: 14px;
  color: var(--color-text-2);
  margin: 12px 0;
}
</style>
