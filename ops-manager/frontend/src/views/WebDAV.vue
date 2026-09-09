<template>
  <div class="webdav-page">
    <el-card>
      <div class="desc">
        <p>内置 WebDAV 服务端口：<el-tag>8081</el-tag>（可通过环境变量 WEBDAV_PORT 修改）</p>
        <p>存储根目录：<code>/data/webdav</code>（Docker Volume 已挂载，数据持久化）</p>
        <p>第三方客户端连接示例：<code>http://your-server-ip:8081/</code></p>
      </div>
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>WebDAV 账号</span>
          <el-button type="primary" size="small" :icon="Plus" @click="onAdd">新增账号</el-button>
        </div>
      </template>
      <el-table :data="accounts" size="default" stripe>
        <el-table-column prop="username" label="账号" width="160" />
        <el-table-column label="权限" width="120">
          <template #default="{ row }">
            <el-tag :type="row.readonly ? 'info' : 'success'" size="small">{{ row.readonly ? '只读' : '读写' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.enabled" type="success" size="small">启用</el-tag>
            <el-tag v-else type="danger" size="small">禁用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button-group size="small">
              <el-button @click="togglePwd(row)">重置密码</el-button>
              <el-button @click="onEdit(row)">编辑</el-button>
              <el-button type="danger" @click="onRemove(row)">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑账号' : '新增账号'" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="账号"><el-input v-model="form.username" :disabled="isEdit" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="权限">
          <el-switch v-model="form.readonly" active-text="只读" inactive-text="读写" inline-prompt />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { webdavApi } from '../api';

const accounts = ref([]);
const dialogVisible = ref(false);
const current = ref(null);
const form = ref({ username: '', password: '', readonly: false, enabled: true, remark: '' });
const isEdit = computed(() => !!current.value);

async function load() { accounts.value = (await webdavApi.list()).data || []; }

function onAdd() { current.value = null; form.value = { username: '', password: '', readonly: false, enabled: true, remark: '' }; dialogVisible.value = true; }
function onEdit(row) { current.value = row; form.value = { ...row, password: '' }; dialogVisible.value = true; }

async function onSave() {
  if (!form.value.username || (!isEdit.value && !form.value.password)) {
    return ElMessage.warning('账号密码必填');
  }
  if (isEdit.value) {
    const payload = { readonly: form.value.readonly ? 1 : 0, enabled: form.value.enabled ? 1 : 0, remark: form.value.remark };
    if (form.value.password) payload.password = form.value.password;
    await webdavApi.update(current.value.id, payload);
  } else {
    await webdavApi.create(form.value);
  }
  dialogVisible.value = false;
  ElMessage.success('保存成功');
  load();
}

async function onRemove(row) {
  await ElMessageBox.confirm(`删除 WebDAV 账号 ${row.username} ?`, '提示', { type: 'warning' });
  await webdavApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}

async function togglePwd(row) {
  await ElMessageBox.prompt('请输入新密码', `重置 ${row.username} 密码`).then(async ({ value }) => {
    await webdavApi.update(row.id, { password: value });
    ElMessage.success('已重置');
  }).catch(() => {});
}

onMounted(load);
</script>

<style lang="scss" scoped>
.webdav-page { padding: 16px; }
.table-card { margin-top: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.desc p { margin: 4px 0; font-size: 13px; color: var(--ops-text-secondary); }
</style>
