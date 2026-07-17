<template>
  <div class="session-card" :class="{ 'is-active': isActive }">
    <div class="sc-header">
      <div class="sc-name-col">
        <input
          v-if="editing"
          ref="editInput"
          v-model="editingName"
          class="sc-name-input"
          @keydown.enter="saveName"
          @keydown.esc="cancelEdit"
          @blur="saveName"
        />
        <span v-else class="sc-name" title="Double-click to rename" @dblclick="startEdit">
          {{ session.name }}
        </span>
      </div>
      <span class="sc-status-badge" :class="'status-' + session.status">{{ statusLabel }}</span>
    </div>

    <div class="sc-date-line">{{ dateLine }}</div>

    <div class="sc-mini-pipeline">
      <div
        v-for="stage in STAGES"
        :key="stage.id"
        class="sc-mini-seg"
        :class="segmentState(stage)"
      ></div>
    </div>

    <div class="sc-stats-row">
      <span class="sc-stat"><span class="sc-stat-num">{{ formatNum(session.fileCount) }}</span> photos</span>
      <span class="sc-stat-sep">·</span>
      <span class="sc-stat"><span class="sc-stat-num">{{ formatNum(session.keptCount) }}</span> kept</span>
      <span class="sc-stat-sep">·</span>
      <span class="sc-stat"><span class="sc-stat-num">{{ keepRateText }}</span> keep rate</span>
    </div>

    <div class="sc-footer">
      <button v-if="session.status === 'active'" class="sc-btn sc-btn-resume" @click="$emit('resume', session)">Resume →</button>
      <button class="sc-btn sc-btn-view" @click="$emit('view', session)">View</button>
      <button v-if="canArchive" class="sc-btn sc-btn-archive" @click="$emit('archive', session)">Archive</button>
    </div>
  </div>
</template>

<script>
const STAGES = [
  { id: 'triage',  doneKey: 'triageComplete' },
  { id: 'sort',    doneKey: 'sortComplete' },
  { id: 'edit',    doneKey: 'editComplete' },
  { id: 'process', doneKey: 'processComplete' },
  { id: 'publish', doneKey: 'publishComplete' },
]

export default {
  name: 'SessionCard',
  props: {
    session: { type: Object, required: true },
    isActive: { type: Boolean, default: false }
  },
  emits: ['resume', 'view', 'archive'],
  data() {
    return {
      STAGES,
      editing: false,
      editingName: ''
    }
  },
  computed: {
    statusLabel() {
      return { active: 'In progress', complete: 'Complete', archived: 'Archived' }[this.session.status] || this.session.status
    },
    canArchive() {
      return (this.session.status === 'complete' || this.session.status === 'active') && !this.isActive
    },
    keepRateText() {
      if (!this.session.fileCount) return '—'
      return Math.round((this.session.keptCount / this.session.fileCount) * 100) + '%'
    },
    dateLine() {
      const rel = this.relativeDate(this.session.updated_at || this.session.created_at)
      const events = this.session.groupCount || 0
      return `${rel} · ${events} ${events === 1 ? 'event' : 'events'}`
    }
  },
  methods: {
    formatNum(n) {
      const v = n || 0
      return v > 999 ? v.toLocaleString() : String(v)
    },
    relativeDate(ts) {
      if (!ts) return '—'
      const hours = (Date.now() - ts) / 3600000
      if (hours < 24) return 'Today'
      if (hours < 48) return 'Yesterday'
      const days = Math.floor(hours / 24)
      if (days < 7) return `${days} days ago`
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    segmentState(stage) {
      if (this.session[stage.doneKey]) return 'done'
      if (this.session.currentStage === stage.id) return 'active'
      return 'pending'
    },
    startEdit() {
      this.editing = true
      this.editingName = this.session.name
      this.$nextTick(() => {
        this.$refs.editInput?.focus()
        this.$refs.editInput?.select()
      })
    },
    cancelEdit() {
      this.editing = false
    },
    async saveName() {
      if (!this.editing) return
      this.editing = false
      const name = this.editingName.trim()
      if (!name || name === this.session.name) return
      await window.api.invoke('session:update', this.session.id, { name })
      this.session.name = name
    }
  }
}
</script>

<style scoped>
.session-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.session-card:hover {
  border-color: rgba(201, 168, 76, 0.2);
}

.session-card.is-active {
  border-color: rgba(201, 168, 76, 0.35);
}

.sc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.sc-name-col {
  flex: 1;
  min-width: 0;
}

.sc-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 2px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-name-input {
  width: 100%;
  font-size: 11px;
  font-weight: 500;
  background: var(--color-surface-2);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-text);
  padding: 1px 5px;
  outline: none;
  font-family: inherit;
}

.sc-status-badge {
  font-size: 8px;
  border-radius: 8px;
  padding: 2px 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-active {
  background: rgba(201, 168, 76, 0.12);
  color: var(--color-accent);
}

.status-complete {
  background: rgba(74, 154, 90, 0.12);
  color: var(--color-keep-hover);
}

.status-archived {
  background: transparent;
  color: var(--color-text-3);
}

.sc-date-line {
  font-size: 9px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.sc-mini-pipeline {
  display: flex;
  gap: 2px;
  margin: 8px 0;
}

.sc-mini-seg {
  height: 2px;
  flex: 1;
  border-radius: 1px;
  background: var(--color-surface-3);
}

.sc-mini-seg.done {
  background: var(--color-keep-hover);
}

.sc-mini-seg.active {
  background: var(--color-accent);
}

.sc-stats-row {
  display: flex;
  gap: 8px;
  font-size: 9px;
  color: var(--color-text-3);
  margin-bottom: 8px;
}

.sc-stat-num {
  color: var(--color-text-2);
}

.sc-stat-sep {
  opacity: 0.4;
}

.sc-footer {
  display: flex;
  gap: 5px;
}

.sc-btn {
  font-size: 9px;
  padding: 3px 9px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.sc-btn-resume {
  background: var(--color-accent-dim);
  border: 1px solid rgba(201, 168, 76, 0.3);
  color: var(--color-accent);
}

.sc-btn-view,
.sc-btn-archive {
  background: transparent;
  border: 1px solid var(--color-border-2);
  color: var(--color-text-2);
}
</style>
