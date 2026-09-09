/**
 * SSH WebSocket 服务
 * 使用 ssh2 的 Client 建立远程 shell，然后双向桥接到 WebSocket
 *
 * 前端消息格式：
 *   { type: 'data', data: '...' }          用户输入
 *   { type: 'resize', cols: 120, rows: 40 } 窗口 resize
 *   { type: 'ping' }                       心跳
 *   { type: 'exec', command: 'ls -la' }    执行单条命令（可选，非必须）
 */
const { WebSocket } = require('ws');
const { Client } = require('ssh2');
const db = require('../db/database');
const config = require('../config');
const logger = require('../utils/logger');
const audit = require('../utils/audit');
const permission = require('../utils/permission');
const { decrypt } = require('../routes/hosts');

// 当前活跃的 SSH 连接数（用于监控）
const activeConnections = new Map(); // ws -> { hostId, userId, startTime }

function createSSHServer(wss) {
  wss.on('connection', (ws, req) => {
    // 1) 从 query 取 token / hostId
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    const hostId = parseInt(url.searchParams.get('hostId'), 10);

    // 2) 鉴权
    let user = null;
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, config.jwtSecret);
      user = db.prepare('SELECT * FROM users WHERE id = ? AND enabled = 1').get(payload.id);
    } catch (e) {
      ws.close(4001, '鉴权失败');
      return;
    }
    if (!user) { ws.close(4001, '用户不存在'); return; }

    // 3) 取主机 + 权限校验
    const hostRow = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
    if (!hostRow) { ws.close(4004, '主机不存在'); return; }
    if (!permission.canAccessHost(user.id, user.role, hostRow)) {
      ws.close(4003, '无权访问该主机'); return;
    }
    // 解密凭据
    const host = {
      ...hostRow,
      password: decrypt(hostRow.password, process.env.HOST_SECRET || 'ops-manager-host-secret-key-32bytes!!'),
      private_key: decrypt(hostRow.private_key, process.env.HOST_SECRET || 'ops-manager-host-secret-key-32bytes!!')
    };

    // 4) 前端期望先收到 connected 事件
    ws.send(JSON.stringify({ type: 'status', status: 'connecting', msg: `正在连接 ${host.ip}:${host.port}` }));

    // 5) 建立 SSH 连接
    const ssh = new Client();
    let shellStream = null;
    let closed = false;

    const cleanup = (reason) => {
      if (closed) return;
      closed = true;
      activeConnections.delete(ws);
      try { ssh.end(); } catch (_) { /* ignore */ }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'status', status: 'disconnected', msg: reason || '连接已关闭' }));
      }
      try { ws.close(); } catch (_) { /* ignore */ }
    };

    ssh.on('ready', () => {
      activeConnections.set(ws, { hostId, userId: user.id, startTime: Date.now() });
      audit.log({
        user_id: user.id, username: user.username,
        host_id: host.id, host_name: host.name,
        protocol: 'ssh', action: 'connect',
        detail: `SSH 连接 ${host.ip}:${host.port}`
      });

      ssh.shell({ cols: 120, rows: 40, term: 'xterm-256color' }, (err, stream) => {
        if (err) { cleanup('无法创建 shell: ' + err.message); return; }
        shellStream = stream;

        ws.send(JSON.stringify({ type: 'status', status: 'connected' }));

        // shell -> ws
        stream.on('data', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'data', data: data.toString('utf8') }));
          }
        });
        stream.on('close', () => cleanup('shell 已关闭'));
        stream.stderr && stream.stderr.on('data', (d) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'data', data: d.toString('utf8') }));
          }
        });
      });
    });

    ssh.on('error', (err) => cleanup('SSH 错误: ' + err.message));
    ssh.on('close', () => cleanup('SSH 连接关闭'));
    ssh.on('end', () => cleanup('SSH 连接结束'));

    const connectOpts = {
      host: host.ip,
      port: host.port,
      username: host.username,
      readyTimeout: config.connectTimeout
    };
    if (host.private_key) {
      connectOpts.privateKey = host.private_key;
    } else if (host.password) {
      connectOpts.password = host.password;
    }
    ssh.connect(connectOpts);

    // 6) ws -> ssh
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'data' && shellStream) {
        // 高危命令检测（仅警告，不阻断）
        if (msg.data && typeof msg.data === 'string') {
          for (const re of config.dangerousCommands) {
            if (re.test(msg.data)) {
              ws.send(JSON.stringify({
                type: 'warn',
                msg: `检测到潜在高危命令：${msg.data.trim()}，请谨慎执行！`
              }));
              break;
            }
          }
        }
        shellStream.write(msg.data);
      } else if (msg.type === 'resize' && shellStream) {
        try { shellStream.setWindow(msg.cols, msg.rows, 480, 320); } catch (_) { /* ignore */ }
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (msg.type === 'exec' && shellStream) {
        // 快捷命令执行
        const cmd = msg.command;
        if (cmd) {
          // 审计
          audit.log({
            user_id: user.id, username: user.username,
            host_id: host.id, host_name: host.name,
            protocol: 'ssh', action: 'exec', detail: cmd
          });
          shellStream.write(cmd + '\n');
        }
      }
    });

    ws.on('close', () => cleanup('客户端关闭'));
    ws.on('error', () => cleanup('WebSocket 错误'));

    // 超时保护
    setTimeout(() => {
      if (!shellStream && !closed) cleanup('连接超时');
    }, config.connectTimeout);
  });
}

module.exports = { createSSHServer, activeConnections };
