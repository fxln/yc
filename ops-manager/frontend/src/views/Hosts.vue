<template>
  <div class="hosts-page">
    <!-- 搜索和操作栏 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <el-input v-model="filters.keyword" placeholder="搜索名称/IP/备注" clearable style="width:260px" :prefix-icon="Search" />
        <el-select v-model="filters.protocol" placeholder="协议" clearable style="width:120px">
          <el-option label="SSH" value="ssh" />
          <el-option label="VNC" value="vnc" />
          <el-option label="RDP" value="rdp" />
          <el-option label="TCP" value="tcp" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:120px">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="onAdd">新增主机</el-button>
        <el-button :icon="Upload" @click="triggerImport">导入 JSON</el-button>
        <input type="file" ref="importInput" style="display:none" accept=".json" @change="onImport" />
        <el-button :icon="Download" @click="onExport" v-if="userStore.isAdmin">导出</el-button>
        <el-button type="danger" :icon="Delete" :disabled="!selected.length" @click="onBatchDelete" v-if="userStore.isAdmin">批量删除 ({{ selected.length }})</el-button>
      </div>
    </el-card>

    <!-- 主机列表 -->
    <el-card class="table-card">
      <el-table :data="hosts" @selection-change="selected = $event" size="default" stripe>
        <el-table-column type="selection" width="44" v-if="userStore.isAdmin" />
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <span class="status-dot" :class="row.status">
              <i class="dot" />{{ row.status === 'online' ? '在线' : row.status === 'connecting' ? '连接' : '离线' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" width="160" />
        <el-table-column prop="ip" label="IP:端口" width="160">
          <template #default="{ row }">{{ row.ip }}:{{ row.port }}</template>
        </el-table-column>
        <el-table-column prop="protocol" label="协议" width="100">
          <template #default="{ row }">
            <el-tag size="small" :class="`protocol-${row.protocol}`">{{ row.protocol.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" width="120" />
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button-group size="small">
              <el-button type="primary" @click="connect(row)">连接</el-button>
              <el-button @click="onEdit(row)">编辑</el-button>
              <el-button type="danger" @click="onRemove(row)" v-if="userStore.isAdmin">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑 Dialog -->
    <HostFormDialog v-model="dialogVisible" :host="current" @save="onSave" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTabsStore } from '../stores/tabs';
import { useUserStore } from '../stores/user';
import { hostApi } from '../api';
import HostFormDialog from '../components/common/HostFormDialog.vue';

const userStore = useUserStore();
const tabsStore = useTabsStore();

const hosts = ref([]);
const filters = reactive({ keyword: '', protocol: '', status: '' });
const selected = ref([]);
const dialogVisible = ref(false);
const current = ref(null);
const importInput = ref(null);

async function load() {
  const res = await hostApi.list(filters);
  hosts.value = res.data || [];
}

function connect(h) {
  if (h.protocol === 'ssh') tabsStore.openTab({ id: `ssh_${h.id}`, type: 'ssh', hostId: h.id, hostName: h.name });
  else if (h.protocol === 'vnc') tabsStore.openTab({ id: `vnc_${h.id}`, type: 'vnc', hostId: h.id, hostName: h.name });
  else if (h.protocol === 'rdp') tabsStore.openTab({ id: `rdp_${h.id}`, type: 'rdp', hostId: h.id, hostName: h.name });
  else if (h.protocol === 'tcp') tabsStore.openTab({ id: `tcp_${h.id}`, type: 'tcp', hostId: h.id, hostName: h.name });
}

function onAdd() { current.value = null; dialogVisible.value = true; }
function onEdit(row) { current.value = row; dialogVisible.value = true; }
async function onSave(data) {
  if (current.value) {
    await hostApi.update(current.value.id, data);
    ElMessage.success('已更新');
  } else {
    await hostApi.create(data);
    ElMessage.success('已新增');
  }
  dialogVisible.value = false;
  load();
}
async function onRemove(row) {
  await ElMessageBox.confirm(`删除主机 ${row.name} ?`, '提示', { type: 'warning' });
  await hostApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}
async function onBatchDelete() {
  await ElMessageBox.confirm(`批量删除 ${selected.value.length} 台主机？`, '提示', { type: 'warning' });
  await hostApi.batchDelete(selected.value.map((x) => x.id));
  ElMessage.success('批量删除成功');
  load();
}

function triggerImport() { importInput.value?.click(); }
async function onImport(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  const content = await f.text();
  try {
    const data = JSON.parse(content);
    await hostApi.import(data);
    ElMessage.success('导入成功');
    load();
  } catch (err) {
    ElMessage.error('导入失败：' + err.message);
  }
  e.target.value = '';
}
async function onExport() {
  const res = await hostApi.export();
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `hosts-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<style lang="scss" scoped>
.hosts-page { padding: 16px; }
.filter-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.status-dot { display: flex; align-items: center; gap: 4px; font-size: 11px; &.online { color: var(--ops-success); } &.offline { color: var(--ops-text-secondary); } &.connecting { color: var(--ops-warning); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; } }
.table-card { margin-top: 16px; }
</style>
