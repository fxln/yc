<template>
  <div class="ssh-wrapper">
    <!-- 终端工具条 -->
    <div class="ssh-toolbar">
      <span class="host-info">{{ tab.hostName }} (SSH)</span>
      <div class="tools">
        <el-button-group>
          <el-button size="small" :icon="Refresh" @click="reconnect">重连</el-button>
          <el-button size="small" :icon="DocumentCopy" @click="copy">复制</el-button>
          <el-button size="small" :icon="Select" @click="paste">粘贴</el-button>
          <el-button size="small" :icon="Delete" @click="clearScreen">清屏</el-button>
        </el-button-group>
        <el-button-group>
          <el-button size="small" @click="fontSize = Math.max(10, fontSize - 1)">A-</el-button>
          <el-button size="small" @click="fontSize = Math.min(24, fontSize + 1)">A+</el-button>
        </el-button-group>
        <el-tag size="small" :type="statusType">{{ statusText }}</el-tag>
      </div>
    </div>

    <!-- 终端 + 文件管理 分割布局 -->
    <div class="ssh-body">
      <div class="terminal-wrap" ref="termWrap">
        <div ref="termRef" class="xterm-host" />
        <!-- 危险命令告警 -->
        <div class="warn-toast" v-if="warnMsg">
          <el-icon style="color:var(--ops-danger)"><Warning /></el-icon> {{ warnMsg }}
        </div>
      </div>
      <!-- SFTP 文件管理器（可折叠） -->
      <div class="sftp-wrap" :class="{ collapsed: sftpCollapsed }">
        <div class="sftp-header">
          <span>📁 文件管理器</span>
          <div class="sftp-tools">
            <el-button text size="small" :icon="FolderAdd" @click="onMkdir">新建</el-button>
            <el-button text size="small" :icon="Upload" @click="triggerUpload">上传</el-button>
            <input type="file" ref="fileInput" multiple style="display:none" @change="onUpload" />
            <el-button text size="small" :icon="Hide" @click="sftpCollapsed = !sftpCollapsed">{{ sftpCollapsed ? '展开' : '折叠' }}</el-button>
          </div>
        </div>
        <SFTPFileManager v-if="!sftpCollapsed" :hostId="tab.hostId" :allow-upload="true" :allow-download="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, h } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as Icons from '@element-plus/icons-vue';
import SFTPFileManager from '../sftp/SFTPFileManager.vue';
import { wsUrl } from '../../api';

const props = defineProps({ tab: { type: Object, required: true } });
const emit = defineEmits(['set-host']);

// —— 终端状态 ——
const termRef = ref(null);
const termWrap = ref(null);
const fontSize = ref(14);
const warnMsg = ref('');
const sftpCollapsed = ref(false);
const fileInput = ref(null);
let term = null;
let fitAddon = null;
let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

const statusText = computed(() => props.tab.status === 'connected' ? '已连接' : props.tab.status === 'connecting' ? '连接中...' : '已断开');
const statusType = computed(() => props.tab.status === 'connected' ? 'success' : props.tab.status === 'connecting' ? 'warning' : 'danger');

// —— 初始化终端 ——
function initTerminal() {
  term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Menlo, Consolas, "Liberation Mono", "PingFang SC", monospace',
    fontSize: fontSize.value,
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      selectionBackground: '#264f78',
      black: '#000000', red: '#f85149', green: '#3fb950', yellow: '#d29922',
      blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#d1d9e0'
    },
    convertEol: false
  });
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());
  term.loadAddon(new SearchAddon());
  term.open(termRef.value);
  fitAddon.fit();

  term.onData((data) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'data', data }));
  });
  term.onResize(({ cols, rows }) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
  });

  window.addEventListener('resize', onResize);
}

function onResize() {
  if (fitAddon) fitAddon.fit();
}

// —— WebSocket 连接 ——
function connect() {
  props.tab.status = 'connecting';
  const url = `${wsUrl('/ws/ssh')}&hostId=${props.tab.hostId}`;
  try { ws?.close(); } catch {}
  ws = new WebSocket(url);

  ws.onopen = () => { reconnectAttempts = 0; };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'data' && term) term.write(msg.data);
    else if (msg.type === 'status') {
      props.tab.status = msg.status;
      if (msg.status === 'disconnected' || msg.status === 'error') {
        ElMessage.error(msg.msg || '连接断开');
        scheduleReconnect();
      }
    } else if (msg.type === 'warn') {
      warnMsg.value = msg.msg;
      setTimeout(() => warnMsg.value = '', 4000);
    } else if (msg.type === 'pong') { /* ping/pong */ }
  };
  ws.onclose = () => {
    props.tab.status = 'disconnected';
    scheduleReconnect();
  };
  ws.onerror = () => { props.tab.status = 'disconnected'; };

  // 心跳
  const pingTimer = setInterval(() => {
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
    else clearInterval(pingTimer);
  }, 30000);
}

