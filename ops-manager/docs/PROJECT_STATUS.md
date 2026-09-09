# OpsManager 项目状态报告

> 生成时间：2026-09-09  
> 适用版本：前端 Vue 3 + 后端 Node.js + SQLite + Docker  
> 文档位置：`docs/PROJECT_STATUS.md`

---

## 一、项目要求（已实现 + 待实现）

### 1.1 已实现的核心功能

| 模块 | 功能点 | 状态 |
|---|---|---|
| **用户认证** | JWT + bcrypt 密码哈希 + 角色权限（admin/user/readonly） | ✅ 已完成 |
| **主机管理** | 增删改查、分组、标签、导入/导出 JSON、按协议/状态筛选 | ✅ 已完成 |
| **SSH 终端** | xterm.js + WebSocket + SFTP 文件管理器 + 字体缩放 + 清屏 + 快捷键 | ✅ 已完成 |
| **VNC 远程** | noVNC + WebSocket 代理 | ✅ 已完成 |
| **RDP/TCP** | TCP 通道连接（RDP 走 TCP 转发） | ✅ 已完成 |
| **命令仓库** | 命令模板、变量占位符、收藏、导入/导出 | ✅ 已完成 |
| **WebDAV** | 端口 8081、Basic Auth、读写/只读权限、审计日志 | ✅ 已完成 |
| **审计日志** | 用户操作、连接记录、失败记录、清空 | ✅ 已完成 |
| **用户管理** | 新增/编辑/删除用户、角色分配 | ✅ 已完成 |
| **Docker 部署** | 多阶段 Dockerfile + docker-compose.yml + 数据卷持久化 | ✅ 已完成 |
| **多彩暗色主题** | 六色 accent Token + Element Plus 全局覆盖 + 运维专属组件风格 | ✅ 已完成 |
| **前端样式规范** | `frontend/docs/STYLE_GUIDE.md` | ✅ 已完成 |

### 1.2 待实现的需求

#### 高优先级

| 需求 | 说明 | 涉及文件 |
|---|---|---|
| **自动重连控制** | 连接断开后自动重试 3 次，3 次失败后停止，弹框让用户选择「取消」或「继续连接」 | `SSHTerminal.vue`、`VNCSession.vue`、`RDPSession.vue` |
| **连接错误统一弹框** | 把错误信息集中到一个对话框/提示框里，提供明确的「取消连接」和「继续连接」按钮 | 同上 |
| **会话/设置页面状态联动** | 已连接服务器时显示会话/设置页面；未连接时回退到主页（Dashboard） | `MainLayout.vue` 路由或 Tab 逻辑 |

#### 中优先级

| 需求 | 说明 |
|---|---|
| **WebDAV 只读权限严格校验** | 之前已修复 readonly 用户 PUT/DELETE/MKCOL 返回 403，需要回归测试 |
| **Docker 部署验证** | 执行 `docker compose up -d`，验证构建、端口、数据卷持久化 |
| **Vite 打包性能优化** | 解决 element-plus / xterm 大 chunk 告警，配置 `manualChunks` |
| **部署文档完善** | 环境变量说明、Docker 部署步骤、常见问题排查 |

#### 低优先级

| 需求 | 说明 |
|---|---|
| **终端搜索高亮** | xterm-addon-search 已加载，但缺少搜索框 UI |
| **SFTP 拖拽上传进度** | 当前有拖放支持，但无进度条 |
| **命令执行结果回显** | 快捷命令发送后仅提示成功，未在终端内打印命令本身 |
| **多语言 i18n** | 当前为中文界面，可后续支持英文 |

---

## 二、Bug 排除记录

### 2.1 已修复的 Bug

| # | 问题 | 根因 | 修复方案 | 状态 |
|---|---|---|---|---|
| 1 | WebDAV 匿名访问/认证不生效 | `httpAuthentication` 字段名错误 + `requireAuthentification` 默认 false | 修正字段名、开启强制认证、正确实现 `OpsHTTPBasicAuth` | ✅ 已修复 |
| 2 | WebDAV 只读用户 PUT/DELETE/MKCOL 返回 200 | 用 `ctx.response.end()` 后框架继续执行主流程 | 改用 `ctx.setCode(403)` + `ctx.exit()` 并**不调用 next()** | ✅ 已修复 |
| 3 | noVNC 构建失败（top-level await） | Vite 默认 target 不支持顶层 await | `vite.config.js` 设置 `build.target: 'es2022'` | ✅ 已修复 |
| 4 | SQLite `datetime('now','localtime')` 语法错误 | 使用了双引号包裹字符串 | 改为单引号 | ✅ 已修复 |
| 5 | `xterm-addon-search` 版本冲突 | 版本不兼容 | 升级到 `^0.13.0` | ✅ 已修复 |
| 6 | Pinia 持久化插件问题 | `pinia-plugin-persistedstate` 引发依赖冲突 | 移除该插件 | ✅ 已修复 |
| 7 | SSH 终端字体缩放后行列错位 | 只改 `term.options.fontSize` 未重新 fit | 封装 `applyFont()`，每次改字号后调用 `fitAddon.fit()` | ✅ 已修复 |
| 8 | SSH 清屏不彻底/无快捷键 | 仅调用 `term.clear()`，未给 shell 发 Ctrl+L | `clearScreen()` 发送 `\x0c` 触发 shell 重绘；新增 `clearAll()` 彻底清空 scrollback | ✅ 已修复 |
| 9 | 前端旧 CSS Token 残留 | `--ops-bg-secondary`、`--ops-text-secondary`、`--ops-primary-hover` 未清理 | 全量替换为 `--ops-bg-2`、`--ops-text-2`、`--accent-blue` | ✅ 已修复 |
| 10 | 组件 scoped style 重复定义 | `.status-dot`、`.ssh-toolbar`、`.vnc-toolbar`、`.qc-item` 被多处重复定义 | 统一收归 `theme.scss`，组件内只保留子元素细节 | ✅ 已修复 |
| 11 | el-card 多彩强调条缺失 | 大量 `<el-card>` 未加 `accent-{color}` | 为 Dashboard/Hosts/Commands/Logs/Users/WebDAV 等页面统一分配 accent 色 | ✅ 已修复 |
| 12 | 协议 tag 无颜色区分 | Hosts/Logs 页面协议列只有默认 tag | 统一使用 `protocol-{ssh|vnc|rdp|tcp}` class，映射到青/紫/粉/橙 | ✅ 已修复 |
| 13 | 登录页标题无渐变 | 缺少多彩主题品牌感 | 标题文字使用蓝紫粉三色渐变 | ✅ 已修复 |

