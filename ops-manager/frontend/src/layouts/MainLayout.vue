<template>
  <div class="ops-shell">
    <!-- 左侧：分组 + 主机树 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">⚙️ OpsManager</div>
      </div>
      <div class="sidebar-menu">
        <el-menu
          :default-active="activeMenu"
          background-color="#161b22"
          text-color="#8b949e"
          active-text-color="#fff"
          class="dark-menu"
          @select="onMenuSelect"
        >
          <el-menu-item index="dashboard"><el-icon><Monitor /></el-icon><span>主机总览</span></el-menu-item>
          <el-menu-item index="hosts"><el-icon><Server /></el-icon><span>主机管理</span></el-menu-item>
          <el-menu-item index="commands"><el-icon><Promotion /></el-icon><span>快捷命令仓库</span></el-menu-item>
          <el-menu-item v-if="userStore.isAdmin" index="users"><el-icon><User /></el-icon><span>用户管理</span></el-menu-item>
          <el-menu-item v-if="userStore.isAdmin" index="webdav"><el-icon><Connection /></el-icon><span>WebDAV 设置</span></el-menu-item>
          <el-menu-item index="logs"><el-icon><Document /></el-icon><span>系统日志</span></el-menu-item>
        </el-menu>
      </div>

      <!-- 分组 + 主机树 -->
      <div class="host-tree">
        <div class="tree-title">
          <span>主机分组</span>
          <el-button size="small" text :icon="Plus" @click="$emit('add-group')" v-if="userStore.isAdmin" />
        </div>
        <el-tree
          :data="treeData"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          highlight-current
          default-expand-all
          @node-click="onHostClick"
        >
          <template #default="{ node, data }">
            <div class="tree-node">
              <span class="node-label">
                <el-icon v-if="data.isGroup"><Folder /></el-icon>
                <el-icon v-else :class="data.status === 'online' ? 'online' : 'offline'">
                  <Monitor />
                </el-icon>
                {{ node.label }}
              </span>
              <span v-if="!data.isGroup" class="node-status" :class="data.status">
                <i class="dot" />{{ data.status === 'online' ? '在线' : '离线' }}
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </aside>

    <!-- 中间：主机详情 + 快捷命令面板 -->
    <section class="center-panel" v-if="selectedHost">
      <HostDetail :host="selectedHost" @refresh="$emit('refresh-hosts')" />
    </section>
    <section class="center-panel empty" v-else>
      <el-empty description="请选择左侧主机或从右侧 Tab 打开远程连接" />
    </section>

    <!-- 右侧：主工作区（多 Tab 会话） -->
    <section class="main-panel">
      <!-- 顶部栏 -->
      <header class="top-bar">
        <div class="top-left">
          <el-icon @click="tabsStore.closeAll()" title="关闭所有会话" class="close-all"><Close /></el-icon>
        </div>
        <div class="top-right">
          <span class="user-info">
            <el-icon><User /></el-icon>
            {{ userStore.info?.username || '' }}
            <el-tag size="small" type="info">{{ roleLabel }}</el-tag>
          </span>
          <el-button text @click="onLogout">退出</el-button>
        </div>
      </header>

      <!-- 会话 Tab -->
      <div class="session-tabs">
        <el-tabs v-model="tabsStore.activeId" type="card" class="ops-tabs">
          <el-tab-pane v-for="tab in tabsStore.tabs" :key="tab.id" :name="tab.id">
            <template #label>
              <span class="tab-label">
                <el-icon><component :is="tab.type === 'ssh' ? 'Monitor' : tab.type === 'vnc' ? 'Picture' : 'Link'" /></el-icon>
                {{ tab.hostName }}
                <span class="tab-status" :class="tab.status" :title="tab.msg">{{ tab.status === 'connected' ? '●' : tab.status === 'connecting' ? '◌' : '✖' }}</span>
                <el-icon class="close-tab" @click.stop="tabsStore.closeTab(tab.id)"><Close /></el-icon>
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- Tab 内容 -->
      <div class="session-body">
        <SSHTerminal v-if="activeTab && activeTab.type === 'ssh'" :tab="activeTab" @set-host="selectedHost = $event" />
        <VNCSession v-else-if="activeTab && activeTab.type === 'vnc'" :tab="activeTab" />
        <RDPSession v-else-if="activeTab && activeTab.type === 'rdp'" :tab="activeTab" />
        <el-empty v-else description="暂无远程会话，点击主机卡片上的 '连接' 按钮建立新会话" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox, ElMessage } from 'element-plus';
