/**
 * 主机心跳检测（ICMP/TCP 端口探测）
 * 每 30s 跑一次，更新 hosts.status
 */
const net = require('net');
const db = require('../db/database');
const config = require('../config');
const logger = require('../utils/logger');

function checkHost(host) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: host.ip, port: host.port, timeout: config.connectTimeout });
    let done = false;
    const finish = (status) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch (_) {}
      resolve(status);
    };
    sock.on('connect', () => finish('online'));
    sock.on('error', () => finish('offline'));
    sock.on('timeout', () => finish('offline'));
    sock.setTimeout(config.connectTimeout);
  });
}

let timer = null;
function startHeartbeat() {
  if (timer) return;
  const tick = async () => {
    const hosts = db.prepare('SELECT * FROM hosts').all();
    for (const h of hosts) {
      // SSH 主机优先 TCP 端口探测（无法从 Node 直接发 ICMP）
      const status = await checkHost(h);
      if (h.status !== status) {
        db.prepare('UPDATE hosts SET status = ? WHERE id = ?').run(status, h.id);
        logger.info(`主机 ${h.name} (${h.ip}:${h.port}) 状态 ${h.status} -> ${status}`);
      }
    }
  };
  tick(); // 立即跑一次
  timer = setInterval(tick, config.heartbeatInterval);
}

function stopHeartbeat() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startHeartbeat, stopHeartbeat, checkHost };
