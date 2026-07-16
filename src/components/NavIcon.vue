<template>
  <div
    class="nav-icon"
    :class="{ active, collapsed }"
    :title="collapsed ? label : ''"
    @click="$emit('click')"
  >
    <img
      :src="iconSrc"
      :alt="label"
      class="nav-icon__img"
      draggable="false"
    />
    <span v-if="!collapsed" class="nav-icon__label">
      {{ label }}
    </span>
  </div>
</template>

<script>
export default {
  name: 'NavIcon',
  props: {
    icon:      { type: String, required: true },
    label:     { type: String, required: true },
    active:    { type: Boolean, default: false },
    collapsed: { type: Boolean, default: true }
  },
  emits: ['click'],
  computed: {
    iconSrc() {
      return new URL(
        `../assets/icons/${this.icon}.svg`,
        import.meta.url
      ).href
    }
  }
}
</script>

<style scoped>
.nav-icon {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 40px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  position: relative;
  transition: background var(--dur-base);
  user-select: none;
}
.nav-icon:hover {
  background: rgba(255, 255, 255, 0.05);
}
.nav-icon.active {
  background: var(--color-accent-dim);
}
.nav-icon.active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 6px; bottom: 6px;
  width: 3px;
  background: var(--color-accent);
  border-radius: 0 2px 2px 0;
}
.nav-icon__img {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  /* Render black SVG as --color-text-2 gray when inactive */
  filter: brightness(0) invert(0.6);
  transition: filter var(--dur-base);
}
.nav-icon.active .nav-icon__img {
  /* Render as --color-accent gold (#c9a84c) when active.
     Filter calculated for #c9a84c:
     brightness(0) saturate(100%) invert(71%)
     sepia(28%) saturate(800%) hue-rotate(5deg)
     brightness(97%) contrast(95%)
     Verify visually and adjust if needed. */
  filter: brightness(0) saturate(100%) invert(71%)
          sepia(28%) saturate(800%) hue-rotate(5deg)
          brightness(97%) contrast(95%);
}
.nav-icon__label {
  font-size: var(--text-base);
  color: var(--color-text-2);
  white-space: nowrap;
  overflow: hidden;
  transition: color var(--dur-base);
}
.nav-icon.active .nav-icon__label {
  color: var(--color-accent);
  font-weight: 500;
}
</style>
