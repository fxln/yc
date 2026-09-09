/**
 * 主机访问权限校验：
 * - admin 全部可访问
 * - user / readonly 只能访问自己被授权的主机 或 未设置 allowed_users 的主机
 */
const db = require('../db/database');

function canAccessHost(userId, role, host) {
  if (role === 'admin') return true;
  if (!host.allowed_users) return true;
  try {
    const arr = JSON.parse(host.allowed_users);
    return Array.isArray(arr) && arr.includes(userId);
  } catch {
    return true;
  }
}

// 过滤主机列表
function filterHosts(hosts, user) {
  if (user.role === 'admin') return hosts;
  return hosts.filter((h) => canAccessHost(user.id, user.role, h));
}

module.exports = { canAccessHost, filterHosts };
