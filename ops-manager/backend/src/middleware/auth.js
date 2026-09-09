/**
 * JWT 鉴权中间件
 * 从 Header Authorization: Bearer xxx 或 Cookie token 读取
 */
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');

function authMiddleware(required = true) {
  return (req, res, next) => {
    const header = req.headers['authorization'] || req.headers['Authorization'];
    let token = null;
    if (header && header.startsWith('Bearer ')) {
      token = header.slice(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      if (required) return res.status(401).json({ code: 401, msg: '未登录' });
      return next();
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = db
        .prepare('SELECT id, username, role, enabled FROM users WHERE id = ?')
        .get(payload.id);
      if (!user || !user.enabled) {
        return res.status(401).json({ code: 401, msg: '账号已禁用或不存在' });
      }
      req.user = user;
      next();
    } catch (e) {
      return res.status(401).json({ code: 401, msg: 'token 失效' });
    }
  };
}

// 仅管理员
function adminOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, msg: '需要管理员权限' });
  }
  next();
}

// 至少运维用户（只读用户禁止远程操作）
function atLeastUser(req, res, next) {
  if (!req.user) return res.status(401).json({ code: 401, msg: '未登录' });
  if (req.user.role === 'readonly') {
    return res.status(403).json({ code: 403, msg: '只读用户禁止该操作' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, atLeastUser };
