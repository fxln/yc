/**
 * WebDAV 账号设置（管理员）
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const audit = require('../utils/audit');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware(), adminOnly);

router.get('/', (req, res) => {
  const data = db.prepare('SELECT id, username, readonly, enabled, remark FROM webdav_config ORDER BY id').all();
  res.json({ code: 0, data });
});

router.post('/', (req, res) => {
  const { username, password, readonly = 0, remark = '' } = req.body || {};
  if (!username || !password) return res.status(400).json({ code: 400, msg: '账号密码必填' });
  const exists = db.prepare('SELECT id FROM webdav_config WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ code: 400, msg: '账号已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO webdav_config (username, password, readonly, remark) VALUES (?, ?, ?, ?)')
    .run(username, hash, readonly ? 1 : 0, remark);
  res.json({ code: 0, data: { id: info.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { password, readonly, enabled, remark } = req.body || {};
  const fields = [];
  const values = [];
  if (password) { fields.push('password = ?'); values.push(bcrypt.hashSync(password, 10)); }
  if (readonly !== undefined) { fields.push('readonly = ?'); values.push(readonly ? 1 : 0); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (remark !== undefined) { fields.push('remark = ?'); values.push(remark); }
  if (!fields.length) return res.status(400).json({ code: 400, msg: '无字段更新' });
  values.push(req.params.id);
  db.prepare(`UPDATE webdav_config SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM webdav_config WHERE id = ?').run(req.params.id);
  res.json({ code: 0, msg: '删除成功' });
});

// 校验账号密码（供 webdav 服务调用）
function verifyAccount(username, password) {
  const row = db.prepare('SELECT * FROM webdav_config WHERE username = ? AND enabled = 1').get(username);
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password)) return null;
  return row;
}

module.exports = { router, verifyAccount };
