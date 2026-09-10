<template>
  <div class="po-panel">

    <!-- List view -->
    <template v-if="!selectedOrderId">
      <div class="po-toolbar">
        <div class="po-filter">
          <button :class="{ active: filter === 'active' }" @click="filter = 'active'">Active</button>
          <button :class="{ active: filter === 'archived' }" @click="filter = 'archived'">Archived</button>
          <button :class="{ active: filter === 'all' }" @click="filter = 'all'">All</button>
        </div>
        <div class="po-new-order" v-if="!creating">
          <button class="btn-primary" @click="startCreate">+ New order</button>
        </div>
        <div v-else class="po-new-order-form">
          <input
            v-model="newOrderName"
            ref="newOrderInput"
            placeholder="Order name…"
            @keydown.enter="createOrder"
            @keydown.escape="creating = false"
          />
          <button class="btn-sm" @click="createOrder">Create</button>
          <button class="btn-sm" @click="creating = false">Cancel</button>
        </div>
      </div>

      <EmptyState
        v-if="!loading && !orders.length"
        icon="publish"
        title="No print orders yet"
        description="Add photos to a print order from the Sorter or Gallery."
      />

      <div class="po-list">
        <div
          v-for="order in orders"
          :key="order.id"
          class="po-card"
          :class="order.status"
          @click="selectedOrderId = order.id"
        >
          <div class="po-card-header">
            <div>
              <div class="po-name">{{ order.name }}</div>
              <div class="po-meta">
                {{ order.session_name || 'No session' }} ·
                {{ order.item_count || 0 }} items ·
                {{ order.total_prints || 0 }} prints
              </div>
            </div>
            <div class="po-status-badge" :class="order.status">
              {{ statusLabel(order.status) }}
            </div>
          </div>
          <div class="po-card-footer">
            <span class="po-lab" v-if="order.lab">{{ order.lab }}</span>
            <span class="po-order-num" v-if="order.order_number">#{{ order.order_number }}</span>
            <span class="po-pending-crops" v-if="order.pending_crops > 0">
              &#9888; {{ order.pending_crops }} crop{{ order.pending_crops > 1 ? 's' : '' }} needed
            </span>
            <span class="po-date">{{ formatDate(order.updated_at) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Detail view -->
    <template v-else-if="orderDetail">
      <div class="po-detail-header">
        <button class="btn-sm" @click="backToList">&larr; Back</button>
        <input
          v-if="editingName"
          ref="nameInput"
          v-model="nameDraft"
          class="po-name-input"
          @blur="saveName"
          @keydown.enter="$event.target.blur()"
          @keydown.escape="editingName = false"
        />
        <h3 v-else class="po-detail-name" title="Click to rename" @click="startEditName">
          {{ orderDetail.name }}
        </h3>
        <select class="po-status-select" :value="orderDetail.status" @change="changeStatus($event.target.value)">
          <option value="preparing">In preparation</option>
          <option value="ready">Ready to order</option>
          <option value="ordered">Ordered</option>
          <option value="delivered">Delivered</option>
        </select>
        <button
          v-if="orderDetail.status === 'delivered'"
          class="btn-sm"
          @click="confirmArchive = true"
        >Archive</button>
      </div>

      <div class="po-meta-row">
        <div class="po-field">
          <label>Lab</label>
          <input class="text-input" v-model="orderDetail.lab" @blur="saveMeta" placeholder="Mpix, Bay Photo, etc." />
        </div>
        <div class="po-field">
          <label>Order #</label>
          <input class="text-input" v-model="orderDetail.order_number" @blur="saveMeta" />
        </div>
        <div class="po-field">
          <label>Total</label>
          <input class="text-input" v-model="orderDetail.order_total" @blur="saveMeta" placeholder="$34.50" />
        </div>
      </div>

      <div class="po-items">
        <div class="po-items-header">
          <span>Photo</span><span>Size</span><span>Qty</span><span>Status</span><span></span>
        </div>
        <div v-for="item in orderDetail.items" :key="item.id" class="po-item-row">
          <div class="po-item-photo">
            <img v-if="item.thumbnail" :src="item.thumbnail" class="po-thumb" />
            <div v-else class="po-thumb-placeholder"></div>
            <span class="po-item-filename" :title="item.filename">{{ item.filename }}</span>
          </div>
          <div class="po-item-size-cell">
            <span class="po-item-size" @click="openSizeEditor(item)">{{ item.print_width }}&times;{{ item.print_height }}</span>
            <div v-if="sizeEditingItemId === item.id" class="po-size-popover">
              <PrintSizeSelector
                :fileId="item.file_id"
                :modelValue="null"
                :showMatching="true"
                @update:modelValue="size => changeItemSize(item, size)"
              />
              <button class="btn-sm" @click="sizeEditingItemId = null">Close</button>
            </div>
          </div>
          <input
            type="number" min="1" max="99" class="po-item-qty"
            :value="item.quantity"
            @change="e => changeItemQty(item, e.target.value)"
          />
          <div class="po-item-status">
            <PrintCompatibilityBadge v-if="item.compatibility" :result="item.compatibility" compact />
            <button
              v-if="itemNeedsCrop(item) && !item.crop_applied"
              class="btn-sm po-crop-btn"
              @click="cropItem(item)"
            >Crop</button>
            <span v-else-if="item.crop_applied" class="po-cropped-badge">&check; Cropped</span>
          </div>
          <button class="po-item-remove" @click="removeItem(item)">&times;</button>
        </div>

        <button class="btn-sm po-add-photos" @click="openPicker">+ Add photos</button>
      </div>

      <div class="po-summary">
        Total items: {{ orderDetail.items.length }} · Total prints: {{ totalPrints }}
        <span v-if="pendingCropsCount" class="po-summary-warn">· Pending crops: {{ pendingCropsCount }}</span>
      </div>

      <button class="btn-sm po-preview-toggle" @click="togglePreview">
        {{ showManifestPreview ? 'Hide' : 'Preview' }} manifest
      </button>
      <div v-if="showManifestPreview" class="po-manifest-preview" v-html="renderedManifestPreview"></div>

      <div class="po-actions" v-if="!preparing && !orderDetail.staged_path">
        <button
          class="btn"
          :disabled="pendingCropsCount > 0"
          :title="pendingCropsCount > 0 ? 'Crop pending items first' : ''"
          @click="confirmPrepare = true"
        >Prepare folder &rarr;</button>
        <div class="po-manifest-dropdown">
          <button class="btn" @click="manifestMenuOpen = !manifestMenuOpen">Export manifest &#9662;</button>
          <div v-if="manifestMenuOpen" class="po-manifest-menu">
            <div class="po-manifest-menu-item" @click="exportManifest('md')">Export as Markdown (.md)</div>
            <div class="po-manifest-menu-item" @click="exportManifest('pdf')">Export as PDF (.pdf)</div>
          </div>
          <div v-if="manifestMenuOpen" class="po-manifest-menu-backdrop" @click="manifestMenuOpen = false"></div>
        </div>
      </div>

      <div class="po-progress" v-else-if="preparing">
        <div class="po-progress-bar">
          <div class="po-progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="po-progress-label">
          Preparing {{ prepareProgress.current }} of {{ prepareProgress.total }} — {{ prepareProgress.filename }}
        </div>
      </div>

      <div class="po-actions po-actions-prepared" v-else>
        <span class="po-prepared-check">&check; Folder prepared</span>
        <button class="btn" @click="openStagedFolder">Open folder &#8599;</button>
        <button
          class="btn"
          :disabled="pendingCropsCount > 0"
          :title="pendingCropsCount > 0 ? 'Crop pending items first' : ''"
          @click="confirmPrepare = true"
        >Re-prepare</button>
        <div class="po-manifest-dropdown">
          <button class="btn" @click="manifestMenuOpen = !manifestMenuOpen">Export manifest &#9662;</button>
          <div v-if="manifestMenuOpen" class="po-manifest-menu">
            <div class="po-manifest-menu-item" @click="exportManifest('md')">Export as Markdown (.md)</div>
            <div class="po-manifest-menu-item" @click="exportManifest('pdf')">Export as PDF (.pdf)</div>
          </div>
          <div v-if="manifestMenuOpen" class="po-manifest-menu-backdrop" @click="manifestMenuOpen = false"></div>
        </div>
        <div class="po-staged-path">{{ orderDetail.staged_path }}</div>
      </div>

      <div v-if="manifestExportPath" class="po-manifest-result">
        Saved to {{ manifestExportPath }} · <a @click="openExportedManifest">Open &#8599;</a>
      </div>

      <div class="po-notes">
        <MarkdownEditor
          v-model="orderDetail.notes"
          placeholder="Add order notes… e.g. Aug 28 — Placed order at Mpix, #MP-28847, $34.50"
          minHeight="80px"
          :saveStatus="notesSaveStatus"
          @save="onNotesSave"
        />
      </div>
    </template>

    <!-- Add photos modal -->
    <div v-if="pickerOpen" class="modal-overlay" @click.self="pickerOpen = false">
      <div class="modal po-picker-modal">
        <h4>Add photos from session</h4>
        <div v-if="!availableFiles.length" class="po-picker-empty">No kept files available.</div>
        <div class="po-picker-list">
          <div
            v-for="f in availableFiles"
            :key="f.id"
            class="po-picker-item"
            :class="{ selected: selectedToAdd.includes(f.id) }"
            @click="toggleSelect(f.id)"
          >
            {{ f.filename }}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="pickerOpen = false">Cancel</button>
          <button class="btn btn-primary" :disabled="!selectedToAdd.length" @click="confirmAddPhotos">
            Add {{ selectedToAdd.length || '' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Prepare folder confirmation -->
    <div v-if="confirmPrepare" class="modal-overlay" @click.self="confirmPrepare = false">
      <div class="modal">
        <h4>Prepare print folder?</h4>
        <p>
          This will copy {{ orderDetail.items.length }} file{{ orderDetail.items.length === 1 ? '' : 's' }} to:<br>
          <code>~/Pictures/Frame Print Orders/{{ orderDetail.name }}/</code><br><br>
          Files will be exported as high-quality JPEGs. Existing files in this folder will be overwritten.
        </p>
        <div class="modal-actions">
          <button class="btn" @click="confirmPrepare = false">Cancel</button>
          <button class="btn btn-primary" @click="prepareFolder">Prepare folder</button>
        </div>
      </div>
    </div>

    <!-- Archive confirmation -->
    <div v-if="confirmArchive" class="modal-overlay" @click.self="confirmArchive = false">
      <div class="modal">
        <h4>Archive this order?</h4>
        <p>It will be moved to your order history.</p>
        <div class="modal-actions">
          <button class="btn" @click="confirmArchive = false">Cancel</button>
          <button class="btn btn-primary" @click="archiveOrder">Archive</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { marked } from 'marked'
import EmptyState from '../../components/EmptyState.vue'
import MarkdownEditor from '../../components/MarkdownEditor.vue'
import PrintSizeSelector from '../../components/PrintSizeSelector.vue'
import PrintCompatibilityBadge from '../../components/PrintCompatibilityBadge.vue'

const STATUS_LABELS = {
  preparing: 'In preparation',
  ready: 'Ready to order',
  ordered: 'Ordered',
  delivered: 'Delivered',
  archived: 'Archived'
}

export default {
  name: 'PrintOrderPanel',
  components: { EmptyState, MarkdownEditor, PrintSizeSelector, PrintCompatibilityBadge },
  inject: ['toast', 'session'],
  emits: ['navigate'],
  data() {
    return {
      orders: [],
      filter: 'active',
      loading: false,
      creating: false,
      newOrderName: '',
      selectedOrderId: null,
      orderDetail: null,
      editingName: false,
      nameDraft: '',
      notesSaveStatus: '',
      sizeEditingItemId: null,
      pickerOpen: false,
      availableFiles: [],
      selectedToAdd: [],
      confirmArchive: false,
      confirmPrepare: false,
      preparing: false,
      prepareProgress: { current: 0, total: 0, filename: '' },
      manifestMenuOpen: false,
      manifestExportPath: null,
      showManifestPreview: false,
      manifestPreviewMd: ''
    }
  },
  computed: {
    totalPrints() {
      if (!this.orderDetail) return 0
      return this.orderDetail.items.reduce((sum, i) => sum + (i.quantity || 0), 0)
    },
    pendingCropsCount() {
      if (!this.orderDetail) return 0
      return this.orderDetail.items.filter(i => this.itemNeedsCrop(i) && !i.crop_applied).length
    },
    progressPercent() {
      if (!this.prepareProgress.total) return 0
      return Math.round((this.prepareProgress.current / this.prepareProgress.total) * 100)
    },
    renderedManifestPreview() {
      return this.manifestPreviewMd ? marked(this.manifestPreviewMd) : ''
    }
  },
  watch: {
    filter() {
      this.loadOrders()
    },
    async selectedOrderId(id) {
      this.manifestExportPath = null
      this.showManifestPreview = false
      this.manifestPreviewMd = ''
      if (id) await this.loadOrderDetail()
    }
  },
  async created() {
    await this.loadOrders()
    this._prepareProgressCleanup = window.api.on('printOrder:prepareFolderProgress', (data) => {
      if (data.orderId === this.selectedOrderId) this.prepareProgress = data
    })
  },
  beforeUnmount() {
    if (this._prepareProgressCleanup) this._prepareProgressCleanup()
  },
  methods: {
    statusLabel(status) {
      return STATUS_LABELS[status] || status
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr.replace(' ', 'T') + 'Z')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    itemNeedsCrop(item) {
      return item.aspect_ratio_status === 'warn' || item.aspect_ratio_status === 'error'
    },
    async loadOrders() {
      this.loading = true
      const result = await window.api.invoke('printOrder:list', { filter: this.filter })
      this.orders = Array.isArray(result) ? result : []
      this.loading = false
    },
    startCreate() {
      this.creating = true
      this.newOrderName = ''
      this.$nextTick(() => this.$refs.newOrderInput?.focus())
    },
    async createOrder() {
      const name = this.newOrderName.trim()
      if (!name) return
      const result = await window.api.invoke('printOrder:create', {
        sessionId: this.session?.id || null,
        name
      })
      if (result.error) {
        this.toast('Could not create order: ' + result.error, 'error')
        return
      }
      this.creating = false
      await this.loadOrders()
      this.selectedOrderId = result.id
    },
    backToList() {
      this.selectedOrderId = null
      this.orderDetail = null
      this.loadOrders()
    },
    async loadOrderDetail() {
      const result = await window.api.invoke('printOrder:get', { orderId: this.selectedOrderId })
      if (result.error) {
        this.toast(result.error, 'error')
        this.selectedOrderId = null
        return
      }
      for (const item of result.items) {
        item.thumbnail = await window.api.invoke('img:thumbnail', item.full_path, { width: 48, height: 32 })
        if (item.pixel_width && item.pixel_height) {
          item.compatibility = await window.api.invoke('print:checkCompatibility', {
            fileId: item.file_id,
            printWidth: item.print_width,
            printHeight: item.print_height
          })
        }
      }
      this.orderDetail = result
    },
    startEditName() {
      this.nameDraft = this.orderDetail.name
      this.editingName = true
      this.$nextTick(() => this.$refs.nameInput?.focus())
    },
    async saveName() {
      this.editingName = false
      const trimmed = this.nameDraft.trim()
      if (!trimmed || trimmed === this.orderDetail.name) return
      await window.api.invoke('printOrder:update', { orderId: this.orderDetail.id, fields: { name: trimmed } })
      this.orderDetail.name = trimmed
    },
    async changeStatus(status) {
      await window.api.invoke('printOrder:update', { orderId: this.orderDetail.id, fields: { status } })
      this.orderDetail.status = status
    },
    async saveMeta() {
      await window.api.invoke('printOrder:update', {
        orderId: this.orderDetail.id,
        fields: {
          lab: this.orderDetail.lab,
          order_number: this.orderDetail.order_number,
          order_total: this.orderDetail.order_total
        }
      })
    },
    openSizeEditor(item) {
      this.sizeEditingItemId = this.sizeEditingItemId === item.id ? null : item.id
    },
    async changeItemSize(item, size) {
      if (!size) return
      await window.api.invoke('printOrder:updateItem', {
        itemId: item.id,
        fields: { print_width: size.width, print_height: size.height }
      })
      this.sizeEditingItemId = null
      await this.loadOrderDetail()
    },
    async changeItemQty(item, value) {
      const qty = Math.max(1, Math.min(99, parseInt(value, 10) || 1))
      await window.api.invoke('printOrder:updateItem', { itemId: item.id, fields: { quantity: qty } })
      item.quantity = qty
    },
    async removeItem(item) {
      await window.api.invoke('printOrder:removeItem', { itemId: item.id })
      await this.loadOrderDetail()
    },
    cropItem(item) {
      window.api.invoke('editor:openWithAspectRatio', item.file_id, item.print_width, item.print_height)
      this.$emit('navigate', 'editor', item.full_path)
    },
    async openPicker() {
      if (!this.session?.id) {
        this.toast('No active session to pick photos from', 'error')
        return
      }
      const files = await window.api.invoke('file:listBySession', this.session.id, { status: 'kept' })
      const alreadyAdded = new Set(this.orderDetail.items.map(i => i.file_id))
      this.availableFiles = (Array.isArray(files) ? files : []).filter(f => !alreadyAdded.has(f.id))
      this.selectedToAdd = []
      this.pickerOpen = true
    },
    toggleSelect(fileId) {
      const idx = this.selectedToAdd.indexOf(fileId)
      if (idx === -1) this.selectedToAdd.push(fileId)
      else this.selectedToAdd.splice(idx, 1)
    },
    async confirmAddPhotos() {
      for (const fileId of this.selectedToAdd) {
        const sizes = await window.api.invoke('print:getSizesForPhoto', { fileId })
        const best = (sizes?.matching && sizes.matching[0]) || (sizes?.allSizes && sizes.allSizes[0])
        if (!best) continue
        await window.api.invoke('printOrder:addItem', {
          orderId: this.orderDetail.id,
          fileId,
          printWidth: best.width,
          printHeight: best.height,
          quantity: 1
        })
      }
      this.pickerOpen = false
      await this.loadOrderDetail()
      this.toast(`Added ${this.selectedToAdd.length} photo${this.selectedToAdd.length === 1 ? '' : 's'} — check sizes`, 'success')
    },
    onNotesSave(content) {
      clearTimeout(this._notesTimer)
      this.notesSaveStatus = 'saving'
      this._notesTimer = setTimeout(async () => {
        await window.api.invoke('printOrder:update', { orderId: this.orderDetail.id, fields: { notes: content } })
        this.notesSaveStatus = 'saved'
        setTimeout(() => { this.notesSaveStatus = '' }, 2000)
      }, 800)
    },
    async archiveOrder() {
      await window.api.invoke('printOrder:archive', { orderId: this.orderDetail.id })
      this.confirmArchive = false
      this.backToList()
    },
    async prepareFolder() {
      this.confirmPrepare = false
      this.preparing = true
      this.prepareProgress = { current: 0, total: this.orderDetail.items.length, filename: '' }

      const result = await window.api.invoke('printOrder:prepareFolder', { orderId: this.orderDetail.id })
      this.preparing = false

      if (result.success) {
        this.toast(`${result.successCount} files prepared in ~/Pictures/Frame Print Orders/${this.orderDetail.name}/`, 'success', null, 0)
      } else {
        this.toast(`Prepared ${result.successCount} files, ${result.errorCount} failed`, 'warn', null, 0)
      }
      await this.loadOrderDetail()
      await this.loadOrders()
    },
    async openStagedFolder() {
      await window.api.invoke('printOrder:revealFolder', { orderId: this.orderDetail.id })
    },
    async togglePreview() {
      this.showManifestPreview = !this.showManifestPreview
      if (this.showManifestPreview && !this.manifestPreviewMd) {
        const result = await window.api.invoke('printOrder:previewManifest', { orderId: this.orderDetail.id })
        this.manifestPreviewMd = result.markdown || ''
      }
    },
    async exportManifest(format) {
      this.manifestMenuOpen = false
      const ext = format === 'pdf' ? 'pdf' : 'md'
      const defaultName = this.orderDetail.name
        .replace(/[/\\:*?"<>|]/g, '-')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-') + '.' + ext

      const { canceled, filePath } = await window.api.invoke('dialog:showSaveDialog', {
        defaultPath: defaultName,
        filters: format === 'pdf' ? [{ name: 'PDF', extensions: ['pdf'] }] : [{ name: 'Markdown', extensions: ['md'] }],
        title: 'Export print order manifest'
      })
      if (canceled || !filePath) return

      const result = await window.api.invoke('printOrder:exportManifest', {
        orderId: this.orderDetail.id, format, outputPath: filePath
      })
      if (result.success) {
        this.manifestExportPath = result.outputPath
        this.toast('Manifest exported', 'success', null, 0)
      } else {
        this.toast('Export failed — ' + result.error, 'error')
      }
    },
    async openExportedManifest() {
      if (this.manifestExportPath) await window.api.invoke('tools:revealInFinder', this.manifestExportPath)
    }
  }
}
</script>

<style scoped>
.po-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.po-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.po-filter {
  display: flex;
  gap: 4px;
}
.po-filter button {
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-2);
  font-size: var(--text-sm);
  cursor: pointer;
}
.po-filter button.active {
  background: var(--color-accent-dim);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.po-new-order { margin-left: auto; }
.po-new-order-form {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.po-new-order-form input {
  padding: 6px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-family: inherit;
}

.btn-primary {
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #1a1a1a;
  font-size: var(--text-sm);
  font-weight: 600;
  padding: 7px 16px;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: default; }

.btn-sm {
  padding: 5px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-2);
  font-size: var(--text-xs);
  cursor: pointer;
}
.btn-sm:hover { background: var(--color-surface-3); }

.btn {
  padding: 8px 16px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--color-surface-3); }
.btn:disabled { opacity: 0.4; cursor: default; }

.po-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.po-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color var(--dur-base);
}
.po-card:hover { border-color: var(--color-border-2); }

.po-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.po-name {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--color-text);
}

.po-meta {
  font-size: var(--text-xs);
  color: var(--color-text-2);
  margin-top: 2px;
}

.po-status-badge {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  color: var(--color-text-2);
  background: var(--color-surface-3);
}
.po-status-badge.ready { background: var(--color-accent-dim); color: var(--color-accent); }
.po-status-badge.ordered { background: rgba(74,154,90,0.12); color: var(--color-keep-hover); }
.po-status-badge.delivered { background: rgba(74,154,90,0.2); color: var(--color-keep-hover); }
.po-status-badge.archived { background: transparent; color: var(--color-text-3); }

.po-card-footer {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  font-size: var(--text-xs);
  color: var(--color-text-3);
}
.po-pending-crops { color: var(--color-accent); }
.po-date { margin-left: auto; }

.po-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.po-detail-name {
  cursor: pointer;
  font-size: var(--text-lg);
}
.po-name-input {
  font-size: var(--text-lg);
  background: var(--color-surface-2);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  padding: 2px 6px;
  font-family: inherit;
}

.po-status-select {
  margin-left: auto;
  padding: 5px 8px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
}

.po-meta-row {
  display: flex;
  gap: 16px;
}
.po-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.po-field label {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}
.text-input {
  padding: 6px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-base);
  font-family: inherit;
}
.text-input::placeholder {
  color: var(--color-text-3);
  opacity: 0.8;
}

.po-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.po-items-header {
  display: grid;
  grid-template-columns: 1fr 80px 50px 160px 24px;
  gap: 8px;
  font-size: var(--text-xs);
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 4px;
}
.po-item-row {
  display: grid;
  grid-template-columns: 1fr 80px 50px 160px 24px;
  gap: 8px;
  align-items: center;
  padding: 6px 4px;
  border-bottom: 1px solid var(--color-border);
  position: relative;
}
.po-item-photo {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.po-thumb, .po-thumb-placeholder {
  width: 48px;
  height: 32px;
  object-fit: cover;
  border-radius: 3px;
  background: var(--color-surface-3);
  flex-shrink: 0;
}
.po-item-filename {
  font-size: var(--text-sm);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.po-item-size-cell { position: relative; }
.po-item-size {
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
}
.po-item-size:hover { color: var(--color-accent); }
.po-size-popover {
  position: absolute;
  top: 24px;
  left: 0;
  z-index: var(--z-panel);
  background: var(--color-surface);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  padding: 10px;
  width: 240px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.po-item-qty {
  width: 44px;
  padding: 4px 6px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
}
.po-item-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.po-crop-btn { white-space: nowrap; }
.po-cropped-badge {
  font-size: var(--text-xs);
  color: var(--color-keep-hover);
}
.po-item-remove {
  background: none;
  border: none;
  color: var(--color-text-3);
  font-size: 16px;
  cursor: pointer;
}
.po-item-remove:hover { color: var(--color-delete-hover); }

.po-add-photos {
  align-self: flex-start;
  margin-top: 8px;
}

.po-summary {
  font-size: var(--text-sm);
  color: var(--color-text-2);
}
.po-summary-warn { color: var(--color-accent); }

.po-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.po-actions-prepared { position: relative; }
.po-prepared-check {
  color: var(--color-keep-hover);
  font-size: var(--text-sm);
}
.po-staged-path {
  flex-basis: 100%;
  font-size: var(--text-xs);
  color: var(--color-text-3);
}

.po-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.po-progress-bar {
  height: 3px;
  background: var(--color-surface-3);
  border-radius: 2px;
  overflow: hidden;
}
.po-progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.15s ease;
}
.po-progress-label {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}

.po-manifest-dropdown {
  position: relative;
}
.po-manifest-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: var(--z-panel);
  background: var(--color-surface);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  min-width: 190px;
  overflow: hidden;
}
.po-manifest-menu-item {
  padding: 8px 12px;
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
}
.po-manifest-menu-item:hover {
  background: var(--color-surface-2);
}
.po-manifest-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-panel) - 1);
}