import { useUserStore } from '../stores/user';
import { useTabsStore } from '../stores/tabs';
import { hostApi, groupApi } from '../api';
import HostDetail from '../components/common/HostDetail.vue';
import SSHTerminal from '../components/ssh/SSHTerminal.vue';
import VNCSession from '../components/vnc/VNCSession.vue';
import RDPSession from '../components/rdp/RDPSession.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const tabsStore = useTabsStore();

const hosts = ref([]);
const groups = ref([]);
const selectedHost = ref(null);

provide('tabsStore', tabsStore);

const activeMenu = computed(() => route.name || 'dashboard');
const activeTab = computed(() => tabsStore.activeTab);

const roleLabel = computed(() => ({ admin: '管理员', user: '运维用户', readonly: '只读' }[userStore.info?.role] || ''));

const treeData = computed(() => {
  const out = [];
  for (const g of groups.value) {
    const children = hosts.value.filter((h) => h.group_id === g.id).map((h) => ({ ...h, isGroup: false, label: `${h.name} [${h.ip}]` }));
    if (children.length || true) {
      out.push({ id: `g_${g.id}`, isGroup: true, label: g.name, children });
    }
  }
  // 未分组主机
  const noGroup = hosts.value.filter((h) => !h.group_id).map((h) => ({ ...h, isGroup: false, label: `${h.name} [${h.ip}]` }));
  if (noGroup.length) out.push({ id: 'g_none', isGroup: true, label: '未分组', children: noGroup });
  return out;
});

async function load() {
  try {
    const [h, g] = await Promise.all([hostApi.list(), groupApi.list()]);
    hosts.value = h.data || [];
    groups.value = g.data || [];
  } catch {}
}

function onMenuSelect(idx) {
  router.push(`/${idx}`);
}

function onHostClick(data) {
  if (!data.isGroup) selectedHost.value = data;
}

function onLogout() {
  ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' }).then(() => {
    userStore.logout();
    tabsStore.closeAll();
    router.push('/login');
  }).catch(() => {});
}

onMounted(() => {
  load();
  setInterval(load, 30000); // 定时刷新
});

defineEmits(['refresh-hosts', 'add-group']);
</script>

<style lang="scss" scoped>
.ops-shell {
  .sidebar {
    width: 240px;
    background: #161b22;
    border-right: 1px solid var(--ops-border);
    display: flex; flex-direction: column;
    flex-shrink: 0;
  }
  .sidebar-header { padding: 14px 16px; border-bottom: 1px solid var(--ops-border); .logo { font-weight: 700; color: var(--ops-primary-hover); font-size: 15px; } }
  .sidebar-menu { border-right: none; .dark-menu { border-right: none; } }
  .host-tree { flex: 1; overflow: auto; border-top: 1px solid var(--ops-border); }
  .tree-title { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; font-size: 12px; color: var(--ops-text-secondary); }
  .tree-node { flex: 1; display: flex; justify-content: space-between; align-items: center; font-size: 13px;
    .node-label { display: flex; gap: 6px; align-items: center; .online { color: var(--ops-success); } .offline { color: var(--ops-text-secondary); } }
    .node-status { font-size: 11px; color: var(--ops-text-secondary); display: flex; align-items: center; gap: 3px;
      .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block; }
      &.online { color: var(--ops-success); } &.offline { color: var(--ops-text-secondary); } }
  }

  .center-panel {
    width: 320px; flex-shrink: 0; background: var(--ops-bg-secondary);
    border-right: 1px solid var(--ops-border); overflow: auto;
    &.empty { display: flex; align-items: center; justify-content: center; }
  }

  .main-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .top-bar {
    height: 42px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between;
    background: var(--ops-bg-secondary); border-bottom: 1px solid var(--ops-border);
    .close-all { color: var(--ops-text-secondary); cursor: pointer; &:hover { color: var(--ops-danger); } }
    .user-info { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ops-text); }
  }
  .session-tabs { background: var(--ops-bg); padding: 0 8px; border-bottom: 1px solid var(--ops-border); }
  .ops-tabs { height: 36px; :deep(.el-tabs__nav-wrap::after) { height: 0; } }
  .tab-label { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
  .tab-status { &.connecting { color: var(--ops-warning); } &.connected { color: var(--ops-success); } &.disconnected { color: var(--ops-danger); } }
  .close-tab { margin-left: 4px; border-radius: 50%; &:hover { background: var(--ops-danger); color: #fff; } }
  .session-body { flex: 1; overflow: hidden; }
}
</style>
