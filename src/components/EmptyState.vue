<template>
  <div class="empty-state">
    <img :src="iconSrc" class="empty-icon" :alt="title">
    <h3 class="empty-title">{{ title }}</h3>
    <p class="empty-desc">{{ description }}</p>
    <button v-if="actionLabel"
            class="empty-action"
            @click="$emit('action')">
      {{ actionLabel }}
      <span v-if="actionIcon">{{ actionIcon }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    icon: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    actionLabel: { type: String, default: null },
    actionIcon: { type: String, default: null }
  },
  emits: ['action'],
  computed: {
    iconSrc() {
      return new URL(`../assets/icons/${this.icon}.svg`, import.meta.url).href
    }
  }
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 32px;
  text-align: center;
  min-height: 280px;
}

.empty-icon {
  width: 40px;
  height: 40px;
  opacity: 0.25;
  filter: brightness(0) invert(0.6);
  margin-bottom: 4px;
}

.empty-title {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--color-text-2);
}

.empty-desc {
  font-size: var(--text-sm);
  color: var(--color-text-3);
  max-width: 240px;
  line-height: 1.6;
}

.empty-action {
  margin-top: 6px;
  background: var(--color-accent-dim);
  border: 1px solid rgba(201, 168, 76, 0.3);
  color: var(--color-accent);
  font-size: var(--text-sm);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--dur-base);
  font-family: inherit;
}
.empty-action:hover {
  background: var(--color-accent-mid);
}
</style>
