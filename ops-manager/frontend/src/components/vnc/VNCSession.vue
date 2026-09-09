<template>
  <div class="vnc-wrapper" ref="wrapRef">
    <div class="vnc-toolbar">
      <span class="host-info">{{ tab.hostName }} (VNC)</span>
      <div class="tools">
        <el-button size="small" :icon="Refresh" @click="reconnect">重连</el-button>
        <el-button size="small" :icon="FullScreen" @click="toggleFullscreen">全屏</el-button>
        <el-select v-model="quality" size="small" style="width:90px" @change="onQualityChange">
          <el-option label="低画质" :value="3" />
          <el-option label="中画质" :value="6" />
          <el-option label="高画质" :value="9" />
        </el-select>
        <el-tag size="small" :type="statusType">{{ statusText }}</el-tag>
      </div>
    </div>
    <div class="vnc-stage" ref="stageRef">
      <div v-if="!connected && !connecting" class="vnc-loading">
        <el-icon class="is-loading"><Loading /></el-icon> 正在建立 VNC 连接...
      </div>
      <div v-if="connecting" class="vnc-loading">
        <el-icon class="is-loading"><Loading /></el-icon> 连接中，请稍候...
      </div>
      <!-- noVNC 会把 canvas 注入到 stageRef 的子元素 -->
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
// noVNC 本地 ESM 引入（打包时会被打入 bundle，无外部 CDN）
import RFB from '@novnc/novnc';
import { wsUrl } from '../../api';

const props = defineProps({ tab: { type: Object, required: true } });

const wrapRef = ref(null);
const stageRef = ref(null);
let rfb = null;

const connected = ref(false);
const connecting = ref(false);
const quality = ref(6);
let reconnectTimer = null;
let reconnectAttempts = 0;

const statusText = computed(() => connected.value ? '已连接' : connecting.value ? '连接中' : '已断开');
const statusType = computed(() => connected.value ? 'success' : connecting.value ? 'warning' : 'danger');

async function connect() {
  if (!stageRef.value) return;
  connecting.value = true;
  props.tab.status = 'connecting';

  try {
    const url = `${wsUrl('/ws/vnc')}&hostId=${props.tab.hostId}`;
    // noVNC 构造参数：url, target, options
    rfb = new RFB(stageRef.value, url, {
      credentials: { password: '' },
      shared: true,
      showDotCursor: true,
      resizeSession: true,
      qualityLevel: quality.value,
      compressionLevel: 6
    });

    rfb.addEventListener('connect', () => {
      connected.value = true;
      connecting.value = false;
      props.tab.status = 'connected';
      reconnectAttempts = 0;
    });
    rfb.addEventListener('disconnect', (e) => {
      connected.value = false;
      props.tab.status = 'disconnected';
      scheduleReconnect();
    });
    rfb.addEventListener('securityfailure', (e) => {
      // noVNC 会自动弹密码框，也可以用 sendCredentials
      // 先尝试空密码，再让用户交互
      rfb?.sendCredentials({ password: '' });
    });
  } catch (e) {
    console.error('VNC connect error:', e);
    connecting.value = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= 3) return;
  reconnectAttempts++;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 3000);
}

function reconnect() {
  clearTimeout(reconnectTimer);
  reconnectAttempts = 0;
  cleanup();
  connect();
}

function cleanup() {
  if (rfb) {
    try { rfb.disconnect(); } catch {}
    try { rfb._sock?.close(); } catch {}
    rfb = null;
  }
  if (stageRef.value) stageRef.value.innerHTML = '';
}

function toggleFullscreen() {
  if (wrapRef.value.requestFullscreen) wrapRef.value.requestFullscreen();
  else if (wrapRef.value.webkitRequestFullscreen) wrapRef.value.webkitRequestFullscreen();
}

function onQualityChange() {
  if (rfb?.setQualityLevel) rfb.setQualityLevel(quality.value);
}

onMounted(async () => {
  await nextTick();
  connect();
});

onBeforeUnmount(() => {
  clearTimeout(reconnectTimer);
  cleanup();
});
</script>

<style lang="scss" scoped>
.vnc-wrapper { height: 100%; display: flex; flex-direction: column; background: #000; }
.vnc-toolbar {
  height: 40px; padding: 0 12px; display: flex; justify-content: space-between; align-items: center;
  background: #161b22; border-bottom: 1px solid var(--ops-border);
  .host-info { font-size: 13px; font-weight: 600; color: var(--ops-primary-hover); }
  .tools { display: flex; align-items: center; gap: 8px; }
}
.vnc-stage { flex: 1; position: relative; overflow: hidden; background: #000; }
.vnc-loading {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  color: #8b949e; display: flex; gap: 8px; align-items: center; font-size: 13px;
}
</style>
