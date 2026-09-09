<template>
  <div class="logs-page">
    <el-card class="accent-pink">
      <div class="filter-row">
        <el-input v-model="filters.keyword" placeholder="搜索用户名/主机/详情" clearable style="width:260px" :prefix-icon="Search" />
        <el-select v-model="filters.action" placeholder="操作类型" clearable style="width:140px">
          <el-option v-for="a in actions" :key="a" :label="a" :value="a" />
        </el-select>
        <el-input v-model="filters.username" placeholder="用户名" clearable style="width:140px" />
        <el-date-picker v-model="dateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" style="width:360px" />
        <el-button type="danger" :icon="Delete" @click="onClear" v-if="userStore.isAdmin">清空日志</el-button>
      </div>
    </el-card>

    <el-card class="accent-blue" style="margin-top:16px">
      <el-table :data="list" size="default" stripe>
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="host_name" label="主机" width="140" />
        <el-table-column prop="protocol" label="协议" width="90">
          <template #default="{ row }">
            <el-tag size="small" :class="`protocol-${row.protocol || 'tcp'}`">{{ (row.protocol || '-').toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作" width="140">
          <template #default="{ row }">
            <el-tag :type="actionTag(row.action)" size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <span :class="row.status === 'fail' ? 'log-fail' : 'log-success'" style="font-weight:600">
              {{ row.status === 'success' ? '✅ 成功' : '❌ 失败' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" show-overflow-tooltip />
      </el-table>
      <el-pagination style="margin-top:12px;justify-content:flex-end;display:flex"
        v-model:current-page="page" v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next"
        @size-change="load" @current-change="load" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '../stores/user';
import { logApi } from '../api';
import { Search, Delete } from '@element-plus/icons-vue';

const userStore = useUserStore();
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const filters = ref({ keyword: '', action: '', username: '' });
const dateRange = ref(null);

const actions = ['login', 'logout', 'connect', 'disconnect', 'exec', 'upload', 'download', 'delete', 'rename', 'mkdir', 'webdav', 'create-user', 'update-user', 'delete-user', 'reset-password', 'create-host', 'update-host', 'delete-host', 'import-hosts', 'import-commands'];

function actionTag(a) {
  if (a.includes('login')) return 'success';
  if (a.includes('connect')) return 'primary';
  if (a.includes('upload') || a.includes('download') || a.includes('exec')) return 'warning';
  if (a.includes('delete')) return 'danger';
  return 'info';
}

async function load() {
  const params = {
    ...filters.value,
    page: page.value, pageSize: pageSize.value
  };
  if (dateRange.value) {
    params.start = dateRange.value[0];
    params.end = dateRange.value[1];
  }
  const res = await logApi.list(params);
  list.value = res.data?.list || [];
  total.value = res.data?.total || 0;
}

async function onClear() {
  await ElMessageBox.confirm('确定清空所有日志？此操作不可恢复', '提示', { type: 'warning' });
  await logApi.clear();
  ElMessage.success('已清空');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.logs-page { padding: 16px; }
.filter-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
/* 审计状态文字色：log-success / log-fail 已收归 theme.scss */
</style>