### 2.2 已知但未修复的问题

| # | 问题 | 影响 | 备注 |
|---|---|---|---|
| 1 | 自动重连失败后不会停止，会无限重试 | 用户体验差，错误信息分散 | **待实现需求** |
| 2 | 连接错误以 `ElMessage.error` 吐司形式弹出，没有统一弹框 | 错误信息容易被忽略 | **待实现需求** |
| 3 | 未连接主机时，会话/设置页面的显示逻辑不明确 | 用户可能看到空白或错误页面 | **待实现需求** |
| 4 | Vite build 有 large chunk 警告 | 首屏加载可能较慢 | 可配置 `manualChunks` 拆分 |
| 5 | Docker 未实际跑通 | 无法确认生产部署可行性 | 需要实际构建验证 |

---

## 三、优化建议

### 3.1 连接管理优化

1. **统一连接状态机**
   - 把 `disconnected / connecting / connected / error` 四种状态集中到一个 composable（如 `useConnection()`）
   - SSH/VNC/RDP/TCP 都复用同一套状态机，避免各组件重复写重连逻辑

2. **自动重连策略**
   - 第一次断开后 1s 重试，第二次 3s，第三次 5s
   - 3 次失败后进入 `permanent-error` 状态，弹出确认框
   - 用户点击「继续连接」才重置计数器继续尝试

3. **错误弹框组件**
   - 建议新建 `ConnectionErrorDialog.vue`
   - 显示：错误原因、重试次数、目标主机、两个按钮
   - 提供「取消连接」（关闭 Tab / 回到主页）和「继续连接」（重置计数重试）

### 3.2 路由/页面状态联动

1. **会话 Tab 的动态显示**
   - 左侧菜单「会话」入口：未连接任何主机时隐藏或置灰
   - 连接主机后自动展开会话 Tab 并激活

2. **设置页面的回退逻辑**
   - 如果用户直接访问 `/settings/hosts` 但当前没有活跃连接，自动跳回 Dashboard
   - 或者改成：设置页面始终可访问，但「会话」区域无连接时显示空状态提示

3. **主页（Dashboard）作为兜底页**
   - 任何无连接状态的页面都回退到 Dashboard
   - Dashboard 上提供明显的「快速连接」入口

### 3.3 前端工程化

1. **Vite chunk 拆分**
   ```js
   // vite.config.js
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           element: ['element-plus'],
           xterm: ['xterm', 'xterm-addon-fit', 'xterm-addon-search', 'xterm-addon-web-links'],
           noVNC: ['@novnc/novnc'],
           vendor: ['vue', 'vue-router', 'pinia']
         }
       }
     }
   }
   ```

2. **主题 Token 继续收敛**
   - 把 `theme.scss` 拆成 `_tokens.scss`、`_element.scss`、`_ops-components.scss` 三个文件
   - 当前单文件已 500+ 行，拆分后更易维护

3. **图标按需导入检查**
   - 当前 `@element-plus/icons-vue` 是全量 import，确认是否启用了 tree-shaking
   - 若 chunk 仍大，可改为每个组件单独 `import { Refresh } from '@element-plus/icons-vue'`

### 3.4 安全与体验

1. **WebDAV 只读回归测试**
   - 用 curl 覆盖：PROPFIND ✅ / PUT 403 / DELETE 403 / MKCOL 403 / MOVE 403 / COPY 403
   - 写入类操作要同时拦截 source 和 destination

2. **审计日志增强**
   - 记录重连行为：每次自动重连都写一条日志
   - 记录用户主动「继续连接」/「取消连接」的决策

3. **快捷键文档化**
   - 在 SSH 终端底部已加了快捷键提示条
   - 建议在「帮助」菜单或 Dashboard 再加一个全局快捷键说明弹窗

### 3.5 测试建议

| 测试类型 | 内容 |
|---|---|
| 单元测试 | 连接状态机、WebDAV 权限判断、命令变量替换 |
| E2E 测试 | 登录 → 添加主机 → SSH 连接 → 执行命令 → SFTP 上传 → 断开 |
| 视觉回归 | Dashboard / Hosts / 登录页多色主题截图对比 |
| Docker 集成 | `docker compose up -d` → 访问 3000/8081 → 停止后数据仍在 |

---

## 四、下一步行动建议

按优先级排序：

1. **实现连接错误弹框 + 3 次重连停止**（高优先级，影响核心体验）
2. **明确会话/设置页面在未连接时的回退逻辑**（高优先级）
3. **配置 Vite manualChunks 消除 large chunk 警告**（中优先级）
4. **跑通 Docker 部署并验证数据持久化**（中优先级）
5. **补全部署文档 `docs/DEPLOYMENT.md`**（中优先级）
6. **做一轮 WebDAV 只读权限回归测试**（中优先级）

---

*本文件应随开发进展持续更新。*
