<template>
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑主机' : '新增主机'" width="560px" destroy-on-close>
    <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
      <el-form-item label="名称" prop="name"><el-input v-model="form.name" placeholder="如：生产-Nginx-01" /></el-form-item>
      <el-form-item label="IP 地址" prop="ip"><el-input v-model="form.ip" placeholder="192.168.1.10" /></el-form-item>
      <el-form-item label="端口" prop="port"><el-input-number v-model="form.port" :min="1" :max="65535" style="width:100%" /></el-form-item>
      <el-form-item label="协议" prop="protocol">
        <el-select v-model="form.protocol" style="width:100%">
          <el-option label="SSH" value="ssh" />
          <el-option label="VNC" value="vnc" />
          <el-option label="RDP" value="rdp" />
          <el-option label="TCP" value="tcp" />
        </el-select>
      </el-form-item>
      <el-form-item label="账号"><el-input v-model="form.username" placeholder="SSH 用户名，VNC/RDP 可选" /></el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" show-password placeholder="留空则不保存" />
      </el-form-item>
      <el-form-item label="私钥">
        <el-input v-model="form.private_key" type="textarea" :rows="4" placeholder="PEM 格式私钥，SSH 可选" />
      </el-form-item>
      <el-form-item label="分组">
        <el-select v-model="form.group_id" clearable placeholder="未分组" style="width:100%">
          <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-tag-input v-model="tagsArr" placeholder="回车添加标签" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="授权用户" v-if="userStore.isAdmin">
        <el-select v-model="form.allowed_users" multiple placeholder="留空表示所有用户可访问" style="width:100%">
          <el-option v-for="u in users" :key="u.id" :label="u.username" :value="u.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../../stores/user';
import { groupApi, userApi } from '../../api';

const props = defineProps({
  visible: { type: Boolean, default: false },
  host: { type: Object, default: null }
});
const emit = defineEmits(['update:visible', 'save']);

const userStore = useUserStore();
const formRef = ref();
const groups = ref([]);
const users = ref([]);

const form = ref({
  name: '', ip: '', port: 22, protocol: 'ssh', username: '', password: '',
  private_key: '', group_id: null, remark: '', tags: [], allowed_users: []
});
const tagsArr = ref([]);

const isEdit = computed(() => !!props.host);

// Vue 3.5+ 禁止直接对 prop 用 v-model，加一个 computed 作为本地双向绑定
const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
});

const rules = {
  name: [{ required: true, message: '请输入主机名称', trigger: 'blur' }],
  ip: [{ required: true, message: '请输入 IP', trigger: 'blur' },
    { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: 'IP 格式不正确', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  protocol: [{ required: true, message: '请选择协议', trigger: 'change' }]
};

watch(() => props.visible, (v) => {
  if (!v) return;
  if (props.host) {
    // 编辑：先拉解密后的详情
    loadDetail();
  } else {
    form.value = {
      name: '', ip: '', port: 22, protocol: 'ssh', username: '', password: '',
      private_key: '', group_id: null, remark: '', tags: [], allowed_users: []
    };
    tagsArr.value = [];
  }
});

async function loadDetail() {
  // 从列表数据先填（密码/私钥会被脱敏），不强制拉详情避免无权限
  if (props.host) {
    const h = props.host;
    form.value = {
      name: h.name, ip: h.ip, port: h.port, protocol: h.protocol,
      username: h.username || '',
      password: h.password === '******' ? '' : (h.password || ''),
      private_key: h.private_key === '******' ? '' : (h.private_key || ''),
      group_id: h.group_id, remark: h.remark || '',
      tags: [],
      allowed_users: []
    };
    try {
      form.value.tags = JSON.parse(h.tags || '[]');
      tagsArr.value = form.value.tags;
    } catch {}
  }
}

async function onSubmit() {
  await formRef.value.validate();
  const payload = { ...form.value, tags: tagsArr.value };
  if (isEdit.value) {
    emit('save', { id: props.host.id, ...payload });
  } else {
    emit('save', payload);
  }
  emit('update:visible', false);
}

onMounted(async () => {
  try {
    const [g, u] = await Promise.all([groupApi.list(), userApi.list()]);
    groups.value = g.data || [];
    users.value = u.data || [];
  } catch {}
});
</script>

<style lang="scss" scoped>
:deep(.el-tag-input) { width: 100%; }
</style>
