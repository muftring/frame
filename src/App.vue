<template>
  <div class="app" :class="'theme-' + settings.theme">
    <nav class="sidebar" @mouseenter="sidebarOpen = true" @mouseleave="sidebarOpen = false">
      <div class="drag-region"></div>
      <div class="nav-items">
        <NavIcon
          v-for="item in navItems"
          :key="item.id"
          :icon="item.icon"
          :label="item.label"
          :active="currentModule === item.id"
          :collapsed="!sidebarOpen"
          @click="selectModule(item.id)"
        />
      </div>
      <NavIcon
        icon="settings"
        label="Settings"
        class="nav-settings-item"
        :active="showSettings"
        :collapsed="!sidebarOpen"
        @click="showSettings = !showSettings"
      />
    </nav>

    <main class="content">
      <!-- Pipeline bar — visible when a session is active and not on the Home screen -->
      <div v-if="activeSession && currentModule !== 'home'" class="pipeline-bar">
        <span class="pipeline-session-name">{{ activeSession.name }}</span>
        <div class="pipeline-steps">
          <template v-for="(stage, i) in pipelineStages" :key="stage.id">
            <span v-if="i > 0" class="step-dot">·</span>
            <button
              class="pipeline-step"
              :class="{
                'step-complete': !!activeSession[stage.completeKey],
                'step-current': activeStage === stage.id
              }"
              @click="navigateToStage(stage)"
            >
              <svg v-if="activeSession[stage.completeKey]" class="step-check" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 6l3 3 5-5" />
              </svg>
              {{ stage.label }}
            </button>
          </template>
        </div>
      </div>

      <!-- Module area -->
      <div class="module-area">
        <HomeModule
          v-if="currentModule === 'home'"
          @session-started="handleSessionStarted"
          @session-resume="handleSessionResume"
          @session-gallery="handleSessionGallery"
          @navigate="handleNavigate"
        />
        <TriageModule v-else-if="currentModule === 'triage'" @navigate="handleNavigate" />
        <SorterModule v-else-if="currentModule === 'sorter'" :initial-folder="moduleData" @navigate="handleNavigate" />
        <GalleryModule v-else-if="currentModule === 'gallery'" :session-state="galleryState" :active-session="activeSession" :initial-source="moduleData" @update-state="galleryState = $event" @navigate="handleNavigate" />
        <EditorModule v-else-if="currentModule === 'editor'" :image-path="moduleData" />
        <ProcessModule v-else-if="currentModule === 'process'" @navigate="handleNavigate" />
        <PublishModule v-else-if="currentModule === 'publish'" />
      </div>
    </main>

    <SettingsPanel v-if="showSettings" :settings="settings" @close="showSettings = false" />

    <SessionComplete
      v-if="showSessionComplete"
      :summary="sessionCompleteData?.summary || {}"
      @view-gallery="handleViewGallery"
      @new-session="handleNewSession"
      @archive="handleArchiveSession"
    />

    <!-- Toast notifications -->
    <div class="toast-container">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="'toast-' + t.type" :style="t.color ? { color: t.color } : null">
          {{ t.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script>
import HomeModule from './modules/Home/HomeModule.vue'
import SessionComplete from './modules/Home/SessionComplete.vue'
import TriageModule from './modules/Triage/TriageModule.vue'
import SorterModule from './modules/Sorter/SorterModule.vue'
import GalleryModule from './modules/Gallery/GalleryModule.vue'
import EditorModule from './modules/Editor/EditorModule.vue'
import ProcessModule from './modules/Process/ProcessModule.vue'
import PublishModule from './modules/Publish/PublishModule.vue'
import SettingsPanel from './modules/Settings/SettingsPanel.vue'
import NavIcon from './components/NavIcon.vue'

const PIPELINE_STAGES = [
  { id: 'triage',  label: 'Triage',  completeKey: 'triageComplete',  module: 'triage' },
  { id: 'sort',    label: 'Sort',    completeKey: 'sortComplete',    module: 'sorter' },
  { id: 'edit',    label: 'Edit',    completeKey: 'editComplete',    module: 'editor' },
  { id: 'process', label: 'Process', completeKey: 'processComplete', module: 'process' },
  { id: 'publish', label: 'Publish', completeKey: 'publishComplete', module: 'publish' },
]

const MODULE_STAGE = {
  triage: 'triage',
  sorter: 'sort',
  editor: 'edit',
  process: 'process',
  publish: 'publish',
}

const STAGE_MODULE = {
  triage: 'triage',
  sort: 'sorter',
  edit: 'editor',
  process: 'process',
  publish: 'publish',
}

export default {
  name: 'App',
  components: {
    HomeModule, TriageModule, SorterModule, GalleryModule,
    EditorModule, ProcessModule, PublishModule, SettingsPanel, SessionComplete,
    NavIcon
  },
  provide() {
    return {
      appSettings: this.settings,
      toast: this.addToast,
      session: this.sessionProxy,
      updatePipeline: this.handlePipelineUpdate
    }
  },
  data() {
    return {
      sidebarOpen: false,
      currentModule: 'home',
      moduleData: null,
      galleryState: null,
      showSettings: false,
      settingsReady: false,
      activeSession: null,
      sessionProxy: { id: null, name: null, currentStage: null, pipelineState: {} },
      showSessionComplete: false,
      sessionCompleteData: null,
      pipelineStages: PIPELINE_STAGES,
      toasts: [],
      settings: {
        darktablePath: null,
        rawtherapeePath: null,
        guidePath: null,
        defaultGapThreshold: 45,
        thumbnailSize: 180,
        theme: 'dark',
        archivaultCliPath: null,
        archivaultTag: '',
        archivaultUploadedBy: '',
        ffmpegPath: null,
        huginPath: null
      },
      navItems: [
        { id: 'home',    label: 'Home',    icon: 'home' },
        { id: 'triage',  label: 'Triage',  icon: 'triage' },
        { id: 'sorter',  label: 'Sorter',  icon: 'sort' },
        { id: 'gallery', label: 'Gallery', icon: 'gallery' },
        { id: 'editor',  label: 'Editor',  icon: 'edit' },
        { id: 'process', label: 'Process', icon: 'process' },
        { id: 'publish', label: 'Publish', icon: 'publish' },
      ]
    }
  },
  computed: {
    activeStage() {
      return MODULE_STAGE[this.currentModule] || null
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
    window.addEventListener('keydown', this.handleGlobalKey)
    this._completeCleanup = window.api.on('session:complete', (data) => {
      this.sessionCompleteData = data
      this.showSessionComplete = true
    })
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleGlobalKey)
    if (this._completeCleanup) this._completeCleanup()
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
    },
    handleSessionStarted(session) {
      this.activeSession = {
        id: session.id,
        name: session.name,
        currentStage: 'triage',
        triageComplete: false,
        sortComplete: false,
        editComplete: false,
        processComplete: false,
        publishComplete: false,
      }
      Object.assign(this.sessionProxy, {
        id: session.id,
        name: session.name,
        currentStage: 'triage',
        pipelineState: {}
      })
      this.currentModule = 'triage'
      this.moduleData = null
      this.showSettings = false
    },
    async handleSessionResume(session) {
      const data = await window.api.invoke('session:get', session.id)
      const pipeline = data?.pipelineState || {}
      this.activeSession = {
        id: session.id,
        name: session.name,
        currentStage: session.currentStage || 'triage',
        triageComplete: !!pipeline.triage_complete,
        sortComplete: !!pipeline.sort_complete,
        editComplete: !!pipeline.edit_complete,
        processComplete: !!pipeline.process_complete,
        publishComplete: !!pipeline.publish_complete,
      }
      Object.assign(this.sessionProxy, {
        id: session.id,
        name: session.name,
        currentStage: session.currentStage || 'triage',
        pipelineState: pipeline
      })
      this.currentModule = STAGE_MODULE[session.currentStage] || 'triage'
      this.moduleData = null
      this.showSettings = false
    },
    async handlePipelineUpdate(stage, complete) {
      if (!this.sessionProxy.id) return
      const sessionId = this.sessionProxy.id
      await window.api.invoke('session:updatePipeline', sessionId, stage, complete ? 1 : 0)
      const camelMap = {
        triage: 'triageComplete', sort: 'sortComplete', edit: 'editComplete',
        process: 'processComplete', publish: 'publishComplete'
      }
      const snakeMap = {
        triage: 'triage_complete', sort: 'sort_complete', edit: 'edit_complete',
        process: 'process_complete', publish: 'publish_complete'
      }
      const camelKey = camelMap[stage]
      if (camelKey && this.activeSession) {
        this.activeSession = { ...this.activeSession, [camelKey]: complete }
      }
      const snakeKey = snakeMap[stage]
      if (snakeKey) {
        this.sessionProxy.pipelineState[snakeKey] = complete ? 1 : 0
      }
    },
    navigateToStage(stage) {
      this.currentModule = stage.module
      this.moduleData = null
      this.showSettings = false
    },
    handleViewGallery() {
      this.showSessionComplete = false
      this.moduleData = { type: 'session-status', sessionId: this.activeSession?.id, status: 'kept' }
      this.currentModule = 'gallery'
    },
    handleNewSession() {
      this.showSessionComplete = false
      this.activeSession = null
      Object.assign(this.sessionProxy, { id: null, name: null, currentStage: null, pipelineState: {} })
      this.sessionCompleteData = null
      this.currentModule = 'home'
      this.moduleData = null
    },
    async handleArchiveSession() {
      if (this.activeSession?.id) {
        await window.api.invoke('session:archive', this.activeSession.id)
      }
      this.showSessionComplete = false
      this.activeSession = null
      Object.assign(this.sessionProxy, { id: null, name: null, currentStage: null, pipelineState: {} })
      this.sessionCompleteData = null
      this.currentModule = 'home'
      this.moduleData = null
    },
    async handleSessionGallery(session) {
      const data = await window.api.invoke('session:get', session.id)
      const pipeline = data?.pipelineState || {}
      this.activeSession = {
        id: session.id, name: session.name, currentStage: pipeline.current_stage || 'publish',
        triageComplete: !!pipeline.triage_complete, sortComplete: !!pipeline.sort_complete,
        editComplete: !!pipeline.edit_complete, processComplete: !!pipeline.process_complete,
        publishComplete: !!pipeline.publish_complete,
      }
      Object.assign(this.sessionProxy, { id: session.id, name: session.name, currentStage: 'publish', pipelineState: pipeline })
      this.moduleData = { type: 'session-status', sessionId: session.id, status: 'kept' }
      this.currentModule = 'gallery'
    },
    addToast(message, type = 'info', color = null) {
      const id = Date.now() + Math.random()
      this.toasts.push({ id, message, type, color })
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id)
      }, 3000)
    },
    handleGlobalKey(e) {
      if (e.metaKey || e.ctrlKey) {
        const moduleKeys = {
          '0': 'home',
          '1': 'triage',
          '2': 'sorter',
          '3': 'gallery',
          '4': 'editor',
          '5': 'process',
          '6': 'publish',
        }
        if (moduleKeys[e.key]) {
          e.preventDefault()
          this.selectModule(moduleKeys[e.key])
          return
        }
        if (e.key === ',') {
          e.preventDefault()
          this.showSettings = !this.showSettings
        }
      }
    }
  }
}
</script>

