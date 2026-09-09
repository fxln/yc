<template>
  <div class="rdp-wrapper">
    <div class="rdp-toolbar">
      <span class="host-info">{{ tab.hostName }} (RDP/TCP)</span>
      <div class="tools">
        <el-button size="small" :icon="Refresh" @click="reconnect">重连</el-button>
        <el-tag size="small" :type="statusType">
          <span :class="['status-dot', statusCls]"><i class="dot" />{{ statusText }}</span>
        </el-tag>
      </div>
    </div>
    <div class="rdp-body">
      <el-alert type="info" show-icon :closable="false" title="RDP / 通用 TCP 转发">
        <p>后端已建立 TCP 代理通道（<code>/ws/tcp</code>），浏览器无法原生解析 RDP 协议。</p>
        <p>推荐两种方式：</p>
        <ul>
          <li>在主机详情中下载 <code>.rdp</code> 配置文件，使用本地远程桌面客户端连接</li>
          <li>或使用 Web VNC 协议替代（在目标主机上部署 VNC Server，本系统前端可直接显示桌面）</li>
        </ul>
      </el-alert>
      <div class="tcp-info">
        <div><strong>目标主机</strong>: {{ tab.hostName }}</div>
        <div><strong>代理 WS 路径</strong>: /ws/tcp?hostId={{ tab.hostId }}</div>
        <div><strong>后端 TCP 已就绪</strong>: {{ tcpConnected ? '是' : '否' }}</div>
      </div>
      <div class="connect-actions">
        <el-button type="primary" @click="testConnect">测试连通性</el-button>
        <el-button @click="downloadRdp">下载 .rdp 配置</el-button>
      </div>
    </div>

    <ConnectionErrorDialog
      v-model="errorDialogVisible"
      :host-name="tab.hostName"
      protocol="tcp"
      :message="errorMsg"
      :attempts="reconnectAttempts"
      @cancel="onErrorCancel"
      @continue="onErrorContinue"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { wsUrl } from '../../api';
import ConnectionErrorDialog from '../common/ConnectionErrorDialog.vue';

const props = defineProps({ tab: { type: Object, required: true } });
const emit = defineEmits(['close']);

let ws = null;
const tcpConnected = ref(false);
const errorDialogVisible = ref(false);
const errorMsg = ref('');
let reconnectTimer = null;
let reconnectAttempts = 0;
let stopReconnect = false;

const statusText = computed(() => props.tab.status === 'connected' ? '通道已建立' : props.tab.status === 'connecting' ? '连接中' : '未连接');
const statusType = computed(() => props.tab.status === 'connected' ? 'success' : props.tab.status === 'connecting' ? 'warning' : 'info');
const statusCls = computed(() => props.tab.status === 'connected' ? 'online' : props.tab.status === 'connecting' ? 'connecting' : 'offline');

function connect() {
  if (stopReconnect) return;
  try { ws?.close(); } catch {}
  props.tab.status = 'connecting';
  errorDialogVisible.value = false;

  ws = new WebSocket(`${wsUrl('/ws/tcp')}&hostId=${props.tab.hostId}`);
  ws.onopen = () => { props.tab.status = 'connecting'; };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'status' && msg.status === 'connected') {
        props.tab.status = 'connected';
        tcpConnected.value = true;
        reconnectAttempts = 0;
        stopReconnect = false;
        errorDialogVisible.value = false;
        ElMessage.success('TCP 通道已建立');
      } else if (msg.type === 'status' && msg.status === 'error') {
        errorMsg.value = msg.msg || 'TCP 连接失败';
        props.tab.status = 'disconnected';
        tcpConnected.value = false;
        scheduleReconnect();
      }
    } catch {}
  };
  ws.onclose = () => {
    if (props.tab.status === 'connected') {
      errorMsg.value = 'TCP 通道已断开';
      props.tab.status = 'disconnected';
      tcpConnected.value = false;
      scheduleReconnect();
    } else if (!stopReconnect && reconnectAttempts < 3) {
      errorMsg.value = 'TCP 通道建立失败';
      props.tab.status = 'disconnected';
      tcpConnected.value = false;
      scheduleReconnect();
    }
  };
  ws.onerror = () => {
    errorMsg.value = 'TCP 连接发生错误';
    props.tab.status = 'disconnected';
    tcpConnected.value = false;
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (stopReconnect) return;
  if (reconnectAttempts >= 3) {
    errorDialogVisible.value = true;
    return;
  }
  reconnectAttempts++;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 3000);
}

function reconnect() {
  clearTimeout(reconnectTimer);
  reconnectAttempts = 0;
  stopReconnect = false;
  tcpConnected.value = false;
  connect();
}

function testConnect() { reconnect(); }

function onErrorCancel() {
  stopReconnect = true;
  try { ws?.close(); } catch {}
  tcpConnected.value = false;
  props.tab.status = 'disconnected';
  emit('close');
}
function onErrorContinue() {
  reconnectAttempts = 0;
  stopReconnect = false;
  reconnect();
}

function downloadRdp() {
  const content = [
    `full address:s:proxy.local`,
    `port:i:3389`,
    `screen mode id:i:2`,
    `session bpp:i:32`,
    `compression:i:1`,
    `keyboardhook:i:2`,
    `audiocapturemode:i:1`,
    `videoplaybackmode:i:1`,
    `connection type:i:2`
  ].join('\r\n');
  const blob = new Blob([content], { type: 'application/x-rdp' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.tab.hostName}.rdp`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已下载 .rdp 配置文件');
}

onMounted(() => { connect(); });
onBeforeUnmount(() => {
  stopReconnect = true;
  clearTimeout(reconnectTimer);
  try { ws?.close(); } catch {}
});
</script>

<style lang="scss" scoped>
.rdp-wrapper { height: 100%; display: flex; flex-direction: column; background: var(--ops-bg); }
.rdp-toolbar {
  height: 40px; padding: 0 12px; display: flex; justify-content: space-between; align-items: center;
  /* TCP 通道：使用橙色工具栏（对应 accent-orange = TCP 协议色） */
  background: linear-gradient(90deg, rgba(255,166,87,0.10) 0%, rgba(219,109,40,0.10) 100%);
  border-bottom: 1px solid var(--accent-orange);
  .host-info { font-size: 13px; font-weight: 700; color: var(--accent-orange); }
}
.rdp-body { padding: 24px; flex: 1; overflow: auto; }
.tcp-info {
  margin-top: 20px; padding: 16px; background: var(--ops-bg-2);
  border: 1px solid var(--ops-border); border-radius: 8px;
  border-left: 3px solid var(--accent-orange);
  div { margin-bottom: 6px; font-size: 13px; }
}
.connect-actions { margin-top: 20px; display: flex; gap: 10px; }
</style>
