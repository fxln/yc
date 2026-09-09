/**
 * 写入审计日志
 */
const db = require('../db/database');

function log(data) {
  try {
    db.prepare(
      `INSERT INTO logs (user_id, username, host_id, host_name, protocol, action, detail, status, ip)
       VALUES (@user_id, @username, @host_id, @host_name, @protocol, @action, @detail, @status, @ip)`
    ).run({
      user_id: data.user_id || null,
      username: data.username || null,
      host_id: data.host_id || null,
      host_name: data.host_name || null,
      protocol: data.protocol || null,
      action: data.action || 'unknown',
      detail: data.detail || '',
      status: data.status || 'success',
      ip: data.ip || null
    });
  } catch (e) {
    // 审计日志写入失败不应影响主流程
    console.error('[audit] 写入失败:', e.message);
  }
}

module.exports = { log };
