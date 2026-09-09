<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card class="stat-card stat-blue">
          <div class="stat-icon">🖥️</div>
          <div class="stat-value">{{ total }}</div>
          <div class="stat-label">主机总数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-green">
          <div class="stat-icon">✅</div>
          <div class="stat-value">{{ online }}</div>
          <div class="stat-label">在线主机</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-orange">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">{{ offline }}</div>
          <div class="stat-label">离线主机</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-purple">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">{{ commandsCount }}</div>
          <div class="stat-label">快捷命令</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="14">
        <el-card class="accent-cyan" header="📜 最近活动日志">
          <el-table :data="recentLogs" size="small" :max-height="360">
            <el-table-column prop="created_at" label="时间" width="170" />
            <el-table-column prop="username" label="用户" width="100" />
            <el-table-column prop="host_name" label="主机" width="140" />
            <el-table-column prop="action" label="操作" width="120">
              <template #default="{ row }">
                <span :class="row.status === 'fail' ? 'log-fail' : 'log-success'">
                  {{ row.action }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="detail" label="详情" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card class="accent-purple" header="🎯 快速操作">
          <div class="qc-list">
            <div class="qc-item" @click="$router.push('/hosts')">
              <span class="qc-icon" style="color:var(--accent-cyan)">🖥️</span>
              <span class="qc-text">管理主机</span>
            </div>
            <div class="qc-item" @click="$router.push('/commands')">
              <span class="qc-icon" style="color:var(--accent-purple)">⚡</span>
              <span class="qc-text">命令仓库</span>
            </div>
            <div class="qc-item" @click="$router.push('/webdav')">
              <span class="qc-icon" style="color:var(--accent-orange)">📁</span>
              <span class="qc-text">WebDAV 文件</span>
            </div>
            <div class="qc-item" @click="$router.push('/users')">
              <span class="qc-icon" style="color:var(--accent-pink)">👥</span>
              <span class="qc-text">用户管理</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { hostApi, commandApi, logApi } from '../api';

const total = ref(0);
const online = ref(0);
const offline = ref(0);
const commandsCount = ref(0);
const recentLogs = ref([]);

async function load() {
  const hostsRes = await hostApi.list();
  const hosts = hostsRes.data || [];
  total.value = hosts.length;
  online.value = hosts.filter((h) => h.status === 'online').length;
  offline.value = hosts.filter((h) => h.status !== 'online').length;

  const cmdRes = await commandApi.list();
  commandsCount.value = (cmdRes.data || []).length;

  const logRes = await logApi.list({ pageSize: 15 });
  recentLogs.value = logRes.data?.list || [];
}

onMounted(load);
</script>

<style lang="scss" scoped>
.stat-card {
  text-align: center;
  padding-top: 10px;
  .stat-icon { font-size: 22px; margin-bottom: 2px; }
  .stat-value { font-size: 30px; font-weight: 800; letter-spacing: 1px; }
  .stat-label { font-size: 12px; color: var(--ops-text-2); margin-top: 4px; }
}

.qc-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.qc-item {
  padding: 16px;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  background: var(--ops-bg-3);
  border: 1px solid var(--ops-border);
  transition: all .2s;
  &:hover {
    border-color: var(--accent-blue);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(88,166,255,0.18);
  }
  .qc-icon { font-size: 24px; display: block; margin-bottom: 6px; }
  .qc-text { font-size: 13px; color: var(--ops-text); }
}
</style>
