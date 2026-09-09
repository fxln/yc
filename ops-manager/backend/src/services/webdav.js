/**
 * 内置 WebDAV 服务
 * 使用 webdav-server v2 API + 自定义 HTTP Basic Auth + 只读账号拦截 + 审计日志
 *
 * ⚠️ webdav-server v2 几个容易踩的坑：
 *  1. 自定义 auth 配置字段名是 httpAuthentication（不是 authentication）
 *  2. requireAuthentification: true 才能让 getUser 返回 null 时触发 401
 *  3. askForAuthentication(ctx) 必须返回 header 对象（如 { 'WWW-Authenticate': '...' }），
 *     不要直接 response.end()，否则框架后续 setAllowHeader 会触发 ERR_HTTP_HEADERS_SENT
 *  4. 认证/请求拦截中间件不能放在构造函数选项里（那里没有 beforeRequest 字段），
 *     必须通过 server.beforeRequest(manager) 方法注册：manager 签名 (ctx, next) => {}
 *  5. manager 内部 ctx.user 是 getUser 的返回值
 */
const fs = require('fs');
const { WebDAVServer } = require('webdav-server').v2;

const config = require('../config');
const webdavRouter = require('../routes/webdav');
const audit = require('../utils/audit');
const logger = require('../utils/logger');

class OpsHTTPBasicAuth {
  constructor(realm = 'OpsManager WebDAV') {
    this.realm = realm;
  }
  getUser(ctx, cb) {
    const auth = ctx.request.headers['authorization'] || ctx.request.headers['Authorization'];
    if (!auth || !auth.startsWith('Basic ')) return cb(null, null);
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
    try {
      const acc = webdavRouter.verifyAccount(u, p);
      if (!acc) return cb(null, null);
      cb(null, {
        username: acc.username,
        readonly: !!acc.readonly,
        enabled: !!acc.enabled,
        isDefaultUser: false
      });
    } catch (e) {
      cb(e, null);
    }
  }
  askForAuthentication(ctx) {
    return {
      'WWW-Authenticate': `Basic realm="${this.realm}"`,
      'Content-Type': 'text/plain'
    };
  }
}

function startWebDAV() {
  fs.mkdirSync(config.webdavRoot, { recursive: true });

  const server = new WebDAVServer({
    port: config.webdavPort,
    root: config.webdavRoot,
    // 强制认证（getUser 返回 null → 401）
    requireAuthentification: true,
    httpAuthentication: new OpsHTTPBasicAuth('OpsManager WebDAV')
  });

  // 通过实例方法注册 beforeRequest 中间件（构造函数选项里没有这个字段！）
  server.beforeRequest((ctx, next) => {
    const user = ctx.user;
    if (!user) { next(); return; }

    // 只读账号拦截所有写操作
    if (user.readonly) {
      const writeMethods = ['PUT', 'DELETE', 'MKCOL', 'COPY', 'MOVE', 'PROPPATCH', 'LOCK', 'UNLOCK'];
      if (writeMethods.includes(ctx.request.method)) {
        audit.log({
          username: user.username,
          protocol: 'webdav',
          action: 'denied',
          detail: `${ctx.request.method} ${ctx.request.url}`,
          status: 'fail'
        });
        // 用框架提供的 API 正确结束请求（不能自己 response.end()，也不能调 next()）
        // - ctx.setCode() 设置响应码 + message
        // - ctx.exit() 框架内部会 response.end() + 触发 afterManagers
        // - 不调用 next() = 阻断主流程，method.unchunked 不会执行
        ctx.setCode(403, 'Readonly access denied');
        ctx.exit();
        return;
      }
    }

    // 审计所有 WebDAV 请求（放行场景）
    audit.log({
      username: user.username,
      protocol: 'webdav',
      action: ctx.request.method,
      detail: ctx.request.url,
      status: 'success'
    });
    next();
  });

  server.start((httpServer) => {
    if (!httpServer) {
      logger.error('WebDAV 启动失败：start 回调未返回 server');
      return;
    }
    httpServer.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        logger.error(`WebDAV 端口 ${config.webdavPort} 已被占用，请修改 WEBDAV_PORT 环境变量`);
      } else {
        logger.error('WebDAV 服务器错误:', e.message);
      }
    });
    logger.info(`WebDAV 已启动 http://0.0.0.0:${config.webdavPort} (root: ${config.webdavRoot})`);
  });

  return server;
}

module.exports = { startWebDAV };
