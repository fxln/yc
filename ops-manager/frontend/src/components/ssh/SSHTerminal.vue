<template>
  <div class="ssh-wrapper">
    <!-- 终端工具条 -->
    <div class="ssh-toolbar">
      <span class="host-info">
        <span class="protocol-badge">SSH</span>
        {{ tab.hostName }}
      </span>
      <div class="tools">
        <!-- 字体缩放 -->
        <el-tooltip content="缩小 (Ctrl+-)" placement="bottom">
          <el-button text size="small" class="zoom-btn" @click="changeFont(-1)">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
        </el-tooltip>
        <span class="zoom-label">{{ fontSize }}px</span>
        <el-tooltip content="放大 (Ctrl+=)" placement="bottom">
          <el-button text size="small" class="zoom-btn" @click="changeFont(1)">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="重置 (Ctrl+0)" placement="bottom">
          <el-button text size="small" class="zoom-btn" @click="resetFont">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </el-tooltip>

        <span class="sep" />

        <!-- 清屏 -->
        <el-tooltip content="清屏并保留历史 (Ctrl+L)" placement="bottom">
          <el-button text size="small" @click="clearScreen">
            <el-icon><MagicStick /></el-icon> 清屏
          </el-button>
        </el-tooltip>
        <el-tooltip content="彻底清空画面 + 滚动历史" placement="bottom">
          <el-button text size="small" @click="clearAll">
            <el-icon><Delete /></el-icon> 全清
          </el-button>
        </el-tooltip>

        <span class="sep" />

        <!-- 复制粘贴 -->
        <el-tooltip content="复制选区 (Ctrl+Shift+C)" placement="bottom">
          <el-button text size="small" :icon="CopyDocument" @click="copy" />
        </el-tooltip>
        <el-tooltip content="粘贴 (Ctrl+Shift+V)" placement="bottom">
          <el-button text size="small" :icon="DocumentCopy" @click="paste" />
        </el-tooltip>

        <span class="sep" />

        <el-tag size="small" :type="statusType" effect="light">
          <span :class="['status-dot', statusCls]"><i class="dot" />{{ statusText }}</span>
        </el-tag>

        <el-tooltip content="重连 (Ctrl+R)" placement="bottom">
          <el-button text size="small" :icon="Refresh" @click="reconnect" />
        </el-tooltip>
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

    <!-- 底部快捷键提示条 -->
    <div class="kb-bar" v-if="tab.status === 'connected'">
      <span class="kb-item"><kbd>Ctrl</kbd>+<kbd>+</kbd> 放大</span>
      <span class="kb-item"><kbd>Ctrl</kbd>+<kbd>-</kbd> 缩小</span>
      <span class="kb-item"><kbd>Ctrl</kbd>+<kbd>0</kbd> 重置</span>
      <span class="kb-item"><kbd>Ctrl</kbd>+<kbd>L</kbd> 清屏</span>
      <span class="kb-item"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>+</kbd> 新建 Tab</span>
    </div>

    <ConnectionErrorDialog
      v-model="errorDialogVisible"
      :host-name="tab.hostName"
      protocol="ssh"
      :message="errorMsg"
      :attempts="reconnectAttempts"
      @cancel="onErrorCancel"
      @continue="onErrorContinue"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, h } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Warning, CopyDocument, DocumentCopy, FolderAdd, Upload, Hide,
  ZoomIn, ZoomOut, RefreshRight, MagicStick, Delete
} from '@element-plus/icons-vue';
import SFTPFileManager from '../sftp/SFTPFileManager.vue';
import ConnectionErrorDialog from '../common/ConnectionErrorDialog.vue';
import { wsUrl } from '../../api';

const props = defineProps({ tab: { type: Object, required: true } });
const emit = defineEmits(['set-host', 'close']);

// —— 常量 ——
const FONT_MIN = 10;
const FONT_MAX = 24;
const FONT_DEFAULT = 14;

// —— 终端状态 ——
const termRef = ref(null);
const termWrap = ref(null);
const fontSize = ref(loadFontSize());
const warnMsg = ref('');
const sftpCollapsed = ref(false);
const fileInput = ref(null);
const errorDialogVisible = ref(false);
const errorMsg = ref('');
let term = null;
let fitAddon = null;
let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let stopReconnect = false;

function loadFontSize() {
  try {
    const v = Number(localStorage.getItem('ssh.fontSize'));
    if (v >= FONT_MIN && v <= FONT_MAX) return v;
  } catch {}
  return FONT_DEFAULT;
}
function saveFontSize(v) {
  try { localStorage.setItem('ssh.fontSize', String(v)); } catch {}
}

