/**
 * 全局配置
 * 所有环境变量在此收口，避免代码中散落硬编码
 */
const path = require('path');

module.exports = {
  // 服务端口
  port: parseInt(process.env.HTTP_PORT || '3000', 10),
  // WebDAV 端口
  webdavPort: parseInt(process.env.WEBDAV_PORT || '8081', 10),
  // JWT 密钥（生产环境务必替换）
  jwtSecret: process.env.JWT_SECRET || 'ops-manager-change-this-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  // 默认管理员
  defaultAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  },
  // 数据库路径
  dbPath: path.resolve(__dirname, '../../data/db/ops-manager.db'),
  // 数据目录
  dataDir: path.resolve(__dirname, '../../data'),
  logDir: path.resolve(__dirname, '../../data/logs'),
  webdavRoot: path.resolve(__dirname, '../../data/webdav'),
  sshKeyDir: path.resolve(__dirname, '../../data/ssh_keys'),
  // 前端静态文件（生产环境）
  frontendDist: path.resolve(__dirname, '../../../frontend/dist'),
  // 心跳间隔（毫秒）
  heartbeatInterval: 30000,
  // 连接超时
  connectTimeout: 10000,
  // 传输分片大小（8MB）
  chunkSize: 8 * 1024 * 1024,
  // 高危命令黑名单（执行前弹警告）
  dangerousCommands: [
    /\brm\s+-rf\s+\//,
    /\brm\s+-rf\s+\*/,
    /\bmkfs\b/,
    /\bdd\s+if=.*of=.*\/dev\//,
    /\bshutdown\b/,
    /\breboot\b/,
    /\binit\s+[06]/,
    /\bformat\s+[A-Z]:/i,
    /\bDEL\s+\/[SQF]\s+[A-Z]:\\/i
  ]
};
