<template>
  <div class="host-detail">
    <div class="detail-header">
      <h3>{{ host.name }}</h3>
      <span class="status" :class="host.status"><i class="dot" />{{ host.status === 'online' ? '在线' : host.status === 'connecting' ? '连接中' : '离线' }}</span>
    </div>
    <div class="detail-item"><span class="label">IP</span><span>{{ host.ip }}:{{ host.port }}</span></div>
    <div class="detail-item"><span class="label">协议</span><el-tag size="small">{{ host.protocol?.toUpperCase() }}</el-tag></div>
    <div class="detail-item"><span class="label">账号</span><span>{{ host.username || '-' }}</span></div>
    <div class="detail-item" v-if="host.remark"><span class="label">备注</span><span>{{ host.remark }}</span></div>
    <div class="detail-item" v-if="host.tags"><span class="label">标签</span>
      <el-tag v-for="t in safeTags" :key="t" size="small" type="info" style="margin-right:4px">{{ t }}</el-tag>
    </div>

    <div class="action-group">
      <el-button type="primary" size="small" :disabled="host.protocol === 'vnc' && host.status !== 'online'" @click="connect">
        <el-icon><Link /></el-icon> 连接
      </el-button>
      <el-button size="small" @click="$emit('edit', host)" v-if="canEdit">编辑</el-button>
      <el-button size="small" type="danger" @click="$emit('remove', host)" v-if="canEdit">删除</el-button>
    </div>

    <!-- 快捷命令面板 -->
    <div class="quick-cmds">
      <div class="qc-title">快捷命令</div>
      <div class="qc-list">
        <div v-for="cmd in commands" :key="cmd.id" class="qc-item" @click="sendCommand(cmd)" :title="cmd.content">
          {{ cmd.name }}
        </div>
        <div v-if="!commands.length" class="qc-empty">暂无命令</div>
      </div>
      <el-button text size="small" @click="$emit('open-commands')">打开命令仓库 →</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../../stores/user';
import { useTabsStore } from '../../stores/tabs';
import { commandApi } from '../../api';

const props = defineProps({ host: { type: Object, required: true } });
const emit = defineEmits(['edit', 'remove', 'open-commands']);

const userStore = useUserStore();
const tabsStore = useTabsStore();

const commands = ref([]);

const canEdit = computed(() => userStore.isAdmin || userStore.isUser);
const safeTags = computed(() => { try { return JSON.parse(props.host.tags || '[]'); } catch { return []; } });

async function loadCmds() {
  try {
    const res = await commandApi.list({ favorite: '1' });
    commands.value = res.data || [];
  } catch {}
}

function connect() {
  const h = props.host;
  if (h.protocol === 'ssh') {
    tabsStore.openTab({ id: `ssh_${h.id}`, type: 'ssh', hostId: h.id, hostName: h.name, title: h.name });
  } else if (h.protocol === 'vnc') {
    tabsStore.openTab({ id: `vnc_${h.id}`, type: 'vnc', hostId: h.id, hostName: h.name });
  } else if (h.protocol === 'rdp') {
    tabsStore.openTab({ id: `rdp_${h.id}`, type: 'rdp', hostId: h.id, hostName: h.name });
  } else if (h.protocol === 'tcp') {
    tabsStore.openTab({ id: `tcp_${h.id}`, type: 'tcp', hostId: h.id, hostName: h.name });
  }
}

function sendCommand(cmd) {
  if (props.host.protocol !== 'ssh') {
    ElMessage.warning('快捷命令仅支持 SSH 主机');
    return;
  }
  const tab = tabsStore.tabs.find((t) => t.type === 'ssh' && t.hostId === props.host.id);
  if (!tab) {
    tabsStore.openTab({ id: `ssh_${props.host.id}`, type: 'ssh', hostId: props.host.id, hostName: props.host.name });
    ElMessage.info('已打开 SSH 会话，请稍后再发送命令');
    return;
  }
  // 触发组件发送命令（通过事件总线式：设置 tab 的 commandToSend）
  tab.commandToSend = { ...cmd, ts: Date.now() };
  emit('send-command', cmd);
}

onMounted(loadCmds);
</script>

<style lang="scss" scoped>
.host-detail { padding: 16px; }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
  h3 { margin: 0; font-size: 16px; }
  .status { font-size: 12px; display: flex; align-items: center; gap: 4px; &.online { color: var(--ops-success); } &.offline { color: var(--ops-text-secondary); } &.connecting { color: var(--ops-warning); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; } }
}
.detail-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px;
  .label { color: var(--ops-text-secondary); min-width: 48px; } }
.action-group { margin-top: 16px; display: flex; gap: 8px; }
.quick-cmds { margin-top: 20px; border-top: 1px solid var(--ops-border); padding-top: 12px; }
.qc-title { font-size: 12px; color: var(--ops-text-secondary); margin-bottom: 8px; }
.qc-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.qc-item { background: var(--ops-bg-tertiary); border: 1px solid var(--ops-border); padding: 4px 10px; border-radius: 4px;
  font-size: 12px; cursor: pointer; &:hover { border-color: var(--ops-primary); color: var(--ops-primary-hover); } }
.qc-empty { color: var(--ops-text-secondary); font-size: 12px; }
</style>
