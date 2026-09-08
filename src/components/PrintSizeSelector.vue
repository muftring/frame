<template>
  <div class="pss">
    <div v-if="loading" class="pss-loading">Checking sizes…</div>

    <template v-else>
      <!-- Good matches section -->
      <div class="pss-group-label" v-if="showMatching && matchingSizes.length">
        Good matches for this photo
      </div>
      <div
        v-for="size in matchingSizes"
        :key="'match-' + size.label"
        class="pss-option good"
        :class="{ selected: isSelected(size) }"
        @click="select(size)"
      >
        <span class="pss-label">{{ size.label }}</span>
        <span class="pss-badge ok">&check; fits</span>
      </div>

      <!-- Other sizes section -->
      <div class="pss-group-label" v-if="matchingSizes.length">
        Other sizes (crop required)
      </div>
      <div
        v-for="size in otherSizes"
        :key="'other-' + size.label"
        class="pss-option"
        :class="{
          selected: isSelected(size),
          warn: size.overallStatus === 'warn',
          error: size.overallStatus === 'error'
        }"
        @click="select(size)"
      >
        <span class="pss-label">{{ size.label }}</span>
        <span class="pss-badge" :class="size.aspectRatio.status">
          {{ size.aspectRatio.cropPercent }}% crop
        </span>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: 'PrintSizeSelector',
  props: {
    fileId: { type: Number, required: true },
    modelValue: { type: Object, default: null },
    showMatching: { type: Boolean, default: true }
  },
  emits: ['update:modelValue', 'crop-needed'],
  data() {
    return {
      sizes: [],
      loading: true
    }
  },
  computed: {
    matchingSizes() {
      return this.sizes.filter(s => s.aspectRatio.status === 'ok' || s.aspectRatio.status === 'minor')
    },
    otherSizes() {
      return this.sizes.filter(s => s.aspectRatio.status !== 'ok' && s.aspectRatio.status !== 'minor')
    }
  },
  async created() {
    this.loading = true
    const result = await window.api.invoke('print:getSizesForPhoto', { fileId: this.fileId })
    this.sizes = (result && !result.error && Array.isArray(result.allSizes)) ? result.allSizes : []
    this.loading = false
  },
  methods: {
    isSelected(size) {
      return this.modelValue && this.modelValue.label === size.label
    },
    select(size) {
      this.$emit('update:modelValue', size)
      if (size.aspectRatio.status === 'warn' || size.aspectRatio.status === 'error') {
        this.$emit('crop-needed', size)
      }
    }
  }
}
</script>

<style scoped>
.pss {
  display: flex;
  flex-direction: column;
}

.pss-loading {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  padding: 8px 0;
}

.pss-group-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 10px 0 4px;
}
.pss-group-label:first-child {
  margin-top: 0;
}

.pss-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background var(--dur-base);
}
.pss-option:hover {
  background: var(--color-surface-2);
}
.pss-option.selected {
  background: var(--color-accent-dim);
  border-left: 3px solid var(--color-accent);
}

.pss-label {
  font-size: var(--text-base);
  color: var(--color-text);
}

.pss-badge {
  font-size: var(--text-xs);
  color: var(--color-text-2);
  white-space: nowrap;
}
.pss-badge.ok {
  color: var(--color-keep-hover);
}
.pss-badge.minor {
  color: var(--color-text-2);
}
.pss-badge.warn {
  color: var(--color-accent);
}
.pss-badge.error {
  color: var(--color-delete-hover);
}
</style>
