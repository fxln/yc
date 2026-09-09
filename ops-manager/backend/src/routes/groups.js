/**
 * 分组管理（所有登录用户可读，管理员可写）
 */
const express = require('express');
const db = require('../db/database');
const audit = require('../utils/audit');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware(), (req, res) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY sort ASC, id ASC').all();
  res.json({ code: 0, data: groups });
});

router.post('/', authMiddleware(), adminOnly, (req, res) => {
  const { name, sort = 0 } = req.body || {};
  if (!name) return res.status(400).json({ code: 400, msg: '分组名称不能为空' });
  const info = db.prepare('INSERT INTO groups (name, sort) VALUES (?, ?)').run(name, sort);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'create-group', detail: name });
  res.json({ code: 0, data: { id: info.lastInsertRowid } });
});

router.put('/:id', authMiddleware(), adminOnly, (req, res) => {
  const { name, sort } = req.body || {};
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (sort !== undefined) { fields.push('sort = ?'); values.push(sort); }
  if (!fields.length) return res.status(400).json({ code: 400, msg: '无字段更新' });
  values.push(req.params.id);
  db.prepare(`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', authMiddleware(), adminOnly, (req, res) => {
  // 移动该分组下的主机到默认分组
  db.prepare('UPDATE hosts SET group_id = NULL WHERE group_id = ?').run(req.params.id);
  db.prepare('UPDATE commands SET group_id = NULL WHERE group_id = ?').run(req.params.id);
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'delete-group', detail: req.params.id });
  res.json({ code: 0, msg: '删除成功' });
});

module.exports = router;
