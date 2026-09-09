/**
 * 快捷命令仓库：增删改查、导入导出、收藏
 */
const express = require('express');
const db = require('../db/database');
const audit = require('../utils/audit');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware(), (req, res) => {
  const { keyword, os, group_id, favorite } = req.query;
  let sql = 'SELECT * FROM commands WHERE 1=1';
  const args = [];
  if (keyword) {
    sql += ' AND (name LIKE ? OR content LIKE ? OR description LIKE ?)';
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (os) { sql += ' AND os = ?'; args.push(os); }
  if (group_id) { sql += ' AND group_id = ?'; args.push(group_id); }
  if (favorite === '1') { sql += ' AND favorite = 1'; }
  sql += ' ORDER BY favorite DESC, id DESC';
  const data = db.prepare(sql).all(...args);
  res.json({ code: 0, data });
});

router.post('/', authMiddleware(), (req, res) => {
  const { name, content, description, os = 'linux', tags, group_id, favorite = 0 } = req.body || {};
  if (!name || !content) return res.status(400).json({ code: 400, msg: '必填字段不全' });
  const info = db.prepare(
    `INSERT INTO commands (name, content, description, os, tags, group_id, favorite, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, content, description || '', os, JSON.stringify(tags || []), group_id || null, favorite ? 1 : 0, req.user.id);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'create-command', detail: name });
  res.json({ code: 0, data: { id: info.lastInsertRowid } });
});

router.put('/:id', authMiddleware(), (req, res) => {
  const fields = [];
  const values = [];
  ['name', 'content', 'description', 'os', 'group_id', 'favorite'].forEach((k) => {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(k === 'tags' ? JSON.stringify(req.body[k]) : req.body[k]);
    }
  });
  if (req.body.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(req.body.tags));
  }
  if (!fields.length) return res.status(400).json({ code: 400, msg: '无字段更新' });
  values.push(req.params.id);
  db.prepare(`UPDATE commands SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ code: 0, msg: '更新成功' });
});

router.delete('/:id', authMiddleware(), adminOnly, (req, res) => {
  db.prepare('DELETE FROM commands WHERE id = ?').run(req.params.id);
  res.json({ code: 0, msg: '删除成功' });
});

router.post('/batch-delete', authMiddleware(), adminOnly, (req, res) => {
  const ids = req.body.ids || [];
  db.prepare(`DELETE FROM commands WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  res.json({ code: 0, msg: '批量删除成功' });
});

// 导出
router.get('/export/json', authMiddleware(), (req, res) => {
  const data = db.prepare('SELECT * FROM commands ORDER BY id').all();
  res.setHeader('Content-Disposition', 'attachment; filename=commands.json');
  res.json(data);
});

// 导入
router.post('/import/json', authMiddleware(), adminOnly, (req, res) => {
  const list = req.body.data;
  if (!Array.isArray(list)) return res.status(400).json({ code: 400, msg: '数据格式错误' });
  const stmt = db.prepare(
    'INSERT INTO commands (name, content, description, os, tags, group_id, favorite) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const tx = db.transaction((rows) => {
    let ok = 0;
    for (const c of rows) {
      if (c.name && c.content) {
        stmt.run(c.name, c.content, c.description || '', c.os || 'linux',
          JSON.stringify(c.tags || []), c.group_id || null, c.favorite ? 1 : 0);
        ok++;
      }
    }
    return ok;
  });
  const ok = tx(list);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'import-commands', detail: `导入 ${ok} 条` });
  res.json({ code: 0, data: { imported: ok } });
});

module.exports = router;
