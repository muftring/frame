<template>
  <div class="backup-panel">
    <h4>Auto-backup</h4>
    <div class="toggle-row">
      <div class="toggle-labels">
        <label>Back up database on launch</label>
        <div class="sublabel">A copy of your session database is saved each time Frame starts. Keeps the last 7 days.</div>
      </div>
      <button class="toggle-btn" :class="{ on: autoBackupEnabled }" @click="toggleAutoBackup">
        <span class="toggle-knob"></span>
      </button>
    </div>

    <div class="note-row">
      <span class="note-icon">&#9432;</span>
      <span class="note-text">
        Frame backs up your session database automatically. Your photo files
        are not included — back those up separately using Time Machine or
        your preferred backup solution.
      </span>
    </div>

    <div class="backups-header">
      <h4>Recent backups</h4>
      <a class="open-folder-link" @click="openFolder">Open folder ↗</a>
    </div>

    <div v-if="!backups.length" class="muted">No backups yet. Frame will create one on next launch.</div>
    <div v-else class="backup-list">
      <div v-for="b in backups" :key="b.filename" class="backup-row">
        <div class="backup-left">
          <div class="backup-date">{{ formatBackupDate(b.createdAt) }}</div>
          <div class="backup-filename">{{ b.filename }}</div>
        </div>
        <div class="backup-right">
          <span class="backup-size">{{ formatSize(b.sizeBytes) }}</span>
          <template v-if="confirmingDelete === b.filename">
            <span class="delete-confirm-text">Delete this backup?</span>
            <button class="btn-sm danger" @click="confirmDelete(b)">Yes, delete</button>
            <button class="btn-sm" @click="confirmingDelete = null">Cancel</button>
          </template>
          <template v-else>
            <button class="btn-sm" @click="startRestore(b)">Restore</button>
            <a class="delete-link" @click="confirmingDelete = b.filename">Delete</a>
          </template>
        </div>
      </div>
    </div>

    <div v-if="restoreTarget" class="backup-backdrop" @click.self="cancelRestore">
      <div class="restore-modal">
        <div class="modal-header">Restore from backup?</div>
        <div class="modal-body">
          <p>This will replace your current Frame library with the backup from {{ formatBackupDate(restoreTarget.createdAt) }}.</p>
          <p>Any changes made since then will be lost.</p>
          <p>Your current library will be saved as an additional backup before restoring.</p>
          <div v-if="restoring" class="restoring-text">{{ restoreStatusText }}</div>
          <div v-if="restoreError" class="warn-box">{{ restoreError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-sm" @click="cancelRestore" :disabled="restoring">Cancel</button>
          <button class="btn-sm primary" @click="doRestore" :disabled="restoring">Restore and restart</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BackupPanel',
  inject: {
    setModalOpen: { default: () => () => {} },
    toast: { default: () => () => {} }
  },
  data() {
    return {
      autoBackupEnabled: true,
      backups: [],
      confirmingDelete: null,
      restoreTarget: null,
      restoring: false,
      restoreStatusText: '',
      restoreError: null
    }
  },
  async mounted() {
    const result = await window.api.invoke('settings:get', 'autoBackup.enabled', true)
    this.autoBackupEnabled = result?.value !== false
    await this.loadBackups()
  },
  methods: {
    async loadBackups() {
      const all = await window.api.invoke('backup:list')
      this.backups = (all || []).slice(0, 7)
    },
    async toggleAutoBackup() {
      this.autoBackupEnabled = !this.autoBackupEnabled
      await window.api.invoke('settings:set', 'autoBackup.enabled', this.autoBackupEnabled)
    },
    async openFolder() {
      await window.api.invoke('backup:openFolder')
    },
    formatBackupDate(iso) {
      const now = new Date()
      const d = new Date(iso)
      const diffDays = Math.floor((now - d) / 86400000)
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      if (diffDays === 0) return 'Today, ' + timeStr
      if (diffDays === 1) return 'Yesterday, ' + timeStr
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + timeStr
    },
    formatSize(bytes) {
      if (!bytes) return '0 KB'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    },
    startRestore(b) {
      this.restoreTarget = b
      this.restoreError = null
      this.setModalOpen(true)
    },
    cancelRestore() {
      if (this.restoring) return
      this.restoreTarget = null
      this.setModalOpen(false)
    },
    async doRestore() {
      this.restoring = true
      this.restoreStatusText = 'Restoring…'
      this.restoreError = null
      try {
        const result = await window.api.invoke('backup:restore', this.restoreTarget.path)
        if (result && result.success === false) {
          this.restoring = false
          this.restoreError = result.error || 'Restore failed.'
          return
        }
        this.restoreStatusText = 'Restarting Frame…'
      } catch {
        // main.js calls app.exit(0) right after a successful restore, so the
        // invoke() promise can reject from the process dying mid-flight —
        // that's the expected success path here, not a real failure.
        this.restoreStatusText = 'Restarting Frame…'
      }
    },
    async confirmDelete(b) {
      this.confirmingDelete = null
      const prev = this.backups
      this.backups = this.backups.filter(x => x.filename !== b.filename)
      const result = await window.api.invoke('backup:delete', b.path)
      if (!result?.success) {
        this.backups = prev
        this.toast('Failed to delete backup: ' + (result?.error || 'unknown error'), 'error')
      }
    }
  }
}
</script>

<style scoped>
h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}

.toggle-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.toggle-labels label {
  display: block;
  font-size: 13px;
  color: var(--text);
  margin-bottom: 4px;
}

.sublabel {
  font-size: 12px;
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

.note-row {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
}

.note-icon {
  font-size: 11px;
  color: var(--text2);
  flex-shrink: 0;
}

.note-text {
  font-size: 11px;
  font-style: italic;
  color: var(--text2);
  line-height: 1.5;
}

.backups-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.open-folder-link {
  font-size: 11px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}
.open-folder-link:hover { text-decoration: underline; }

.muted {
  font-size: 12px;
  color: var(--text2);
}

.backup-list {
  display: flex;
  flex-direction: column;
}

.backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.backup-row:last-child { border-bottom: none; }

.backup-left {
  min-width: 0;
}

.backup-date {
  font-size: 12px;
  color: var(--text);
}

.backup-filename {
  font-size: 11px;
  font-family: 'SF Mono', 'Menlo', monospace;
  color: var(--text2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backup-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.backup-size {
  font-size: 11px;
  color: var(--text2);
  min-width: 46px;
  text-align: right;
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
.btn-sm.danger {
  color: var(--color-delete-hover, #b33333);
  border-color: var(--color-delete-hover, #b33333);
  background: transparent;
}

.delete-link {
  font-size: 11px;
  color: var(--color-delete-hover, #b33333);
  cursor: pointer;
  text-decoration: none;
}
.delete-link:hover { text-decoration: underline; }

.delete-confirm-text {
  font-size: 11px;
  color: var(--text2);
}

.backup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.restore-modal {
  width: 340px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.modal-body {
  padding: 16px;
}

.modal-body p {
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  margin-bottom: 10px;
}
.modal-body p:last-child { margin-bottom: 0; }

.restoring-text {
  font-size: 12px;
  color: var(--accent);
  margin-top: 10px;
}

.warn-box {
  font-size: 12px;
  color: var(--text);
  background: rgba(178, 34, 34, 0.12);
  border: 1px solid rgba(178, 34, 34, 0.4);
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 10px;
  line-height: 1.4;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.btn-sm.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a1a1a;
  font-weight: 600;
}
.btn-sm.primary:disabled { opacity: 0.4; }
</style>
