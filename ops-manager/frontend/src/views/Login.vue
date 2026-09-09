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
}
.login-card {
  width: 400px;
  padding: 44px 36px 36px;
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
}
.login-header { text-align: center; margin-bottom: 32px; }
.logo { font-size: 48px; margin-bottom: 8px; filter: drop-shadow(0 0 16px rgba(88,166,255,0.5)); }
h1 {
  margin: 8px 0 4px;
  font-size: 26px;
  font-weight: 800;
  background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-purple) 50%, var(--accent-pink) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
p { margin: 0; font-size: 13px; color: var(--ops-text-2); letter-spacing: 1px; }
.btn-login { width: 100%; height: 42px; font-size: 15px; letter-spacing: 4px; }
.tip {
  margin-top: 18px; text-align: center; font-size: 12px;
  color: var(--accent-cyan); opacity: .7;
}
</style>
