<template>
  <div class="users-page">
    <el-card class="accent-orange">
      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索账号" clearable style="width:260px" />
        <el-button type="primary" :icon="Plus" @click="onAdd">新增用户</el-button>
      </div>
    </el-card>

    <el-card class="accent-blue" style="margin-top:16px">
      <el-table :data="filtered" size="default" stripe>
        <el-table-column prop="username" label="账号" width="140" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTag(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.enabled" type="success" size="small">启用</el-tag>
            <el-tag v-else type="danger" size="small">禁用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="最后登录" width="180" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <el-button-group size="small">
              <el-select v-model="row.role" @change="onRoleChange(row)" style="width:100px">
                <el-option label="管理员" value="admin" />
                <el-option label="运维" value="user" />
                <el-option label="只读" value="readonly" />
              </el-select>
              <el-button @click="toggleEnable(row)">{{ row.enabled ? '禁用' : '启用' }}</el-button>
              <el-button @click="resetPwd(row)">重置密码</el-button>
              <el-button type="danger" @click="onRemove(row)" :disabled="row.id === userStore.info.id">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '../stores/user';
import { userApi } from '../api';

const userStore = useUserStore();
const users = ref([]);
const keyword = ref('');

const filtered = computed(() => users.value.filter((u) => u.username.includes(keyword.value)));

function roleLabel(r) { return { admin: '管理员', user: '运维用户', readonly: '只读用户' }[r]; }
function roleTag(r) {
  // 角色 tag 映射到全局 el-tag 类型 —— admin=粉(danger 红) / user=蓝(primary) / readonly=青(info)
  return { admin: 'danger', user: '', readonly: 'info' }[r];
}

async function load() { users.value = (await userApi.list()).data || []; }

async function onAdd() {
  ElMessageBox.prompt('请输入账号密码，角色默认运维用户', '新增用户', {
    inputPlaceholder: 'username password',
    inputValidator: (v) => {
      const parts = (v || '').trim().split(/\s+/);
      if (parts.length !== 2) return '请按 "username password" 格式输入';
      if (parts[1].length < 6) return '密码至少 6 位';
      return true;
    }
  }).then(async ({ value }) => {
    const [username, password] = value.trim().split(/\s+/);
    await userApi.create({ username, password, role: 'user' });
    ElMessage.success('已新增');
    load();
  }).catch(() => {});
}

async function onRoleChange(row) { await userApi.update(row.id, { role: row.role }); ElMessage.success('已更新'); }
async function toggleEnable(row) { await userApi.update(row.id, { enabled: row.enabled ? 0 : 1 }); ElMessage.success('已更新'); row.enabled = !row.enabled; }
async function resetPwd(row) {
  await ElMessageBox.confirm(`将 ${row.username} 密码重置为 123456？`, '提示', { type: 'warning' });
  await userApi.resetPassword(row.id, { password: '123456' });
  ElMessage.success('已重置为 123456');
}
async function onRemove(row) {
  await ElMessageBox.confirm(`删除用户 ${row.username}？`, '提示', { type: 'warning' });
  await userApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.users-page { padding: 16px; }
.filter-row { display: flex; gap: 10px; align-items: center; }
</style>
