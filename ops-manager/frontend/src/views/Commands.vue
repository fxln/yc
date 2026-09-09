<template>
  <div class="commands-page">
    <el-card class="accent-purple">
      <div class="filter-row">
        <el-input v-model="filters.keyword" placeholder="搜索名称/内容/描述" clearable style="width:260px" :prefix-icon="Search" />
        <el-select v-model="filters.os" placeholder="适用系统" clearable style="width:120px">
          <el-option label="Linux" value="linux" />
          <el-option label="Windows" value="windows" />
          <el-option label="通用" value="generic" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="onAdd">新增命令</el-button>
        <el-button :icon="Upload" @click="triggerImport" v-if="userStore.isAdmin">导入 JSON</el-button>
        <input type="file" ref="importInput" style="display:none" accept=".json" @change="onImport" />
        <el-button :icon="Download" @click="onExport">导出</el-button>
        <el-button type="danger" :icon="Delete" :disabled="!selected.length" @click="onBatchDelete" v-if="userStore.isAdmin">批量删除</el-button>
      </div>
    </el-card>

    <el-card class="accent-cyan" style="margin-top:16px">
      <el-table :data="commands" size="default" stripe>
        <el-table-column type="selection" width="44" v-if="userStore.isAdmin" />
        <el-table-column label="收藏" width="70">
          <template #default="{ row }">
            <el-button link type="warning" :icon="StarFilled" v-if="row.favorite" @click="toggleFav(row)" />
            <el-button link :icon="Star" v-else @click="toggleFav(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" width="160" />
        <el-table-column prop="content" label="命令内容" show-overflow-tooltip />
        <el-table-column label="变量" width="80">
          <template #default="{ row }">
            <el-tag v-if="hasVars(row.content)" size="small" type="warning">含变量</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="os" label="系统" width="80">
          <template #default="{ row }"><el-tag size="small">{{ row.os?.toUpperCase() }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group size="small">
              <el-button type="primary" @click="previewCmd(row)">预览</el-button>
              <el-button @click="onEdit(row)">编辑</el-button>
              <el-button type="danger" @click="onRemove(row)" v-if="userStore.isAdmin">删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑命令' : '新增命令'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="命令内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="使用 ${变量名} 占位符，如：ping ${ip}" />
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="适用系统">
          <el-select v-model="form.os" style="width:100%">
            <el-option label="Linux" value="linux" />
            <el-option label="Windows" value="windows" />
            <el-option label="通用" value="generic" />
          </el-select>
        </el-form-item>
        <el-form-item label="收藏">
          <el-switch v-model="form.favorite" />
        </el-form-item>
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
import { useUserStore } from '../stores/user';
import { commandApi } from '../api';

const userStore = useUserStore();

const commands = ref([]);
const filters = ref({ keyword: '', os: '' });
const selected = ref([]);
const dialogVisible = ref(false);
const current = ref(null);
const form = ref({ name: '', content: '', description: '', os: 'linux', favorite: false });
const importInput = ref(null);

const isEdit = computed(() => !!current.value);

function hasVars(content) { return /\$\{\w+\}/.test(content); }

async function load() {
  const res = await commandApi.list(filters.value);
  commands.value = res.data || [];
}

function onAdd() { current.value = null; form.value = { name: '', content: '', description: '', os: 'linux', favorite: false }; dialogVisible.value = true; }
function onEdit(row) { current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function onSave() {
  if (!form.value.name || !form.value.content) return ElMessage.warning('名称和命令内容必填');
  if (isEdit.value) await commandApi.update(current.value.id, form.value);
  else await commandApi.create(form.value);
  dialogVisible.value = false;
  ElMessage.success('保存成功');
  load();
}

async function onRemove(row) {
  await ElMessageBox.confirm(`删除命令 ${row.name} ?`, '提示', { type: 'warning' });
  await commandApi.remove(row.id);
  ElMessage.success('已删除');
  load();
}

async function onBatchDelete() {
  await ElMessageBox.confirm(`批量删除 ${selected.value.length} 条命令？`, '提示', { type: 'warning' });
  await commandApi.batchDelete(selected.value.map((x) => x.id));
  ElMessage.success('批量删除成功');
  load();
}

async function toggleFav(row) {
  await commandApi.update(row.id, { favorite: row.favorite ? 0 : 1 });
  row.favorite = !row.favorite;
}

function previewCmd(row) {
  ElMessageBox.alert(
    `<div style="font-family:Menlo,Consolas,monospace;background:#0d1117;color:#c9d1d9;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;border-left:3px solid #58a6ff;">${row.content}</div>
     ${hasVars(row.content) ? '<div style="margin-top:8px;color:#ffa657;font-size:12px;">⚠ 包含变量占位符，执行时会弹出参数填写框</div>' : ''}`,
    row.name, { dangerouslyUseHTMLString: true }
  );
}

function triggerImport() { importInput.value?.click(); }
async function onImport(e) {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    await commandApi.import(data);
    ElMessage.success('导入成功'); load();
  } catch (err) { ElMessage.error(err.message); }
  e.target.value = '';
}
async function onExport() {
  const res = await commandApi.export();
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `commands-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<style lang="scss" scoped>
.commands-page { padding: 16px; }
.filter-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
</style>