<style>
/* Sidebar width vars now come from tokens.css (imported in main.js).
   --accent stays app-wide (used by nearly every module's stylesheet). */
:root {
  --accent: var(--color-accent);
}

/* Dark theme (default) */
.theme-dark {
  --bg: #1a1a1a;
  --surface: #242424;
  --surface2: #2e2e2e;
  --surface-hover: #383838;
  --border: rgba(255, 255, 255, 0.09);
  --border-hover: rgba(255, 255, 255, 0.15);
  --text: #f0f0f0;
  --text2: #999;
  --overlay: rgba(0, 0, 0, 0.6);
}

/* Gray theme — neutral surround for color-accurate photo work */
.theme-gray {
  --bg: #808080;
  --surface: #6e6e6e;
  --surface2: #757575;
  --surface-hover: #8a8a8a;
  --border: rgba(0, 0, 0, 0.15);
  --border-hover: rgba(0, 0, 0, 0.25);
  --text: #1a1a1a;
  --text2: #3a3a3a;
  --overlay: rgba(0, 0, 0, 0.4);
}

/* Light theme */
.theme-light {
  --bg: #f0f0f0;
  --surface: #e2e2e2;
  --surface2: #d6d6d6;
  --surface-hover: #c8c8c8;
  --border: rgba(0, 0, 0, 0.1);
  --border-hover: rgba(0, 0, 0, 0.2);
  --text: #1a1a1a;
  --text2: #666;
  --overlay: rgba(0, 0, 0, 0.3);
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
  position: relative;
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

.drag-region {
  height: 40px;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.nav-items {
  display: flex;
  flex-direction: column;
}

.nav-settings-item {
  margin-bottom: 12px;
}

/* ── Content area ─────────────────────────────── */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
  min-width: 0;
}

.module-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ── Pipeline bar ─────────────────────────────── */
.pipeline-bar {
  height: 40px;
  flex-shrink: 0;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 0;
  overflow: hidden;
}

.pipeline-session-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  flex-shrink: 0;
  padding-right: 14px;
  margin-right: 6px;
  border-right: 1px solid var(--border);
}

