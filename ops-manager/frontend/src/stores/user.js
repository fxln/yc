import { defineStore } from 'pinia';
import { authApi } from '../api';

// 简单手动持久化（移除了 pinia-plugin-persistedstate 以兼容 pinia@2）
function loadUser() {
  try { return JSON.parse(localStorage.getItem('ops_user')); } catch { return null; }
}
function loadToken() { return localStorage.getItem('ops_token') || ''; }

export const useUserStore = defineStore('user', {
  state: () => ({
    token: loadToken(),
    info: loadUser()
  }),
  getters: {
    isLogin: (s) => !!s.token,
    isAdmin: (s) => s.info?.role === 'admin',
    isUser: (s) => s.info?.role === 'user',
    isReadonly: (s) => s.info?.role === 'readonly'
  },
  actions: {
    async login(payload) {
      const res = await authApi.login(payload);
      this.token = res.data.token;
      this.info = res.data.user;
      localStorage.setItem('ops_token', this.token);
      localStorage.setItem('ops_user', JSON.stringify(this.info));
    },
    async me() {
      const res = await authApi.me();
      this.info = res.data;
      localStorage.setItem('ops_user', JSON.stringify(this.info));
    },
    logout() {
      authApi.logout().catch(() => {});
      this.token = '';
      this.info = null;
      localStorage.removeItem('ops_token');
      localStorage.removeItem('ops_user');
    }
  }
});