.po-manifest-result {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}
.po-manifest-result a {
  color: var(--color-accent);
  cursor: pointer;
}
.po-manifest-result a:hover {
  text-decoration: underline;
}

.po-preview-toggle {
  align-self: flex-start;
}

.po-manifest-preview {
  max-height: 400px;
  overflow-y: auto;
  padding: 12px 14px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.6;
}
.po-manifest-preview :deep(h1),
.po-manifest-preview :deep(h2) {
  margin: 10px 0 6px;
  font-weight: 500;
}
.po-manifest-preview :deep(h1) { font-size: var(--text-lg); }
.po-manifest-preview :deep(h2) { font-size: var(--text-md); }
.po-manifest-preview :deep(p) { margin-bottom: 6px; }
.po-manifest-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 10px 0;
}
.po-manifest-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
  font-size: var(--text-xs);
}
.po-manifest-preview :deep(th),
.po-manifest-preview :deep(td) {
  border: 1px solid var(--color-border-2);
  padding: 4px 8px;
  text-align: left;
}
.po-manifest-preview :deep(em) {
  color: var(--color-text-3);
}

.po-notes {
  margin-top: 4px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}
.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  padding: 20px;
  min-width: 320px;
  max-width: 480px;
}
.modal h4 {
  font-size: var(--text-md);
  margin-bottom: 8px;
}
.modal p {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  margin-bottom: 16px;
  line-height: 1.6;
}
.modal p code {
  font-size: var(--text-xs);
  background: var(--color-surface-3);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.po-picker-modal { width: 400px; }
.po-picker-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.po-picker-item {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-text);
}
.po-picker-item:hover { background: var(--color-surface-2); }
.po-picker-item.selected {
  background: var(--color-accent-dim);
  color: var(--color-accent);
}
.po-picker-empty {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  padding: 12px 0;
}
</style>
