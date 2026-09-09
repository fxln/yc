<template>
  <el-dialog
    v-model="visible"
    title="连接失败"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="conn-error-dialog"
    align-center
  >
    <div class="error-body">
      <div class="error-icon">⚠️</div>
      <div class="error-title">无法连接到 {{ hostName }}</div>
      <div class="error-desc">{{ message }}</div>
      <div class="error-meta">
        <span>协议：{{ protocol?.toUpperCase() || 'SSH' }}</span>
        <span>已自动重试：{{ attempts }}/3</span>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="onCancel">取消连接</el-button>
        <el-button type="primary" :loading="reconnecting" @click="onContinue">
          继续连接
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  hostName: { type: String, default: '' },
  protocol: { type: String, default: 'ssh' },
  message: { type: String, default: '连接已断开' },
  attempts: { type: Number, default: 0 }
});
const emit = defineEmits(['update:modelValue', 'cancel', 'continue']);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});
const reconnecting = ref(false);

watch(() => props.modelValue, (v) => {
  if (v) reconnecting.value = false;
});

function onCancel() {
  visible.value = false;
  emit('cancel');
}
async function onContinue() {
  reconnecting.value = true;
  emit('continue');
}
</script>

<script>
import { computed, watch, ref } from 'vue';
export default { name: 'ConnectionErrorDialog' };
</script>

<style lang="scss" scoped>
.conn-error-dialog {
  :deep(.el-dialog__header) {
    border-bottom: 1px solid var(--ops-border-soft);
    padding: 16px 20px;
    .el-dialog__title { color: var(--accent-pink); font-weight: 700; }
  }
  :deep(.el-dialog__body) { padding: 24px 20px; }
  :deep(.el-dialog__footer) {
    border-top: 1px solid var(--ops-border-soft);
    padding: 14px 20px;
  }
}
.error-body {
  text-align: center;
  .error-icon { font-size: 42px; margin-bottom: 10px; }
  .error-title {
    font-size: 15px; font-weight: 700; color: var(--ops-text);
    margin-bottom: 8px;
  }
  .error-desc {
    font-size: 13px; color: var(--ops-text-2);
    background: var(--ops-bg-3); padding: 10px 12px; border-radius: 6px;
    word-break: break-all; margin-bottom: 12px;
  }
  .error-meta {
    display: flex; justify-content: center; gap: 16px;
    font-size: 12px; color: var(--ops-text-3);
    span {
      background: var(--ops-bg-3); padding: 4px 10px; border-radius: 10px;
      border: 1px solid var(--ops-border);
    }
  }
}
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
</style>
