/**
 * SQLite 数据库初始化与访问层
 * 使用 better-sqlite3 同步 API，简单高效
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('../config');

// 确保目录存在
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
// WAL 模式提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// —— 建表 SQL ——
const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',   -- admin / user / readonly
  enabled INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL,              -- ssh / vnc / rdp / tcp
  username TEXT,
  password TEXT,
  private_key TEXT,
  group_id INTEGER,
  remark TEXT,
  tags TEXT,                            -- JSON 数组
  status TEXT NOT NULL DEFAULT 'offline', -- online / offline / connecting
  allowed_users TEXT,                   -- JSON 数组：有权访问的 user id
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  os TEXT DEFAULT 'linux',             -- linux / windows / generic
  tags TEXT,
  group_id INTEGER,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  host_id INTEGER,
  host_name TEXT,
  protocol TEXT,
  action TEXT,                          -- connect / disconnect / exec / upload / download / login / logout / webdav
  detail TEXT,
  status TEXT DEFAULT 'success',
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS webdav_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  readonly INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  remark TEXT
);
`;

db.exec(schema);

// —— 默认数据 ——
(function seed() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync(config.defaultAdmin.password, 10);
    db.prepare(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
    ).run(config.defaultAdmin.username, hash, 'admin');
  }

  const groupCount = db.prepare('SELECT COUNT(*) AS c FROM groups').get().c;
  if (groupCount === 0) {
    const insertGroup = db.prepare('INSERT INTO groups (name, sort) VALUES (?, ?)');
    insertGroup.run('默认分组', 0);
    insertGroup.run('生产环境', 1);
    insertGroup.run('测试环境', 2);
  }

  const webdavCount = db.prepare('SELECT COUNT(*) AS c FROM webdav_config').get().c;
  if (webdavCount === 0) {
    const hash = bcrypt.hashSync('webdav123', 10);
    db.prepare(
      'INSERT INTO webdav_config (username, password, readonly, remark) VALUES (?, ?, ?, ?)'
    ).run('webdav', hash, 0, '默认读写账号');
  }
})();

module.exports = db;
