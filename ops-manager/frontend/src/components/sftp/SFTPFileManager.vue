<template>
  <div class="sftp-manager" @dragover.prevent @drop.prevent="onDrop">
    <!-- 面包屑路径 -->
    <div class="path-bar">
      <span class="clickable" @click="goPath('/')">/</span>
      <template v-for="(seg, i) in pathSegments" :key="i">
        <span>/</span>
        <span class="clickable" @click="goPath(buildPath(i + 1))">{{ seg }}</span>
      </template>
    </div>

    <!-- 操作按钮 -->
    <div class="file-toolbar">
      <el-button size="small" :icon="Refresh" @click="loadDir">刷新</el-button>
      <el-button size="small" :icon="FolderAdd" @click="onMkdir">新建目录</el-button>
      <el-button size="small" :icon="Upload" @click="triggerUpload">上传</el-button>
      <input type="file" ref="fileInput" multiple style="display:none" @change="onUpload" />
    </div>

    <!-- 文件列表 -->
    <div class="file-list" ref="listRef">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="!files.length" class="empty">空目录</div>
      <div
        v-for="f in files"
        :key="f.name"
        class="file-item"
        :class="{ directory: f.type === 'directory', selected: selected?.name === f.name }"
        @click="select(f)"
        @dblclick="enterOrDownload(f)"
        draggable="true"
        @dragstart="onDragStart($event, f)"
      >
        <el-icon class="icon">
          <Folder v-if="f.type === 'directory'" />
          <Document v-else />
        </el-icon>
        <span class="name" :title="f.name">{{ f.name }}</span>
        <span class="size" v-if="f.type !== 'directory'">{{ formatSize(f.size) }}</span>
        <span class="time">{{ formatTime(f.mtime) }}</span>
        <div class="actions" v-if="selected?.name === f.name">
          <el-button text size="small" :icon="Download" @click.stop="download(f)" v-if="canDownload">下载</el-button>
          <el-button text size="small" :icon="View" @click.stop="preview(f)" v-if="f.type !== 'directory'">预览</el-button>
          <el-button text size="small" :icon="Edit" @click.stop="rename(f)">重命名</el-button>
          <el-button text size="small" :icon="Delete" @click.stop="remove(f)">删除</el-button>
        </div>
      </div>
    </div>

    <!-- 拖拽提示 -->
    <div class="drop-hint" v-if="showDropHint">松开鼠标以上传文件</div>

    <!-- 上传进度 -->
    <div class="upload-progress" v-if="uploading">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: uploadProgress + '%' }" />
      </div>
      <div class="progress-text">{{ uploadFile?.name }} {{ uploadProgress }}%</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { sftpApi } from '../../api';

const props = defineProps({
  hostId: { type: Number, required: true },
  canUpload: { type: Boolean, default: true },
  canDownload: { type: Boolean, default: true }
});

const currentPath = ref('/');
const files = ref([]);
const loading = ref(false);
const selected = ref(null);
const fileInput = ref(null);
const showDropHint = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadFile = ref(null);

const pathSegments = computed(() => currentPath.value.split('/').filter(Boolean));

function buildPath(depth) {
  return '/' + pathSegments.value.slice(0, depth).join('/');
}
function goPath(p) { currentPath.value = p; loadDir(); }

async function loadDir() {
  loading.value = true;
  try {
    const res = await sftpApi.readdir(props.hostId, currentPath.value);
    files.value = (res.data || []).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    ElMessage.error(e.message || '读取目录失败');
  } finally {
    loading.value = false;
  }
}

function select(f) { selected.value = f; }
function enterOrDownload(f) {
  if (f.type === 'directory') {
    currentPath.value = currentPath.value === '/' ? '/' + f.name : currentPath.value + '/' + f.name;
    loadDir();
  } else if (props.canDownload) {
    download(f);
  }
}