.pipeline-steps {
  display: flex;
  align-items: center;
}

.pipeline-step {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text2);
  font-size: 12px;
  font-weight: 400;
  font-family: inherit;
  border-radius: 4px;
  white-space: nowrap;
  transition: color 0.15s, background 0.15s;
}

.pipeline-step:hover {
  color: var(--text);
  background: var(--surface2);
}

.pipeline-step.step-complete {
  color: var(--accent);
}

.pipeline-step.step-current {
  color: var(--accent);
  background: var(--color-accent-dim);
  font-weight: 600;
}

.step-dot {
  color: var(--border-hover);
  pointer-events: none;
  padding: 0 1px;
  font-size: 12px;
  user-select: none;
}

.step-check {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

/* ── Toast notifications ──────────────────────── */
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 76px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 13px;
  max-width: 380px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.toast-info {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}

.toast-error {
  background: var(--surface);
  border: 1px solid rgba(239, 83, 80, 0.4);
  color: #ef5350;
}

.toast-success {
  background: var(--surface);
  border: 1px solid rgba(102, 187, 106, 0.4);
  color: #66bb6a;
}

.toast-enter-active {
  transition: all 0.25s ease;
}
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ── Global utilities ─────────────────────────── */
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  height: 100%;
}

.empty-state-full svg {
  width: 48px;
  height: 48px;
  color: var(--text2);
  opacity: 0.3;
}

.empty-state-full .empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.empty-state-full .empty-hint {
  font-size: 13px;
  color: var(--text2);
}

.skeleton {
  background: linear-gradient(90deg, var(--surface2) 25%, #363636 50%, var(--surface2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  to { background-position: -200% 0; }
}
</style>
