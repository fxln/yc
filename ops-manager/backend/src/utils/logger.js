/**
 * 简易日志工具：同时输出到控制台和本地文件
 */
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const config = require('../config');

fs.mkdirSync(config.logDir, { recursive: true });

function write(level, args) {
  const ts = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
  const line = `[${ts}] [${level}] ${msg}\n`;
  // 控制台
  if (level === 'ERROR') console.error(line.trim());
  else console.log(line.trim());
  // 文件
  const file = path.join(config.logDir, `app-${dayjs().format('YYYYMMDD')}.log`);
  fs.appendFileSync(file, line);
}

module.exports = {
  info: (...a) => write('INFO', a),
  warn: (...a) => write('WARN', a),
  error: (...a) => write('ERROR', a),
  debug: (...a) => write('DEBUG', a)
};
