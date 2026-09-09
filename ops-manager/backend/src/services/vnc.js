/**
 * VNC WebSocket 代理
 * 浏览器 WebSocket (noVNC) → 后端 WS → TCP → VNC Server
 *
 * noVNC 使用标准 RFB 协议（二进制），前端会先发送 RFB 握手 + 认证消息
 * 后端只做透明转发
 */
const net = require('net');
const { WebSocket } = require('ws');
const db = require('../db/database');
const config = require('../config');
const logger = require('../utils/logger');
const audit = require('../utils/audit');
const permission = require('../utils/permission');
const { decrypt } = require('../routes/hosts');

function createVNCServer(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    const hostId = parseInt(url.searchParams.get('hostId'), 10);

    let user;
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, config.jwtSecret);
      user = db.prepare('SELECT * FROM users WHERE id = ? AND enabled = 1').get(payload.id);
    } catch { ws.close(4001, '鉴权失败'); return; }
    if (!user) { ws.close(4001, '用户不存在'); return; }

    const hostRow = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
    if (!hostRow || hostRow.protocol !== 'vnc') { ws.close(4004, '主机不存在'); return; }
    if (!permission.canAccessHost(user.id, user.role, hostRow)) { ws.close(4003, '无权访问'); return; }

    const host = {
      ...hostRow,
      password: decrypt(hostRow.password, process.env.HOST_SECRET || 'ops-manager-host-secret-key-32bytes!!')
    };

    audit.log({
      user_id: user.id, username: user.username,
      host_id: host.id, host_name: host.name,
      protocol: 'vnc', action: 'connect',
      detail: `VNC 连接 ${host.ip}:${host.port}`
    });

    const tcp = net.connect({ host: host.ip, port: host.port });
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      try { tcp.destroy(); } catch (_) { /* ignore */ }
      try { ws.close(); } catch (_) { /* ignore */ }
    };

    tcp.on('connect', () => {
      ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
    });
    tcp.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        // noVNC 期望二进制帧
        ws.send(data, { binary: true });
      }
    });
    tcp.on('error', (e) => {
      ws.send(JSON.stringify({ type: 'status', status: 'error', msg: 'VNC TCP 错误: ' + e.message }));
      cleanup();
    });
    tcp.on('close', cleanup);

    ws.on('message', (raw, isBinary) => {
      if (closed) return;
      if (isBinary || Buffer.isBuffer(raw)) {
        tcp.write(raw);
      } else {
        // 某些浏览器/库可能以文本帧发
        const str = raw.toString('utf8');
        try {
          const msg = JSON.parse(str);
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
          else if (msg.type === 'binary' && msg.data) {
            tcp.write(Buffer.from(msg.data, 'base64'));
          }
        } catch {
          // 原样透传
          tcp.write(raw);
        }
      }
    });
    ws.on('close', cleanup);
    ws.on('error', cleanup);

    // 连接超时保护
    setTimeout(() => {
      if (tcp && !tcp.destroyed && tcp.connecting) cleanup();
    }, config.connectTimeout);
  });
}

module.exports = { createVNCServer };
