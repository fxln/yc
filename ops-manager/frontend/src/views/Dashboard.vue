<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ total }}</div>
          <div class="stat-label">主机总数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card success">
          <div class="stat-value">{{ online }}</div>
          <div class="stat-label">在线主机</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card danger">
          <div class="stat-value">{{ offline }}</div>
          <div class="stat-label">离线主机</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ commandsCount }}</div>
          <div class="stat-label">快捷命令</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="chart-card" header="最近活动日志" style="margin-top:16px">
      <el-table :data="recentLogs" size="small">
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="host_name" label="主机" width="140" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column prop="detail" label="详情" show-overflow-tooltip />
      </el-table>
    </el-card>
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
.stat-card { text-align: center; .stat-value { font-size: 28px; font-weight: 700; color: var(--ops-primary-hover); } .stat-label { font-size: 12px; color: var(--ops-text-secondary); margin-top: 6px; }
  &.success .stat-value { color: var(--ops-success); }
  &.danger .stat-value { color: var(--ops-danger); }
}
</style>