const statusText = computed(() =>
  props.tab.status === 'connected' ? '已连接'
  : props.tab.status === 'connecting' ? '连接中...'
  : '已断开'
);
const statusType = computed(() =>
  props.tab.status === 'connected' ? 'success'
  : props.tab.status === 'connecting' ? 'warning'
  : 'danger'
);
const statusCls = computed(() =>
  props.tab.status === 'connected' ? 'online'
  : props.tab.status === 'connecting' ? 'connecting'
  : 'disconnected'
);

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
    convertEol: false,
    scrollback: 5000
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
  window.addEventListener('keydown', onGlobalKey);
}

function onResize() { if (fitAddon) fitAddon.fit(); }

// —— 键盘快捷键 ——
function onGlobalKey(e) {
  // 只在终端区域聚焦时响应（通过 document.activeElement）
  const inTerminal = document.activeElement?.closest('.ssh-wrapper')
    || document.activeElement === termRef.value
    || termRef.value?.contains(document.activeElement);
  if (!inTerminal) return;

  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  // Ctrl+= 或 Ctrl++ 放大
  if ((e.key === '=' || e.key === '+') && !e.shiftKey) {
    e.preventDefault(); changeFont(1);
  }
  // Ctrl+- 缩小
  else if (e.key === '-') {
    e.preventDefault(); changeFont(-1);
  }
  // Ctrl+0 重置
  else if (e.key === '0') {
    e.preventDefault(); resetFont();
  }
  // Ctrl+L 清屏
  else if (e.key.toLowerCase() === 'l') {
    e.preventDefault(); clearScreen();
  }
  // Ctrl+R 重连
  else if (e.key.toLowerCase() === 'r') {
    e.preventDefault(); reconnect();
  }
}

// —— 字体缩放 ——
function changeFont(delta) {
  const next = Math.max(FONT_MIN, Math.min(FONT_MAX, fontSize.value + delta));
  if (next === fontSize.value) return;
  fontSize.value = next;
  applyFont();
}
function resetFont() {
  fontSize.value = FONT_DEFAULT;
  applyFont();
}
function applyFont() {
  saveFontSize(fontSize.value);
  if (term) {
    term.options.fontSize = fontSize.value;
    // 关键：改完字体必须重新 fit，否则 cols/rows 不准
    fitAddon?.fit();
  }
}

// —— WebSocket 连接 ——
function connect() {
  if (stopReconnect) return;
  props.tab.status = 'connecting';
  errorDialogVisible.value = false;
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
      if (msg.status === 'connected') {
        reconnectAttempts = 0;
        stopReconnect = false;
      } else if (msg.status === 'disconnected' || msg.status === 'error') {
        errorMsg.value = msg.msg || 'SSH 连接已断开';
        scheduleReconnect();
      }
    } else if (msg.type === 'warn') {
      warnMsg.value = msg.msg;
      setTimeout(() => warnMsg.value = '', 4000);
    } else if (msg.type === 'pong') { /* ping/pong */ }
  };
  ws.onclose = () => {
    if (props.tab.status === 'connected') {
      props.tab.status = 'disconnected';
      errorMsg.value = 'SSH 连接已关闭';
      scheduleReconnect();
    } else if (!stopReconnect) {
      props.tab.status = 'disconnected';
      errorMsg.value = errorMsg.value || 'SSH 连接失败';
      scheduleReconnect();
    }
  };
  ws.onerror = () => {
    props.tab.status = 'disconnected';
    errorMsg.value = errorMsg.value || 'SSH 连接发生错误';
  };

  // 心跳
  const pingTimer = setInterval(() => {
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
    else clearInterval(pingTimer);
  }, 30000);
}

function scheduleReconnect() {
  if (stopReconnect) return;
  if (reconnectAttempts >= 3) {
    errorDialogVisible.value = true;
    return;
  }
  reconnectAttempts++;
  ElMessage.info(`${reconnectAttempts}/3 秒后自动重连...`);
  reconnectTimer = setTimeout(connect, 3000);
}

function reconnect() {
  clearTimeout(reconnectTimer);
  reconnectAttempts = 0;
  stopReconnect = false;
  connect();
}

function onErrorCancel() {
  stopReconnect = true;
  ws?.close();
  emit('close');
}
function onErrorContinue() {
  reconnectAttempts = 0;
  stopReconnect = false;
  reconnect();
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

// 清屏：保留 scrollback，把画面重置（相当于 shell 的 clear / Ctrl+L）
function clearScreen() {
  if (!term) return;
  term.clear();                     // 清 viewport
  term.write('\x1b[2J\x1b[H');       // 清 viewport + 光标回到 HOME
  // 发送 Ctrl+L 给 shell（很多 shell 会自己重绘 prompt）
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'data', data: '\x0c' }));
  ElMessage.success('已清屏（保留历史）');
}

