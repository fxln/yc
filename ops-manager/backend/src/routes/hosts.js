/**
 * 主机管理：增删改查 + 搜索 + 心跳 + 导入导出
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db/database');
const audit = require('../utils/audit');
const permission = require('../utils/permission');
const { authMiddleware, adminOnly, atLeastUser } = require('../middleware/auth');

const router = express.Router();

// 加密敏感字段（可逆，方便 SFTP/SSH 连接时解密）
function encrypt(text, key) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.alloc(32, key), iv);
  let enc = cipher.update(text, 'utf8', 'base64');
  enc += cipher.final('base64');
  return iv.toString('base64') + ':' + enc;
}
function decrypt(text, key) {
  if (!text) return text;
  const [iv, data] = text.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.alloc(32, key), Buffer.from(iv, 'base64'));
  let dec = decipher.update(Buffer.from(data, 'base64'), null, 'utf8');
  dec += decipher.final('utf8');
  return dec;
}
const CRYPTO_KEY = process.env.HOST_SECRET || 'ops-manager-host-secret-key-32bytes!!';

router.use(authMiddleware());

// 列表（按权限过滤）
router.get('/', (req, res) => {
  const { keyword, protocol, status, group_id } = req.query;
  let sql = 'SELECT * FROM hosts WHERE 1=1';
  const args = [];
  if (keyword) {
    sql += ' AND (name LIKE ? OR ip LIKE ? OR remark LIKE ?)';
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (protocol) { sql += ' AND protocol = ?'; args.push(protocol); }
  if (status) { sql += ' AND status = ?'; args.push(status); }
  if (group_id) { sql += ' AND group_id = ?'; args.push(group_id); }
  sql += ' ORDER BY id DESC';

  let hosts = db.prepare(sql).all(...args);
  hosts = permission.filterHosts(hosts, req.user);

  // 对非管理员隐藏密码/私钥
  hosts = hosts.map((h) => ({
    ...h,
    password: h.password ? '******' : '',
    private_key: h.private_key ? '******' : ''
  }));
  res.json({ code: 0, data: hosts });
});

// 详情（返回解密后的凭据，仅授权用户）
router.get('/:id', (req, res) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(req.params.id);
  if (!host) return res.status(404).json({ code: 404, msg: '主机不存在' });
  if (!permission.canAccessHost(req.user.id, req.user.role, host)) {
    return res.status(403).json({ code: 403, msg: '无权访问该主机' });
  }
  if (req.user.role !== 'admin') {
    host.password = decrypt(host.password, CRYPTO_KEY);
    host.private_key = decrypt(host.private_key, CRYPTO_KEY);
  }
  res.json({ code: 0, data: host });
});

// 新增
router.post('/', atLeastUser, (req, res) => {
  const {
    name, ip, port, protocol, username, password, private_key,
    group_id, remark, tags, allowed_users
  } = req.body || {};
  if (!name || !ip || !port || !protocol) {
    return res.status(400).json({ code: 400, msg: '必填字段不全' });
  }
  if (!['ssh', 'vnc', 'rdp', 'tcp'].includes(protocol)) {
    return res.status(400).json({ code: 400, msg: '协议不合法' });
  }

  const encPassword = encrypt(password || '', CRYPTO_KEY);
  const encKey = encrypt(private_key || '', CRYPTO_KEY);
  const info = db.prepare(
    `INSERT INTO hosts (name, ip, port, protocol, username, password, private_key, group_id, remark, tags, allowed_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name, ip, port, protocol, username || null, encPassword || null, encKey || null,
    group_id || null, remark || null, JSON.stringify(tags || []),
    req.user.role === 'admin' ? JSON.stringify(allowed_users || []) : JSON.stringify([req.user.id])
  );
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'create-host', detail: name });
  res.json({ code: 0, data: { id: info.lastInsertRowid } });
});

// 更新
router.put('/:id', atLeastUser, (req, res) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(req.params.id);
  if (!host) return res.status(404).json({ code: 404, msg: '主机不存在' });
  if (!permission.canAccessHost(req.user.id, req.user.role, host)) {
    return res.status(403).json({ code: 403, msg: '无权编辑该主机' });
  }
  const fields = [];
  const values = [];
  const updatable = ['name', 'ip', 'port', 'protocol', 'username', 'group_id', 'remark', 'tags'];
  updatable.forEach((k) => {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(k === 'tags' ? JSON.stringify(req.body[k] || []) : req.body[k]);
    }
  });
  // 密码/私钥单独加密写入
  if (req.body.password !== undefined) {
    fields.push('password = ?');
    values.push(encrypt(req.body.password || '', CRYPTO_KEY));
  }
  if (req.body.private_key !== undefined) {
    fields.push('private_key = ?');
    values.push(encrypt(req.body.private_key || '', CRYPTO_KEY));
  }
  if (req.user.role === 'admin' && req.body.allowed_users !== undefined) {
    fields.push('allowed_users = ?');
    values.push(JSON.stringify(req.body.allowed_users));
  }
  fields.push("updated_at = datetime('now','localtime')");
  values.push(req.params.id);
  db.prepare(`UPDATE hosts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'update-host', detail: host.name });
  res.json({ code: 0, msg: '更新成功' });
});

// 删除 / 批量删除
router.delete('/:id', atLeastUser, (req, res) => {
  const host = db.prepare('SELECT * FROM hosts WHERE id = ?').get(req.params.id);
  if (!host) return res.status(404).json({ code: 404, msg: '主机不存在' });
  if (!permission.canAccessHost(req.user.id, req.user.role, host)) {
    return res.status(403).json({ code: 403, msg: '无权删除' });
  }
  db.prepare('DELETE FROM hosts WHERE id = ?').run(req.params.id);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'delete-host', detail: host.name });
  res.json({ code: 0, msg: '删除成功' });
});

router.post('/batch-delete', authMiddleware(), adminOnly, (req, res) => {
  const ids = req.body.ids || [];
  if (!Array.isArray(ids)) return res.status(400).json({ code: 400, msg: '参数错误' });
  db.prepare(`DELETE FROM hosts WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'batch-delete-hosts', detail: ids.join(',') });
  res.json({ code: 0, msg: '批量删除成功' });
});

// 导出 JSON（不含密码私钥）
router.get('/export/json', authMiddleware(), adminOnly, (req, res) => {
  const hosts = db.prepare('SELECT * FROM hosts').all();
  const safe = hosts.map((h) => ({ ...h, password: '', private_key: '', allowed_users: [] }));
  res.setHeader('Content-Disposition', 'attachment; filename=hosts.json');
  res.json(safe);
});

// 导入 JSON
router.post('/import/json', authMiddleware(), adminOnly, (req, res) => {
  const list = req.body.data;
  if (!Array.isArray(list)) return res.status(400).json({ code: 400, msg: '数据格式错误' });
  const stmt = db.prepare(
    `INSERT INTO hosts (name, ip, port, protocol, username, group_id, remark, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((rows) => {
    let ok = 0;
    for (const h of rows) {
      if (h.name && h.ip && h.port && h.protocol) {
        stmt.run(h.name, h.ip, h.port, h.protocol, h.username || null,
          h.group_id || null, h.remark || null, JSON.stringify(h.tags || []));
        ok++;
      }
    }
    return ok;
  });
  const ok = tx(list);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'import-hosts', detail: `导入 ${ok} 台` });
  res.json({ code: 0, data: { imported: ok } });
});

// —— 导出给 WebSocket 服务用：解密凭据 ——
function getHostRaw(id) {
  const h = db.prepare('SELECT * FROM hosts WHERE id = ?').get(id);
  if (!h) return null;
  h.password = decrypt(h.password, CRYPTO_KEY);
  h.private_key = decrypt(h.private_key, CRYPTO_KEY);
  return h;
}

module.exports = { router, getHostRaw, decrypt, encrypt };
