/**
 * 认证路由：登录 / 当前用户 / 修改密码
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const config = require('../config');
const audit = require('../utils/audit');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { code: 429, msg: '登录过于频繁，请稍后再试' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ code: 400, msg: '账号或密码不能为空' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

  if (!user || !bcrypt.compareSync(password, user.password)) {
    audit.log({ username, action: 'login', detail: '登录失败', status: 'fail', ip });
    return res.status(401).json({ code: 401, msg: '账号或密码错误' });
  }
  if (!user.enabled) {
    audit.log({ username, action: 'login', detail: '账号已禁用', status: 'fail', ip });
    return res.status(403).json({ code: 403, msg: '账号已禁用' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  db.prepare("UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?").run(user.id);
  audit.log({ user_id: user.id, username: user.username, action: 'login', status: 'success', ip });

  res.json({
    code: 0,
    data: {
      token,
      user: { id: user.id, username: user.username, role: user.role }
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware(), (req, res) => {
  res.json({ code: 0, data: req.user });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware(), (req, res) => {
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'logout' });
  res.json({ code: 0, msg: '已退出' });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware(), (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ code: 400, msg: '参数不全' });
  if (newPassword.length < 6) return res.status(400).json({ code: 400, msg: '新密码至少 6 位' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(401).json({ code: 401, msg: '旧密码错误' });
  }
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
  audit.log({ user_id: req.user.id, username: req.user.username, action: 'change-password' });
  res.json({ code: 0, msg: '修改成功' });
});

module.exports = router;