// 全清：画面 + scrollback buffer 一起清空
function clearAll() {
  if (!term) return;
  // 清 viewport + 清 scrollback + 光标回 HOME
  term.write('\x1b[2J\x1b[3J\x1b[H');
  ElMessage.success('已彻底清空');
}

// —— 快捷命令触发（通过 tab.commandToSend）——
watch(() => props.tab.commandToSend, (cmd) => {
  if (!cmd) return;
  sendCommand(cmd.content);
}, { deep: true });

function sendCommand(content) {
  if (!content) return;
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
function onUpload(e) { /* 由 SFTPFileManager 负责 */ }

// fontSize 被其他组件（如 HostDetail 通过 tab）改了也能响应
watch(fontSize, (v, old) => {
  if (v !== old) applyFont();
});

onMounted(async () => {
  await nextTick();
  initTerminal();
  connect();
});
onBeforeUnmount(() => {
  stopReconnect = true;
  clearTimeout(reconnectTimer);
  ws?.close();
  term?.dispose();
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onGlobalKey);
});
</script>

<style lang="scss" scoped>
.ssh-wrapper {
  height: 100%; display: flex; flex-direction: column;
  background: var(--ops-bg);
}

:deep(.ssh-toolbar) {
  height: 40px; padding: 0 12px; display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  .host-info {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 700; color: var(--accent-blue);
    .protocol-badge {
      display: inline-block; padding: 2px 6px; border-radius: 3px;
      font-size: 10px; font-weight: 800; letter-spacing: .5px;
      background: rgba(57,197,207,.20); color: var(--accent-cyan);
      border: 1px solid rgba(57,197,207,.35);
    }
  }
  .tools {
    display: flex; align-items: center; gap: 4px;
    font-size: 12px;
  }
  .sep {
    width: 1px; height: 16px; background: var(--ops-border); margin: 0 4px;
  }
  .zoom-btn {
    padding: 4px !important;
    &:hover { color: var(--accent-blue); }
  }
  .zoom-label {
    font-size: 11px; font-variant-numeric: tabular-nums;
    min-width: 32px; text-align: center;
    color: var(--accent-cyan); font-weight: 600;
    user-select: none;
  }
}

.ssh-body { flex: 1; display: flex; min-height: 0; }
.terminal-wrap { flex: 1; position: relative; min-width: 0; }
.xterm-host {
  width: 100%; height: 100%; padding: 6px; box-sizing: border-box;
  /* xterm.js 内层 canvas 的背景色由终端 theme 决定，这里统一兜底 */
  background: #0d1117;
}

.warn-toast {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  background: rgba(248,81,73,0.15); border: 1px solid var(--ops-danger);
  padding: 8px 14px; border-radius: 6px;
  color: #ff9999; font-size: 12px; z-index: 10;
  display: flex; align-items: center; gap: 6px;
  backdrop-filter: blur(4px);
}

.sftp-wrap {
  width: 340px; border-left: 1px solid var(--ops-border);
  display: flex; flex-direction: column; background: var(--ops-bg-2);
  transition: width .2s;
  &.collapsed { width: 36px; overflow: hidden; }
}
.sftp-header {
  height: 36px; padding: 0 8px; display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: var(--accent-cyan); font-weight: 600;
  border-bottom: 1px solid var(--ops-border-soft);
}
.sftp-tools { display: flex; gap: 2px; }

/* 底部快捷键提示条 */
.kb-bar {
  display: flex; align-items: center; gap: 16px;
  padding: 5px 14px; height: 28px;
  background: linear-gradient(180deg, rgba(57,197,207,.06) 0%, rgba(57,197,207,.02) 100%);
  border-top: 1px solid var(--ops-border-soft);
  font-size: 11px; color: var(--ops-text-3);
  flex-shrink: 0;
  user-select: none;
  .kb-item {
    display: inline-flex; align-items: center; gap: 2px;
    kbd {
      display: inline-block;
      padding: 1px 5px; border-radius: 3px;
      background: var(--ops-bg-3);
      border: 1px solid var(--ops-border);
      border-bottom-width: 2px;
      font-family: Menlo, Consolas, monospace;
      font-size: 10px; font-weight: 700;
      color: var(--accent-cyan);
      line-height: 14px;
    }
  }
}

/* 覆盖 el-tag 在工具栏里的紧凑样式 */
:deep(.el-tag) {
  .status-dot { font-size: 11px; }
}
</style>
