import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

// 统一 API 封装
const http = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// 请求拦截：附加 token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('ops_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// 响应拦截：统一错误处理
http.interceptors.response.use(
  (resp) => {
    const body = resp.data;
    if (body && body.code !== undefined && body.code !== 0) {
      ElMessage.error(body.msg || '请求失败');
      if (body.code === 401) {
        localStorage.removeItem('ops_token');
        router.push('/login');
      }
      return Promise.reject(body);
    }
    return body; // 约定成功响应 = { code: 0, data }
  },
  (err) => {
    const msg = err.response?.data?.msg || err.message || '网络错误';
    if (err.response?.status === 401) {
      localStorage.removeItem('ops_token');
      router.push('/login');
    } else {
      ElMessage.error(msg);
    }
    return Promise.reject(err);
  }
);

export default http;
