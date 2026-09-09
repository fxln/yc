/**
 * 内置 WebDAV 服务
 * 使用 webdav-server 的 v2 API，自定义 HTTP Basic Auth（复用 webdav_config 表）
 * 存储根目录为 data/webdav，便于 volume 持久化
 */
const fs = require('fs');
const path = require('path');
const { WebDAVServer } = require('webdav-server').v2;

const config = require('../config');
const webdavRouter = require('../routes/webdav');
const audit = require('../utils/audit');
const logger = require('../utils/logger');

function startWebDAV() {
  fs.mkdirSync(config.webdavRoot, { recursive: true });

  const server = new WebDAVServer({
    port: config.webdavPort,
    root: config.webdavRoot,
    // HTTP Basic Auth
    authentication: (ctx, next) => {
      const auth = ctx.request.headers['authorization'];
      if (!auth || !auth.startsWith('Basic ')) {
        ctx.response.setHeader('WWW-Authenticate', 'Basic realm="OpsManager WebDAV"');
        ctx.response.status = 401;
        ctx.response.body = 'Unauthorized';
        ctx.response.end();
        return;
      }
      const token = auth.slice(6);
      const [u, p] = Buffer.from(token, 'base64').toString('utf8').split(':');
      const acc = webdavRouter.verifyAccount(u, p);
      if (!acc) {
        ctx.response.setHeader('WWW-Authenticate', 'Basic realm="OpsManager WebDAV"');
        ctx.response.status = 401;
        ctx.response.body = 'Unauthorized';
        ctx.response.end();
        return;
      }
      ctx.user = { username: acc.username, readonly: !!acc.readonly };
      next();
    },
    // 只读账号拦截写操作
    beforeRequest: (ctx, next) => {
      const writeMethods = ['PUT', 'DELETE', 'MKCOL', 'COPY', 'MOVE', 'PROPPATCH', 'LOCK', 'UNLOCK'];
      if (ctx.user && ctx.user.readonly && writeMethods.includes(ctx.request.method)) {
        audit.log({ username: ctx.user.username, protocol: 'webdav', action: 'denied', detail: `${ctx.request.method} ${ctx.request.url}`, status: 'fail' });
        ctx.response.status = 403;
        ctx.response.body = 'Readonly';
        ctx.response.end();
        return;
      }
      audit.log({ username: ctx.user && ctx.user.username, protocol: 'webdav', action: ctx.request.method, detail: ctx.request.url });
      next();
    }
  });

  server.start((err) => {
    if (err) {
      logger.error('WebDAV 启动失败:', err.message || err);
    } else {
      logger.info(`WebDAV 已启动 http://0.0.0.0:${config.webdavPort} (root: ${config.webdavRoot})`);
    }
  });

  server._server?.on?.('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      logger.error(`WebDAV 端口 ${config.webdavPort} 已被占用，请修改 WEBDAV_PORT 环境变量`);
    } else {
      logger.error('WebDAV 服务器错误:', e.message);
    }
  });

  return server;
}

module.exports = { startWebDAV };