function download(f) {
  const url = sftpApi.downloadUrl(props.hostId, currentPath.value === '/' ? '/' + f.name : currentPath.value + '/' + f.name);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function preview(f) {
  const targetPath = currentPath.value === '/' ? '/' + f.name : currentPath.value + '/' + f.name;
  const res = await sftpApi.preview(props.hostId, targetPath);
  const text = await res.text();
  ElMessageBox.alert(`<pre style="white-space:pre-wrap;font-size:12px;max-height:400px;overflow:auto;">${escapeHtml(text)}</pre>`,
    f.name, { dangerouslyUseHTMLString: true, customClass: 'preview-box' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function rename(f) {
  ElMessageBox.prompt('请输入新名称', '重命名', { inputValue: f.name }).then(async ({ value }) => {
    const from = currentPath.value === '/' ? '/' + f.name : currentPath.value + '/' + f.name;
    const to = currentPath.value === '/' ? '/' + value : currentPath.value + '/' + value;
    await sftpApi.rename(props.hostId, from, to);
    ElMessage.success('已重命名');
    loadDir();
  }).catch(() => {});
}

function remove(f) {
  ElMessageBox.confirm(`确定删除 ${f.name} ?`, '提示', { type: 'warning' }).then(async () => {
    const targetPath = currentPath.value === '/' ? '/' + f.name : currentPath.value + '/' + f.name;
    await sftpApi.remove(props.hostId, targetPath);
    ElMessage.success('已删除');
    loadDir();
  }).catch(() => {});
}

async function onMkdir() {
  ElMessageBox.prompt('目录名称', '新建目录').then(async ({ value }) => {
    const targetPath = currentPath.value === '/' ? '/' + value : currentPath.value + '/' + value;
    await sftpApi.mkdir(props.hostId, targetPath);
    ElMessage.success('已创建');
    loadDir();
  }).catch(() => {});
}

function triggerUpload() { fileInput.value?.click(); }
function onUpload(e) {
  if (!e.target.files?.length) return;
  handleFiles(e.target.files);
  e.target.value = '';
}
async function handleFiles(fileList) {
  if (!props.canUpload) return;
  uploading.value = true;
  uploadProgress.value = 0;
  for (const f of fileList) {
    uploadFile.value = f;
    const targetPath = currentPath.value === '/' ? '/' + f.name : currentPath.value + '/' + f.name;
    const form = new FormData();
    form.append('file', f);
    form.append('remotePath', targetPath);
    try {
      await sftpApi.upload(props.hostId, form);
      uploadProgress.value = 100;
      ElMessage.success(`${f.name} 上传成功`);
    } catch (err) {
      ElMessage.error(`${f.name} 上传失败: ${err.message}`);
    }
  }
  uploading.value = false;
  loadDir();
}

function onDrop(e) {
  showDropHint.value = false;
  const dt = e.dataTransfer;
  if (!dt?.files?.length) return;
  handleFiles(dt.files);
}
function onDragStart(e, f) {
  // 标记这是远程文件拖出（浏览器不允许直接拖到本地触发下载，此处保留扩展）
  e.dataTransfer.effectAllowed = 'copy';
}

function formatSize(sz) {
  if (!sz && sz !== 0) return '-';
  if (sz < 1024) return sz + ' B';
  if (sz < 1024 * 1024) return (sz / 1024).toFixed(1) + ' KB';
  if (sz < 1024 * 1024 * 1024) return (sz / 1024 / 1024).toFixed(1) + ' MB';
  return (sz / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(loadDir);
</script>

<style lang="scss" scoped>
.sftp-manager { height: 100%; background: var(--ops-bg-2); position: relative; display: flex; flex-direction: column; }
.path-bar { padding: 8px 10px; font-size: 12px; color: var(--ops-text-2); border-bottom: 1px solid var(--ops-border); display: flex; gap: 2px; flex-wrap: wrap;
  .clickable { color: var(--ops-primary); cursor: pointer; &:hover { text-decoration: underline; } } }
.file-toolbar { padding: 6px 8px; border-bottom: 1px solid var(--ops-border); display: flex; gap: 6px; }
.file-list { flex: 1; overflow: auto; padding: 4px; }
.file-item {
  display: grid; grid-template-columns: 24px 1fr 80px 120px auto; align-items: center;
  gap: 8px; padding: 6px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;
  &:hover { background: var(--ops-bg-tertiary); }
  &.selected { background: var(--ops-bg-tertiary); border: 1px solid var(--ops-primary); }
  .icon { font-size: 16px; color: var(--ops-text-2); }
  .directory .icon { color: var(--ops-warning); }
  .directory .name { font-weight: 500; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .size, .time { color: var(--ops-text-2); font-size: 11px; }
  .actions { display: flex; gap: 2px; }
}
.loading, .empty { padding: 20px; text-align: center; color: var(--ops-text-2); font-size: 12px; }
.drop-hint { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(56,139,253,0.15); border: 2px dashed var(--ops-primary); padding: 20px 40px; border-radius: 8px; color: var(--accent-blue); }
.upload-progress { padding: 8px 10px; border-top: 1px solid var(--ops-border); background: var(--ops-bg); }
.progress-bar { height: 4px; background: var(--ops-bg-tertiary); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--ops-primary); transition: width .2s; }
.progress-text { font-size: 11px; color: var(--ops-text-2); margin-top: 4px; }
</style>
