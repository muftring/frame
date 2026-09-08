<template>
  <div class="pcb" :class="result.overallStatus">

    <!-- Resolution row -->
    <div class="pcb-row">
      <span class="pcb-icon">{{ resIcon }}</span>
      <span class="pcb-label" v-if="!compact">{{ result.resolution.message }}</span>
    </div>

    <!-- Aspect ratio row -->
    <div class="pcb-row" v-if="result.aspectRatio.status !== 'ok'">
      <span class="pcb-icon">{{ arIcon }}</span>
      <span class="pcb-label" v-if="!compact">{{ result.aspectRatio.message }}</span>
      <span class="pcb-detail" v-if="!compact && result.aspectRatio.cropDescription">
        ({{ result.aspectRatio.cropDescription }} trimmed)
      </span>
    </div>

    <!-- Perfect fit -->
    <div class="pcb-row" v-if="result.aspectRatio.status === 'ok' && result.resolution.status === 'ok'">
      <span class="pcb-icon">&check;</span>
      <span class="pcb-label" v-if="!compact">Perfect fit</span>
    </div>

  </div>
</template>

<script>
export default {
  name: 'PrintCompatibilityBadge',
  props: {
    result: { type: Object, required: true },
    compact: { type: Boolean, default: false }
  },
  computed: {
    resIcon() {
      return { ok: '✓', warn: '⚠', error: '✕' }[this.result.resolution.status] || ''
    },
    arIcon() {
      return { ok: '✓', minor: '↔', warn: '⚠', error: '✕' }[this.result.aspectRatio.status] || ''
    }
  }
}
</script>

<style scoped>
.pcb {
  font-size: var(--text-xs);
  line-height: 1.5;
}

.pcb-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pcb-icon {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.pcb-label {
  color: var(--color-text-2);
}

.pcb-detail {
  color: var(--color-text-3);
  font-style: italic;
}

.pcb.ok .pcb-icon {
  color: var(--color-keep-hover);
}
.pcb.minor .pcb-icon {
  color: var(--color-text-2);
}
.pcb.warn .pcb-icon {
  color: var(--color-accent);
}
.pcb.error .pcb-icon {
  color: var(--color-delete-hover);
}
</style>
