<template>
  <div class="integrations-panel">
    <div class="subsection-heading">Obsidian</div>
    <p class="section-desc">
      Connect your Obsidian vault to export session notes and your journal
      as linked Markdown files.
    </p>

    <div class="setting-row">
      <label>Obsidian vault</label>
      <div class="path-input">
        <span class="path-value">{{ vaultPath || 'No vault configured' }}</span>
        <button class="btn-sm" @click="browseVault">Browse&hellip;</button>
        <a v-if="vaultPath" class="clear-link" @click="clearVault">Clear</a>
      </div>
    </div>

    <div class="setting-row">
      <label>Export to subfolder</label>
      <input
        type="text"
        class="text-input"
        v-model="subfolder"
        @change="saveSubfolder"
        placeholder="Frame"
      />
      <div class="path-hint">Notes will be exported to {{ vaultPath || '[vault]' }}/{{ subfolder || 'Frame' }}/</div>
    </div>

    <div v-if="vaultPath" class="export-preview">
      {{ vaultPath }}/{{ subfolder || 'Frame' }}/Sessions/June 28 Tournament.md
    </div>

    <div class="setting-row toggle-row">
      <div class="toggle-labels">
        <label>Auto-export on session complete</label>
        <div class="sublabel">Automatically export a session to Obsidian when you mark it complete.</div>
      </div>
      <button class="toggle-btn" :class="{ on: autoExport }" @click="toggleAutoExport">
        <span class="toggle-knob"></span>
      </button>
    </div>

    <button class="btn-sm export-all-btn" :disabled="!vaultPath || exporting" @click="exportAll">
      {{ exporting ? exportingLabel : 'Export all sessions to Obsidian' }}
    </button>

    <div v-if="lastExport" class="last-export-info">
      Last exported: {{ formattedLastExport }} &middot;
      <a @click="openVaultFolder">{{ vaultPath }}/{{ subfolder || 'Frame' }}/ &#8599;</a>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IntegrationsPanel',
  inject: {
    toast: { default: () => () => {} }
  },
  data() {
    return {
      vaultPath: null,
      subfolder: 'Frame',
      autoExport: false,
      exporting: false,
      exportingLabel: '',
      lastExport: null
    }
  },
  computed: {
    formattedLastExport() {
      if (!this.lastExport) return ''
      return new Date(this.lastExport).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    }
  },
  async mounted() {
    this.vaultPath = (await window.api.invoke('settings:get', 'obsidianVaultPath', null))?.value || null
    this.subfolder = (await window.api.invoke('settings:get', 'obsidianVaultSubfolder', 'Frame'))?.value || 'Frame'
    this.autoExport = (await window.api.invoke('settings:get', 'obsidianAutoExport', false))?.value || false
    this.lastExport = (await window.api.invoke('settings:get', 'obsidianLastExport', null))?.value || null
  },
  methods: {
    async browseVault() {
      const picked = await window.api.invoke('dialog:openVaultFolder')
      if (!picked) return
      this.vaultPath = picked
      await window.api.invoke('settings:set', 'obsidianVaultPath', picked)
      this.toast('Obsidian vault configured', 'success')
    },
    async clearVault() {
      this.vaultPath = null
      await window.api.invoke('settings:set', 'obsidianVaultPath', null)
    },
    async saveSubfolder() {
      const value = (this.subfolder || '').trim() || 'Frame'
      this.subfolder = value
      await window.api.invoke('settings:set', 'obsidianVaultSubfolder', value)
    },
    async toggleAutoExport() {
      this.autoExport = !this.autoExport
      await window.api.invoke('settings:set', 'obsidianAutoExport', this.autoExport)
    },
    async exportAll() {
      this.exporting = true
      const countResult = await window.api.invoke('session:count')
      const n = typeof countResult === 'number' ? countResult : 0
      this.exportingLabel = `Exporting ${n} session${n === 1 ? '' : 's'}…`

      const result = await window.api.invoke('library:exportObsidian', 'all')
      this.exporting = false

      if (result.success) {
        this.lastExport = new Date().toISOString()
        await window.api.invoke('settings:set', 'obsidianLastExport', this.lastExport)
        this.toast(`Exported ${result.filesWritten} files to ${this.vaultPath}/${this.subfolder}/`, 'success')
      } else {
        this.toast(result.error || 'Obsidian export failed', 'error')
      }
    },
    async openVaultFolder() {
      await window.api.invoke('shell:openPath', `${this.vaultPath}/${this.subfolder || 'Frame'}`)
    }
  }
}
</script>

<style scoped>
.subsection-heading {
  font-size: 11px;
  font-weight: 700;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
  margin-bottom: 8px;
}

.section-desc {
  font-size: 11px;
  color: var(--text2);
  margin-bottom: 14px;
  line-height: 1.5;
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

.clear-link {
  font-size: 11px;
  color: var(--text2);
  cursor: pointer;
  text-decoration: underline;
  white-space: nowrap;
}
.clear-link:hover { color: var(--text); }

.text-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.text-input:focus { border-color: var(--accent); }
.text-input::placeholder { color: var(--text2); opacity: 0.6; }

.path-hint {
  font-size: 11px;
  color: var(--text2);
  opacity: 0.7;
  margin-top: 4px;
}

.export-preview {
  font-size: 11px;
  font-style: italic;
  color: var(--text2);
  margin-bottom: 14px;
  word-break: break-all;
}

.toggle-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.toggle-labels label { margin-bottom: 4px; }

.sublabel {
  font-size: 11px;
  color: var(--text2);
  line-height: 1.4;
}

.toggle-btn {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface2);
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.toggle-btn.on {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text);
  transition: transform 0.15s;
}
.toggle-btn.on .toggle-knob {
  transform: translateX(16px);
  background: #1a1a1a;
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
.btn-sm:hover { background: var(--surface-hover); }
.btn-sm:disabled { opacity: 0.4; cursor: default; }

.export-all-btn {
  width: 100%;
  text-align: center;
  padding: 7px 10px;
}

.last-export-info {
  font-size: 11px;
  color: var(--text2);
  margin-top: 10px;
  text-align: center;
}
.last-export-info a {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}
.last-export-info a:hover { text-decoration: underline; }
</style>
