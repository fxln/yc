/**
 * SFTP REST 服务（文件浏览 / 上传 / 下载 / 删除 / 重命名 / 新建）
 * 使用 ssh2 建立一次性连接，完成请求后立即断开，避免资源长期占用
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const db = require('../db/database');
const config = require('../config');
const audit = require('../utils/audit');
const permission = require('../utils/permission');
const { decrypt } = require('../routes/hosts');
const { authMiddleware, atLeastUser } = require('../middleware/auth');

const router = express.Router();

function openSftp(host, timeout = config.connectTimeout) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const opts = {
      host: host.ip, port: host.port, username: host.username, readyTimeout: timeout
    };
    if (host.private_key) opts.privateKey = host.private_key;
    else opts.password = host.password;
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) { client.end(); return reject(err); }
        resolve({ client, sftp });
      });
    });
    client.on('error', reject);
    client.on('close', () => reject(new Error('ssh closed')));
    client.connect(opts);
  });
}

router.use(authMiddleware(), atLeastUser);
// 只读用户禁止任何文件操作（已由 atLeastUser 拦截）

router.use((req, res, next) => {
  const hostId = parseInt(req.params.hostId, 10);
  const hostRow = db.prepare('SELECT * FROM hosts WHERE id = ?').get(hostId);
  if (!hostRow) return res.status(404).json({ code: 404, msg: '主机不存在' });
  if (!permission.canAccessHost(req.user.id, req.user.role, hostRow)) {
    return res.status(403).json({ code: 403, msg: '无权访问' });
  }
  req.host = {
    ...hostRow,
    password: decrypt(hostRow.password, process.env.HOST_SECRET || 'ops-manager-host-secret-key-32bytes!!'),
    private_key: decrypt(hostRow.private_key, process.env.HOST_SECRET || 'ops-manager-host-secret-key-32bytes!!')
  };
  next();
});

// GET /sftp/:hostId/readdir?path=/etc
router.get('/:hostId/readdir', async (req, res) => {
  const targetPath = req.query.path || '/';
  let ctx;
  try {
    ctx = await openSftp(req.host);
  } catch (e) {
    return res.status(502).json({ code: 502, msg: 'SFTP 连接失败: ' + e.message });
  }
  ctx.sftp.readdir(targetPath, (err, list) => {
    ctx.client.end();
    if (err) return res.status(500).json({ code: 500, msg: err.message });
    res.json({
      code: 0,
      data: list.map((f) => ({
        name: f.filename,
        type: f.attrs.isDirectory() ? 'directory' : 'file',
        size: f.attrs.size || 0,
        mtime: f.attrs.mtime * 1000,
        permissions: f.attrs.mode
      }))
    });
  });
});

// GET /sftp/:hostId/stat?path=...
router.get('/:hostId/stat', async (req, res) => {
  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }
  ctx.sftp.stat(req.query.path, (err, stat) => {
    ctx.client.end();
    if (err) return res.status(500).json({ code: 500, msg: err.message });
    res.json({ code: 0, data: stat });
  });
});

// POST /sftp/:hostId/mkdir   { path: '/tmp/xxx' }
router.post('/:hostId/mkdir', async (req, res) => {
  const dir = req.body.path;
  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }
  ctx.sftp.mkdir(dir, (err) => {
    ctx.client.end();
    if (err) return res.status(500).json({ code: 500, msg: err.message });
    res.json({ code: 0, msg: '已创建' });
  });
});

// POST /sftp/:hostId/rename   { from, to }
router.post('/:hostId/rename', async (req, res) => {
  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }
  ctx.sftp.rename(req.body.from, req.body.to, (err) => {
    ctx.client.end();
    if (err) return res.status(500).json({ code: 500, msg: err.message });
    audit.log({ user_id: req.user.id, username: req.user.username, host_id: req.host.id, host_name: req.host.name, protocol: 'ssh', action: 'rename', detail: `${req.body.from} -> ${req.body.to}` });
    res.json({ code: 0, msg: '已重命名' });
  });
});

// DELETE /sftp/:hostId/delete?path=...
router.delete('/:hostId/delete', async (req, res) => {
  const target = req.query.path;
  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }

  const rm = (p) => new Promise((resolve, reject) => {
    ctx.sftp.stat(p, (err, stat) => {
      if (err) return reject(err);
      if (stat.isDirectory()) {
        ctx.sftp.readdir(p, (err2, list) => {
          if (err2) return reject(err2);
          const inner = list.map((f) => rm(p.replace(/\/$/, '') + '/' + f.filename));
          Promise.all(inner).then(() => {
            ctx.sftp.rmdir(p, (e) => e ? reject(e) : resolve());
          }).catch(reject);
        });
      } else {
        ctx.sftp.unlink(p, (e) => e ? reject(e) : resolve());
      }
    });
  });

  rm(target).then(() => {
    ctx.client.end();
    audit.log({ user_id: req.user.id, username: req.user.username, host_id: req.host.id, host_name: req.host.name, protocol: 'ssh', action: 'delete', detail: target });
    res.json({ code: 0, msg: '已删除' });
  }).catch((err) => {
    ctx.client.end();
    res.status(500).json({ code: 500, msg: err.message });
  });
});

// POST /sftp/:hostId/upload  (multipart/form-data: file, remotePath)
const multer = require('multer');
const uploadHandler = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.post('/:hostId/upload', uploadHandler.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, msg: '未收到文件' });
  const remotePath = req.body.remotePath;
  if (!remotePath) return res.status(400).json({ code: 400, msg: '缺少 remotePath' });

  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }

  ctx.sftp.writeFile(remotePath, req.file.buffer, (err) => {
    ctx.client.end();
    if (err) return res.status(500).json({ code: 500, msg: err.message });
    audit.log({ user_id: req.user.id, username: req.user.username, host_id: req.host.id, host_name: req.host.name, protocol: 'ssh', action: 'upload', detail: `${remotePath} (${req.file.size} bytes)` });
    res.json({ code: 0, msg: '上传成功', size: req.file.size });
  });
});

// GET /sftp/:hostId/download?path=/etc/passwd  (流式回传)
router.get('/:hostId/download', async (req, res) => {
  const targetPath = req.query.path;
  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }

  ctx.sftp.stat(targetPath, (err, stat) => {
    if (err) { ctx.client.end(); return res.status(404).json({ code: 404, msg: '文件不存在' }); }
    const name = path.basename(targetPath);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Content-Length', stat.size);

    const readStream = ctx.sftp.createReadStream(targetPath);
    readStream.on('end', () => { ctx.client.end(); });
    readStream.on('error', () => { try { ctx.client.end(); } catch (_) {} });
    readStream.pipe(res);

    audit.log({ user_id: req.user.id, username: req.user.username, host_id: req.host.id, host_name: req.host.name, protocol: 'ssh', action: 'download', detail: `${targetPath}` });
  });
});

// GET /sftp/:hostId/preview?path=... (文本预览，限制 256KB)
router.get('/:hostId/preview', async (req, res) => {
  let ctx;
  try { ctx = await openSftp(req.host); }
  catch (e) { return res.status(502).json({ code: 502, msg: e.message }); }
  ctx.sftp.readFile(req.query.path, (err, data) => {
    ctx.client.end();
    if (err) return res.status(500).json({ code: 500, msg: err.message });
    const max = 256 * 1024;
    const buf = data.slice(0, max);
    res.type('text/plain').send(buf.toString('utf8'));
  });
});

module.exports = router;
