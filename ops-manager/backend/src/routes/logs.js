/**
 * 系统日志：查询、清空
 */
const express = require('express');
const db = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware(), (req, res) => {
  const { keyword, action, username, start, end, page = 1, pageSize = 50 } = req.query;
  let sql = 'SELECT * FROM logs WHERE 1=1';
  const args = [];
  if (keyword) {
    sql += ' AND (detail LIKE ? OR username LIKE ? OR host_name LIKE ?)';
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (action) { sql += ' AND action = ?'; args.push(action); }
  if (username) { sql += ' AND username = ?'; args.push(username); }
  if (start) { sql += ' AND created_at >= ?'; args.push(start); }
  if (end) { sql += ' AND created_at <= ?'; args.push(end); }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS c');
  const total = db.prepare(countSql).get(...args).c;
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  args.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
  const list = db.prepare(sql).all(...args);
  res.json({ code: 0, data: { total, list } });
});

router.delete('/', authMiddleware(), adminOnly, (req, res) => {
  db.prepare('DELETE FROM logs').run();
  res.json({ code: 0, msg: '日志已清空' });
});

module.exports = router;
