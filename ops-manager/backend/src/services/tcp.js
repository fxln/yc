/**
 * RDP / 通用 TCP 端口转发
 * WebSocket <-> TCP 端口 双向透传
 *
 * RDP 协议是二进制（TLS + RDP），前端用 noVNC 的扩展或纯 TCP 代理
 * 这里实现通用 TCP 代理，RDP 前端可以用这个通道
 */
const net = require('net');
const { WebSocket } = require('ws');
const db = require('../db/database');
const config = require('../config');
const audit = require('../utils/audit');
const permission = require('../utils/permission');

function createTCPServer(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    const hostId = parseInt(url.searchParams.get('hostId'), 10);
    const targetHost = url.searchParams.get('host');
    const targetPort = parseInt(url.searchParams.get('port'), 10);

    let user;
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, config.jwtSecret);
      user = db.prepare('SELECT * FROM users WHERE id = ? AND enabled = 1').get(payload.id);
    } catch { ws.close(4001, '鉴权失败'); return; }
    if (!user) { ws.close(4001, '用户不存在'); return; }

    let host = null;
    if (hostId) {
      const row = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
      if (!row) { ws.close(4004, '主机不存在'); return; }
      if (!permission.canAccessHost(user.id, user.role, row)) { ws.close(4003, '无权访问'); return; }
      host = row;
    }

    // 实际要连的 host/port
    const h = targetHost || (host && host.ip);
    const p = targetPort || (host && host.port);
    if (!h || !p) { ws.close(4000, '缺少目标地址'); return; }

    audit.log({
      user_id: user.id, username: user.username,
      host_id: host && host.id, host_name: host && host.name,
      protocol: (host && host.protocol) || 'tcp',
      action: 'tcp-connect',
      detail: `${h}:${p}`
    });

    const tcp = net.connect({ host: h, port: p });
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      try { tcp.destroy(); } catch (_) { /* ignore */ }
      try { ws.close(); } catch (_) { /* ignore */ }
    };

    tcp.on('connect', () => ws.send(JSON.stringify({ type: 'status', status: 'connected' })));
    tcp.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data, { binary: true });
    });
    tcp.on('error', (e) => {
      ws.send(JSON.stringify({ type: 'status', status: 'error', msg: e.message }));
      cleanup();
    });
    tcp.on('close', cleanup);

    ws.on('message', (raw, isBinary) => {
      if (closed) return;
      if (isBinary || Buffer.isBuffer(raw)) {
        tcp.write(raw);
      } else {
        try {
          const msg = JSON.parse(raw.toString('utf8'));
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
          else if (msg.type === 'binary' && msg.data) tcp.write(Buffer.from(msg.data, 'base64'));
        } catch {
          tcp.write(raw);
        }
      }
    });
    ws.on('close', cleanup);
    ws.on('error', cleanup);

    setTimeout(() => {
      if (tcp && !tcp.destroyed && tcp.connecting) cleanup();
    }, config.connectTimeout);
  });
}

module.exports = { createTCPServer };
