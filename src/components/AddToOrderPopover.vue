<template>
  <div class="aop-backdrop" v-if="visible" @click.self="$emit('close')">
    <div class="aop" :style="anchorStyle">

      <div class="aop-header">
        Add to print order
        <button class="aop-close" @click="$emit('close')">&times;</button>
      </div>

      <!-- Order selection -->
      <div class="aop-section">
        <div class="aop-label">Order</div>
        <div v-if="loading" class="aop-loading">Loading orders&hellip;</div>
        <div
          v-for="order in orders"
          :key="order.id"
          class="aop-order-option"
          :class="{ selected: selectedOrderId === order.id }"
          @click="selectedOrderId = order.id"
        >
          {{ order.name }}
          <span class="aop-order-count">{{ order.item_count || 0 }} items</span>
        </div>
        <div class="aop-new-order" v-if="!creating" @click="creating = true">
          + New order
        </div>
        <div v-if="creating" class="aop-new-order-form">
          <input
            v-model="newOrderName"
            placeholder="Order name…"
            @keydown.enter="createAndSelect"
            @keydown.escape="creating = false"
            ref="newOrderInput"
          />
          <button class="aop-create-btn" @click="createAndSelect">Create</button>
        </div>
      </div>

      <!-- Size selection -->
      <div class="aop-section" v-if="selectedOrderId">
        <div class="aop-label">Print size</div>
        <PrintSizeSelector
          :fileId="fileId"
          v-model="selectedSize"
          :showMatching="true"
          @crop-needed="onCropNeeded"
        />
      </div>

      <!-- Quantity -->
      <div class="aop-section aop-qty" v-if="selectedOrderId && selectedSize">
        <div class="aop-label">Quantity</div>
        <input type="number" v-model.number="quantity" min="1" max="99" class="aop-qty-input" />
      </div>

      <!-- Crop warning -->
      <div class="aop-crop-warn" v-if="selectedSize && cropNeeded">
        &#9888; This size requires cropping. You can crop now or later in the print order.
      </div>

      <!-- Compatibility summary -->
      <PrintCompatibilityBadge
        v-if="selectedSize && compatibility"
        :result="compatibility"
      />

      <!-- Add button -->
      <button
        class="aop-add"
        :disabled="!selectedOrderId || !selectedSize"
        @click="addToOrder"
      >
        Add to order
      </button>

    </div>
  </div>
</template>

<script>
import PrintSizeSelector from './PrintSizeSelector.vue'
import PrintCompatibilityBadge from './PrintCompatibilityBadge.vue'

export default {
  name: 'AddToOrderPopover',
  components: { PrintSizeSelector, PrintCompatibilityBadge },
  inject: ['toast', 'session'],
  props: {
    fileId: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    // Optional viewport anchor point (e.g. a right-click position). When
    // omitted the popover centers itself, matching how the Sorter and
    // Editor toolbar buttons trigger it (no click coordinate available).
    anchor: { type: Object, default: null }
  },
  emits: ['close', 'added'],
  data() {
    return {
      orders: [],
      selectedOrderId: null,
      selectedSize: null,
      quantity: 1,
      loading: false,
      creating: false,
      newOrderName: '',
      cropNeeded: false,
      compatibility: null
    }
  },
  computed: {
    anchorStyle() {
      if (!this.anchor) return {}
      return { position: 'fixed', top: this.anchor.y + 'px', left: this.anchor.x + 'px' }
    }
  },
  watch: {
    async selectedSize(size) {
      this.compatibility = null
      if (!size) return
      const result = await window.api.invoke('print:checkCompatibility', {
        fileId: this.fileId,
        printWidth: size.width,
        printHeight: size.height
      })
      if (result && !result.error) this.compatibility = result
    }
  },
  async created() {
    await this.loadOrders()
  },
  methods: {
    async loadOrders() {
      this.loading = true
      const result = await window.api.invoke('printOrder:list', {
        filter: 'active',
        sessionId: this.session?.id || undefined
      })
      this.orders = Array.isArray(result) ? result : []
      this.loading = false
    },
    onCropNeeded() {
      this.cropNeeded = true
    },
    async createAndSelect() {
      if (!this.newOrderName.trim()) return
      const result = await window.api.invoke('printOrder:create', {
        sessionId: this.session?.id || null,
        name: this.newOrderName.trim()
      })
      if (result.error) {
        this.toast('Could not create order: ' + result.error, 'error')
        return
      }
      this.selectedOrderId = result.id
      await this.loadOrders()
      this.creating = false
      this.newOrderName = ''
    },
    async addToOrder() {
      const result = await window.api.invoke('printOrder:addItem', {
        orderId: this.selectedOrderId,
        fileId: this.fileId,
        printWidth: this.selectedSize.width,
        printHeight: this.selectedSize.height,
        quantity: this.quantity
      })
      if (result.error) {
        this.toast('Could not add to order: ' + result.error, 'error')
        return
      }
      this.$emit('added', result)
      this.$emit('close')
      this.toast('Added to print order', 'success')
    }
  }
}
</script>

<style scoped>
.aop-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
}

.aop {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  padding: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--color-text);
}

.aop-close {
  background: none;
  border: none;
  color: var(--color-text-2);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.aop-close:hover { color: var(--color-text); }

.aop-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aop-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.aop-loading {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  padding: 4px 0;
}

.aop-order-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border-left: 3px solid transparent;
  cursor: pointer;
  font-size: var(--text-base);
  color: var(--color-text);
  transition: background var(--dur-base);
}
.aop-order-option:hover { background: var(--color-surface-2); }
.aop-order-option.selected {
  background: var(--color-accent-dim);
  border-left: 3px solid var(--color-accent);
}

.aop-order-count {
  font-size: var(--text-xs);
  color: var(--color-text-3);
}

.aop-new-order {
  padding: 6px 10px;
  font-size: var(--text-sm);
  color: var(--color-accent);
  cursor: pointer;
}
.aop-new-order:hover { text-decoration: underline; }

.aop-new-order-form {
  display: flex;
  gap: 6px;
}
.aop-new-order-form input {
  flex: 1;
  padding: 6px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-family: inherit;
  outline: none;
}
.aop-new-order-form input:focus { border-color: var(--color-accent); }

.aop-create-btn {
  padding: 6px 12px;
  background: var(--color-surface-3);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  cursor: pointer;
}
.aop-create-btn:hover { background: var(--color-surface-2); }

.aop-qty {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.aop-qty-input {
  width: 60px;
  padding: 4px 8px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
}

.aop-crop-warn {
  font-size: var(--text-xs);
  color: var(--color-accent);
  background: var(--color-accent-dim);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  line-height: 1.5;
}

.aop-add {
  padding: 8px 14px;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #1a1a1a;
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: opacity var(--dur-base);
}
.aop-add:hover:not(:disabled) { opacity: 0.85; }
.aop-add:disabled { opacity: 0.4; cursor: default; }
</style>
