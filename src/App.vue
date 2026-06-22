<template>
  <div class="app">
    <nav class="sidebar" @mouseenter="sidebarOpen = true" @mouseleave="sidebarOpen = false">
      <div class="nav-items">
        <div
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: currentModule === item.id }"
          @click="selectModule(item.id)"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="item.icon === 'triage'">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              <path d="M12 11l3 3m0 0l-3 3m3-3H9" />
            </template>
            <template v-if="item.icon === 'sorter'">
              <path d="M4 8h16M4 16h16" />
              <circle cx="9" cy="8" r="2" fill="currentColor" />
              <circle cx="15" cy="16" r="2" fill="currentColor" />
            </template>
            <template v-if="item.icon === 'gallery'">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </template>
            <template v-if="item.icon === 'editor'">
              <path d="M6 2v4M18 18v4M2 6h4M18 18h4" />
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </template>
            <template v-if="item.icon === 'process'">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 12l3 2-3 2M13 16h4" />
            </template>
          </svg>
          <transition name="fade">
            <span v-show="sidebarOpen" class="nav-label">{{ item.label }}</span>
          </transition>
        </div>
      </div>
      <div class="nav-item settings" :class="{ active: showSettings }" @click="showSettings = !showSettings">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <transition name="fade">
          <span v-show="sidebarOpen" class="nav-label">Settings</span>
        </transition>
      </div>
    </nav>
    <main class="content">
      <TriageModule v-if="currentModule === 'triage'" @navigate="handleNavigate" />
      <SorterModule v-else-if="currentModule === 'sorter'" :initial-folder="moduleData" @navigate="handleNavigate" />
      <GalleryModule v-else-if="currentModule === 'gallery'" :session-state="galleryState" @update-state="galleryState = $event" />
      <EditorModule v-else-if="currentModule === 'editor'" :image-path="moduleData" />
      <ProcessModule v-else-if="currentModule === 'process'" />
      <div v-else class="module-placeholder">
        <span class="module-name">{{ activeLabel }}</span>
      </div>
    </main>
    <SettingsPanel v-if="showSettings" :settings="settings" @close="showSettings = false" />
  </div>
</template>

<script>
import TriageModule from './modules/Triage/TriageModule.vue'
import SorterModule from './modules/Sorter/SorterModule.vue'
import GalleryModule from './modules/Gallery/GalleryModule.vue'
import EditorModule from './modules/Editor/EditorModule.vue'
import ProcessModule from './modules/Process/ProcessModule.vue'
import SettingsPanel from './modules/Settings/SettingsPanel.vue'

export default {
  name: 'App',
  components: { TriageModule, SorterModule, GalleryModule, EditorModule, ProcessModule, SettingsPanel },
  provide() {
    return {
      appSettings: this.settings
    }
  },
  data() {
    return {
      sidebarOpen: false,
      currentModule: 'triage',
      moduleData: null,
      galleryState: null,
      showSettings: false,
      settingsReady: false,
      settings: {
        darktablePath: null,
        rawtherapeePath: null,
        guidePath: null,
        defaultGapThreshold: 45,
        thumbnailSize: 180
      },
      navItems: [
        { id: 'triage', label: 'Triage', icon: 'triage' },
        { id: 'sorter', label: 'Sorter', icon: 'sorter' },
        { id: 'gallery', label: 'Gallery', icon: 'gallery' },
        { id: 'editor', label: 'Editor', icon: 'editor' },
        { id: 'process', label: 'Process', icon: 'process' }
      ]
    }
  },
  computed: {
    activeLabel() {
      const item = this.navItems.find(i => i.id === this.currentModule)
      return item ? item.label : ''
    }
  },
  watch: {
    settings: {
      deep: true,
      handler() {
        if (this.settingsReady) {
          window.api.invoke('store:set', 'frameSettings', { ...this.settings })
        }
      }
    }
  },
  async mounted() {
    const saved = await window.api.invoke('store:get', 'frameSettings')
    if (saved) Object.assign(this.settings, saved)
    this.settingsReady = true
  },
  methods: {
    selectModule(id) {
      this.currentModule = id
      this.moduleData = null
      this.showSettings = false
    },
    handleNavigate(moduleId, data) {
      this.currentModule = moduleId
      this.moduleData = data
      this.showSettings = false
    }
  }
}
</script>

<style>
:root {
  --bg: #1a1a1a;
  --surface: #242424;
  --surface2: #2e2e2e;
  --border: rgba(255, 255, 255, 0.09);
  --text: #f0f0f0;
  --text2: #999;
  --accent: #c9a84c;
  --sidebar-collapsed: 56px;
  --sidebar-expanded: 180px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}

.app {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: var(--sidebar-collapsed);
  min-width: var(--sidebar-collapsed);
  height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: width 0.2s ease, min-width 0.2s ease;
  overflow: hidden;
  user-select: none;
}

.sidebar:hover {
  width: var(--sidebar-expanded);
  min-width: var(--sidebar-expanded);
}

.nav-items {
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
  cursor: pointer;
  color: #888;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.nav-item:hover {
  color: var(--text);
  background: var(--surface2);
}

.nav-item.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: rgba(201, 168, 76, 0.08);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-label {
  margin-left: 14px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.settings {
  margin-bottom: 12px;
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.module-placeholder {
  text-align: center;
}

.module-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent);
}
</style>
