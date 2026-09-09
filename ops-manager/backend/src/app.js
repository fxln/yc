/**
 * 后端入口：Express + WebSocket 多路复用
 *
 * HTTP 路径：
 *   /api/auth/*        鉴权
 *   /api/users/*       用户管理
 *   /api/groups/*      分组
 *   /api/hosts/*       主机
 *   /api/commands/*    快捷命令
 *   /api/logs/*        系统日志
 *   /api/webdav/*      WebDAV 设置
 *   /api/sftp/*        SFTP REST 文件操作
 *
 * WebSocket 路径：
 *   /ws/ssh   SSH 终端
 *   /ws/vnc   VNC 代理
 *   /ws/tcp   通用 TCP 代理（含 RDP）
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');

const config = require('./config');
const logger = require('./utils/logger');

// REST 路由
const authRoute = require('./routes/auth');
const usersRoute = require('./routes/users');
const groupsRoute = require('./routes/groups');
const hostsRoute = require('./routes/hosts');
const commandsRoute = require('./routes/commands');
const logsRoute = require('./routes/logs');
const webdavRoute = require('./routes/webdav');
const sftpRoute = require('./services/sftp');

// WebSocket 服务
const sshService = require('./services/ssh');
const vncService = require('./services/vnc');
const tcpService = require('./services/tcp');

// 后台服务
const { startHeartbeat } = require('./services/heartbeat');
const { startWebDAV } = require('./services/webdav');

const app = express();
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// 统一响应处理
app.use((err, req, res, next) => {
  logger.error('Unhandled:', err);
  res.status(500).json({ code: 500, msg: err.message || 'Server Error' });
});

// API 路由挂载
app.use('/api/auth', authRoute);
app.use('/api/users', usersRoute);
app.use('/api/groups', groupsRoute);
app.use('/api/hosts', hostsRoute.router);
app.use('/api/commands', commandsRoute);
app.use('/api/logs', logsRoute);
app.use('/api/webdav', webdavRoute.router);
app.use('/api/sftp', sftpRoute);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    data: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeSsh: sshService.activeConnections.size
    }
  });
});

// 生产环境：serve 前端 dist 静态文件
if (fs.existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/ws')) return next();
    res.sendFile(path.join(config.frontendDist, 'index.html'));
  });
  logger.info(`前端静态资源已挂载: ${config.frontendDist}`);
} else {
  logger.warn(`前端 dist 不存在: ${config.frontendDist}，请先构建前端`);
}

// 创建 HTTP Server（Express 与 WebSocket 复用同一个 server）
const server = http.createServer(app);

// WebSocket Server 路由（通过 pathname 分发）
const wssSSH = new WebSocketServer({ noServer: true });
const wssVNC = new WebSocketServer({ noServer: true });
const wssTCP = new WebSocketServer({ noServer: true });

sshService.createSSHServer(wssSSH);
vncService.createVNCServer(wssVNC);
tcpService.createTCPServer(wssTCP);

server.on('upgrade', (req, socket, head) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (parsed.pathname === '/ws/ssh') {
      wssSSH.handleUpgrade(req, socket, head, (ws) => wssSSH.emit('connection', ws, req));
    } else if (parsed.pathname === '/ws/vnc') {
      wssVNC.handleUpgrade(req, socket, head, (ws) => wssVNC.emit('connection', ws, req));
    } else if (parsed.pathname === '/ws/tcp') {
      wssTCP.handleUpgrade(req, socket, head, (ws) => wssTCP.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  } catch (e) {
    logger.error('upgrade error:', e);
    socket.destroy();
  }
});

// 启动
server.listen(config.port, () => {
  logger.info(`HTTP 服务已启动: http://0.0.0.0:${config.port}`);
  startHeartbeat();
  try { startWebDAV(); } catch (e) { logger.error('WebDAV 启动失败:', e.message); }
});

server.on('error', (err) => {
  logger.error('HTTP Server Error:', err.message);
  process.exit(1);
});

// 优雅退出
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM，正在关闭...');
  server.close(() => { process.exit(0); });
});
process.on('SIGINT', () => {
  logger.info('收到 SIGINT');
  server.close(() => { process.exit(0); });
});
