/**
 * 用户管理路由（仅管理员）
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const audit = require('../utils/audit');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware(), adminOnly);

// 列表
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, role, enabled, last_login_at, created_at FROM users ORDER BY id').all();
  res.json({ code: 0, data: users });
});

// 新增
router.post('/', (req, res) => {
  const { username, password, role = 'user' } = req.body || {};
  if (!username || !password) return res.status(400).json({ code: 400, msg: '账号密码不能为空' });
  if (!['admin', 'user', 'readonly'].includes(role)) {
    return res.status(400).json({ code: 400, msg: '角色不合法' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ code: 400, msg: '账号已存在' });

  const info = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), role);

  audit.log({ user_id: req.user.id, username: req.user.username, action: 'create-user', detail: `新建用户 ${username}` });
  res.json({ code: 0, data: { id: info.lastInsertRowid } });
});

// 更新
router.put('/:id', (req, res) => {
  const { role, enabled } = req.body || {};
  const fields = [];
  const values = [];
  if (role !== undefined) {
    if (!['admin', 'user', 'readonly'].includes(role)) {
      return res.status(400).json({ code: 400, msg: '角色不合法' });
    }
    fields.push('role = ?');
    values.push(role);
  }
  if (enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(enabled ? 1 : 0);
  }
  if (!fields.length) return res.status(400).json({ code: 400, msg: '无字段更新' });
  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'update-user', detail: `更新用户 ${req.params.id}` });
  res.json({ code: 0, msg: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ code: 400, msg: '不能删除自己' });
  const info = db.prepare('DELETE FROM users WHERE id = ? AND role != "admin"').run(id);
  if (info.changes === 0) return res.status(404).json({ code: 404, msg: '未找到或禁止删除' });
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'delete-user', detail: `删除用户 ${id}` });
  res.json({ code: 0, msg: '删除成功' });
});

// 重置密码
router.post('/:id/reset-password', (req, res) => {
  const { password = '123456' } = req.body || {};
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'reset-password', detail: `重置用户 ${req.params.id} 密码` });
  res.json({ code: 0, msg: '已重置为 ' + password });
});

module.exports = router;
