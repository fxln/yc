<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">⚙️</div>
        <h1>OpsManager</h1>
        <p>Web 远程运维管理系统</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="0" class="login-form">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="密码" size="large" :prefix-icon="Lock"
            @keyup.enter="onSubmit" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" class="btn-login" :loading="loading" @click="onSubmit">登 录</el-button>
        </el-form-item>
      </el-form>
      <div class="tip">默认账号 admin / admin123</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

const form = ref({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};
const loading = ref(false);
const formRef = ref();

async function onSubmit() {
  try {
    await formRef.value.validate();
    loading.value = true;
    await userStore.login(form.value);
    ElMessage.success('登录成功');
    router.push('/');
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.login-wrapper {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 30%, #1a2332 0%, #0d1117 60%);
}
.login-card {
  width: 380px;
  padding: 40px 32px;
  background: var(--ops-bg-secondary);
  border: 1px solid var(--ops-border);
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
.login-header { text-align: center; margin-bottom: 28px; }
.logo { font-size: 42px; }
h1 { margin: 8px 0 4px; font-size: 24px; color: var(--ops-primary-hover); }
p { margin: 0; font-size: 13px; color: var(--ops-text-secondary); }
.btn-login { width: 100%; }
.tip { margin-top: 16px; text-align: center; font-size: 12px; color: var(--ops-text-secondary); }
</style>