function scheduleReconnect() {
  if (reconnectAttempts >= 3) return;
  reconnectAttempts++;
  ElMessage.info(`${reconnectAttempts}/3 秒后自动重连...`);
  reconnectTimer = setTimeout(connect, 3000);
}

function reconnect() {
  clearTimeout(reconnectTimer);
  reconnectAttempts = 0;
  connect();
}

// —— 工具 ——
function copy() {
  if (!term) return;
  const sel = term.getSelection();
  if (!sel) return ElMessage.info('请先在终端中选择文字');
  navigator.clipboard.writeText(sel).then(() => ElMessage.success('已复制'));
}
function paste() {
  navigator.clipboard.readText().then((txt) => {
    if (txt && ws?.readyState === 1) ws.send(JSON.stringify({ type: 'data', data: txt }));
  }).catch(() => ElMessage.warning('浏览器拒绝读取剪贴板，请使用 Ctrl+V'));
}
function clearScreen() { term?.clear(); }

// —— 快捷命令触发（通过 tab.commandToSend）——
watch(() => props.tab.commandToSend, (cmd) => {
  if (!cmd) return;
  sendCommand(cmd.content);
}, { deep: true });

// 带占位符解析 + 弹窗
function sendCommand(content) {
  if (!content) return;
  // 找占位符 ${xxx}
  const placeholders = [...content.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]);
  if (placeholders.length) {
    openVarDialog(placeholders).then((values) => {
      let final = content;
      placeholders.forEach((p) => { final = final.replace(new RegExp(`\\$\\{${p}\\}`), values[p] || ''); });
      doSend(final);
    }).catch(() => {});
  } else {
    doSend(content);
  }
}
function doSend(cmd) {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'exec', command: cmd }));
  ElMessage.success(`已发送: ${cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd}`);
}
function openVarDialog(names) {
  return new Promise((resolve, reject) => {
    const values = {};
    ElMessageBox({
      title: '填写变量',
      message: () => {
        return h('div', null, names.map((n) => h('div', { style: 'margin-bottom:10px;display:flex;align-items:center;gap:8px;' }, [
          h('span', { style: 'min-width:80px' }, n + ':'),
          h('input', {
            class: 'ssh-input-vars',
            placeholder: `请输入 ${n}`,
            onInput: (e) => { values[n] = e.target.value; }
          })
        ])));
      },
      showCancelButton: true,
      confirmButtonText: '发送',
      cancelButtonText: '取消'
    }).then(() => resolve(values)).catch(reject);
  });
}

// —— 文件上传触发 ——
function triggerUpload() { fileInput.value?.click(); }
function onUpload(e) {
  // 由 SFTPFileManager 负责，此处不做
}

watch(fontSize, (v) => { if (term) term.options.fontSize = v; });

onMounted(async () => {
  await nextTick();
  initTerminal();
  connect();
});
onBeforeUnmount(() => {
  clearTimeout(reconnectTimer);
  ws?.close();
  term?.dispose();
  window.removeEventListener('resize', onResize);
});
</script>

<style lang="scss" scoped>
.ssh-wrapper { height: 100%; display: flex; flex-direction: column; background: var(--ops-bg); }

/* .ssh-toolbar 全局样式已在 theme.scss 中定义（紫蓝渐变 + accent-purple 下边框）
   这里只补充 SSH 专属的子元素细节 */
:deep(.ssh-toolbar) {
  height: 40px; padding: 0 12px; display: flex; justify-content: space-between; align-items: center;
  .host-info { font-size: 13px; font-weight: 700; color: var(--accent-blue); }
  .tools { display: flex; align-items: center; gap: 8px; }
}

.ssh-body { flex: 1; display: flex; min-height: 0; }
.terminal-wrap { flex: 1; position: relative; min-width: 0; }
.xterm-host { width: 100%; height: 100%; padding: 4px; box-sizing: border-box; }
.warn-toast {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  background: rgba(248,81,73,0.15); border: 1px solid var(--ops-danger);
  padding: 8px 14px; border-radius: 6px;
  color: #ff9999; font-size: 12px; z-index: 10; display: flex; align-items: center; gap: 6px;
  backdrop-filter: blur(4px);
}
.sftp-wrap {
  width: 340px; border-left: 1px solid var(--ops-border);
  display: flex; flex-direction: column; background: var(--ops-bg-2);
  transition: width .2s;
  &.collapsed { width: 36px; overflow: hidden; }
}
.sftp-header { height: 36px; padding: 0 8px; display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: var(--accent-cyan); font-weight: 600;
  border-bottom: 1px solid var(--ops-border-soft); }
.sftp-tools { display: flex; gap: 2px; }
</style>
