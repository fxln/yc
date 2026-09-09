/**
 * API 模块 - 按业务分文件
 */
import http from '../utils/http';

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  logout: () => http.post('/auth/logout'),
  changePassword: (data) => http.post('/auth/change-password', data)
};

export const userApi = {
  list: () => http.get('/users'),
  create: (data) => http.post('/users', data),
  update: (id, data) => http.put(`/users/${id}`, data),
  remove: (id) => http.delete(`/users/${id}`),
  resetPassword: (id, data) => http.post(`/users/${id}/reset-password`, data)
};

export const groupApi = {
  list: () => http.get('/groups'),
  create: (data) => http.post('/groups', data),
  update: (id, data) => http.put(`/groups/${id}`, data),
  remove: (id) => http.delete(`/groups/${id}`)
};

export const hostApi = {
  list: (params) => http.get('/hosts', { params }),
  detail: (id) => http.get(`/hosts/${id}`),
  create: (data) => http.post('/hosts', data),
  update: (id, data) => http.put(`/hosts/${id}`, data),
  remove: (id) => http.delete(`/hosts/${id}`),
  batchDelete: (ids) => http.post('/hosts/batch-delete', { ids }),
  export: () => http.get('/hosts/export/json'),
  import: (data) => http.post('/hosts/import/json', { data })
};

export const commandApi = {
  list: (params) => http.get('/commands', { params }),
  create: (data) => http.post('/commands', data),
  update: (id, data) => http.put(`/commands/${id}`, data),
  remove: (id) => http.delete(`/commands/${id}`),
  batchDelete: (ids) => http.post('/commands/batch-delete', { ids }),
  export: () => http.get('/commands/export/json'),
  import: (data) => http.post('/commands/import/json', { data })
};

export const logApi = {
  list: (params) => http.get('/logs', { params }),
  clear: () => http.delete('/logs')
};

export const webdavApi = {
  list: () => http.get('/webdav'),
  create: (data) => http.post('/webdav', data),
  update: (id, data) => http.put(`/webdav/${id}`, data),
  remove: (id) => http.delete(`/webdav/${id}`)
};

export const sftpApi = {
  readdir: (hostId, targetPath) => http.get(`/sftp/${hostId}/readdir`, { params: { path: targetPath } }),
  stat: (hostId, targetPath) => http.get(`/sftp/${hostId}/stat`, { params: { path: targetPath } }),
  mkdir: (hostId, targetPath) => http.post(`/sftp/${hostId}/mkdir`, { path: targetPath }),
  rename: (hostId, from, to) => http.post(`/sftp/${hostId}/rename`, { from, to }),
  remove: (hostId, targetPath) => http.delete(`/sftp/${hostId}/delete`, { params: { path: targetPath } }),
  upload: (hostId, formData) => http.post(`/sftp/${hostId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000
  }),
  downloadUrl: (hostId, targetPath) => `/api/sftp/${hostId}/download?path=${encodeURIComponent(targetPath)}&token=${localStorage.getItem('ops_token')}`,
  preview: (hostId, targetPath) => http.get(`/sftp/${hostId}/preview`, { params: { path: targetPath }, responseType: 'blob' })
};

// WebSocket URL 构建
export function wsUrl(path) {
  const token = localStorage.getItem('ops_token') || '';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${path}?token=${token}`;
}
