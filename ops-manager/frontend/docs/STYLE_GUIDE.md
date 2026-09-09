# OpsManager 多色暗色主题 · 前端样式规范

> 版本：v1.0  
> 适用范围：`frontend/src/assets/theme.scss` 定义的全局 Token 与 Element Plus 覆盖  
> 技术栈：Vue 3 + Vite + Element Plus + SCSS  
> 参考实现：`src/assets/theme.scss`（唯一源文件）

---

## 1. 设计理念

- **暗色基底 + 多彩强调**：以 GitHub Dark 风格的深灰蓝为底，六套 accent 色承担语义与区分
- **运维场景优先**：每种 accent 色有固定领域归属（蓝=主/SSH、紫=远程桌面、青=表格表头、橙=等待、粉=告警、绿=在线）
- **统一 Token**：不直接写色值，只引用 CSS 变量；修改颜色只改 `theme.scss` 一处
- **Element Plus 覆盖**：全局重置写在 `:root` + `.el-xxx` 选择器，不引入 element-plus/theme-chalk

---

## 2. 色彩 Token

### 2.1 背景层级（四级）

| Token | 值 | 用途 |
|---|---|---|
| `--ops-bg` | `#0d1117` | 应用最底层（body / 外容器） |
| `--ops-bg-2` | `#141a22` | 卡片背景 / 侧边栏 |
| `--ops-bg-3` | `#1c232c` | 表头 / 输入框 / 下拉 / hover 态 |
| `--ops-bg-4` | `#252d38` | 更深一层 hover / 选中态 |

### 2.2 边框 & 文字

| Token | 值 | 说明 |
|---|---|---|
| `--ops-border` | `#30363d` | 默认边框 |
| `--ops-border-soft` | `#21262d` | 次级 / 表内分割线 |
| `--ops-text` | `#c9d1d9` | 主文字 |
| `--ops-text-2` | `#8b949e` | 次级文字（label / 说明） |
| `--ops-text-3` | `#6e7681` | 最淡文字（placeholder / disabled） |
| `--ops-text-inverse` | `#0d1117` | 反色（用于亮底按钮文字） |

### 2.3 Accent 六彩（核心调色盘）

```
┌──────────────┬──────────┬─────────┬────────────────────────────┐
│ 名字         │ Token    │  HEX    │ 语义领域                   │
├──────────────┼──────────┼─────────┼────────────────────────────┤
│ 主色蓝       │ accent-blue   │ #58a6ff │ 侧边栏激活、链接、primary 按钮 |
│ 终端青       │ accent-cyan   │ #39c5cf │ 表格表头、SSH、SFTP 文档、info  │
│ 桌面紫       │ accent-purple │ #bc8cff │ VNC / RDP、Tab 激活、高危提示   │
│ 告警粉       │ accent-pink   │ #ff7b9c │ 错误、表单必填*、特别关注       │
│ 等待橙       │ accent-orange │ #ffa657 │ 连接中、文件夹、TCP 协议        │
│ 在线绿       │ accent-green  │ #3fb950 │ 在线主机、成功、success 按钮    │
└──────────────┴──────────┴─────────┴────────────────────────────┘
```

> ⚠️ **禁止** 在组件 SCSS 里硬编码以上 HEX 值，统一用 `var(--accent-xxx)`。

### 2.4 语义色（基于 accent）

| Token | 值 | 说明 |
|---|---|---|
| `--ops-primary` | `var(--accent-blue)` | Element Plus primary |
| `--ops-success` | `var(--accent-green)` | 成功态 |
| `--ops-warning` | `var(--accent-orange)` | 警告 / 等待 |
| `--ops-danger` | `#f85149` | 错误态（固定红，不跟随 accent-pink） |
| `--ops-info` | `var(--accent-cyan)` | 提示 / 信息 |

### 2.5 渐变

| Token | 值 | 用途 |
|---|---|---|
| `--grad-blue` | `linear-gradient(135deg,#388bfd,#58a6ff)` | primary 按钮 / 侧边栏激活 |
| `--grad-purple` | `linear-gradient(135deg,#8957e5,#bc8cff)` | VNC 工具条 / Tab 下划线 |
| `--grad-cyan` | `linear-gradient(135deg,#2eaad8,#39c5cf)` | info 按钮 |
| `--grad-orange` | `linear-gradient(135deg,#db6d28,#ffa657)` | 离线统计卡 |
| `--grad-green` | `linear-gradient(135deg,#2ea043,#3fb950)` | success 按钮 |
| `--grad-pink` | `linear-gradient(135deg,#db61a2,#ff7b9c)` | 登录页标题 |
| `--grad-dashboard` | `linear-gradient(160deg,#58a6ff,#8957e5 45%,#ff7b9c)` | 登录页背景装饰 |

### 2.6 状态色

| Token | 值 | 说明 |
|---|---|---|
| `--status-online` | `#3fb950` | 在线 dot（= accent-green） |
| `--status-offline` | `#6e7681` | 离线 dot（= text-3） |
| `--status-connect` | `#ffa657` | 连接中 dot（= accent-orange） |
| `--status-error` | `#f85149` | 错误 dot |

### 2.7 阴影

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-card` | `0 2px 12px rgba(0,0,0,.4)` | 卡片 |
| `--shadow-pop` | `0 6px 24px rgba(0,0,0,.6)` | Dialog / Drawer / 登录卡 |

---

## 3. Element Plus 组件覆盖

覆盖规则写在 `theme.scss` 的 **"Element Plus 暗色覆盖"** 区块内。新增规则请追加在此区块后。

### 3.1 侧边栏菜单 `.el-menu--dark`

```
默认文字：var(--ops-text-2)
Hover：背景 --ops-bg-3，文字 --accent-blue，左边框 3px accent-blue
激活：背景 linear-gradient(90deg, rgba(accent-blue,.15), transparent)
      文字白色，左边框 3px accent-blue，font-weight 600
```

### 3.2 卡片 `.el-card`

```
背景：--ops-bg-2
边框：1px --ops-border
顶部彩条：3px solid --accent-blue（可通过 accent-{purple|cyan|orange|green|pink} 覆盖）
圆角：8px
阴影：--shadow-card
Header 渐变：linear-gradient(180deg, --ops-bg-3, transparent)，下方分割线 --ops-border-soft，font-weight 600
```

### 3.3 表格 `.el-table`

```
背景：--ops-bg-2
hover 行：rgba(--accent-blue, .08)
行分割线：--ops-border-soft
表头 th：linear-gradient(180deg, --ops-bg-3, rgba(--accent-cyan,.05))
         文字 --accent-cyan，font-weight 600
         border-bottom 2px solid --accent-cyan
圆角：6px + overflow hidden
```

### 3.4 输入框 `.el-input__wrapper / .el-textarea__inner`

```
背景：--ops-bg-3
边框：1px --ops-border inset
文字：--ops-text
focus / hover：1px accent-blue + 外发光 3px rgba(accent-blue,.18)
圆角：6px
```

### 3.5 按钮 `.el-button`

所有 type 按钮使用对应 accent 渐变：

| type | 效果 |
|---|---|
| primary | `--grad-blue` 渐变白底，hover `brightness(1.15)` |
| success | `--grad-green` |
| warning | `--grad-orange` |
| danger | `linear-gradient(135deg,#da3633,#f85149)` |
| info | `--grad-cyan`，文字用 `--ops-text-inverse`（深色） |

圆角 6px，默认按钮用 `--ops-bg-3` + `--ops-border`。

### 3.6 Tab `.el-tabs`

```
激活项文字：--accent-purple，font-weight 600
hover 文字：--accent-blue
下划线：linear-gradient(90deg, accent-blue, accent-purple)，高 3px，圆角 2px
```

### 3.7 Tag `.el-tag`

所有 Tag 一律采用半透明底色 + 同色边框：

```
default：rgba(accent-blue,.15)  + 1px rgba(accent-blue,.4)  + accent-blue
info   ：rgba(accent-cyan,.15)  + 1px rgba(accent-cyan,.4)  + accent-cyan
success：rgba(accent-green,.15) + 1px rgba(accent-green,.4) + accent-green
warning：rgba(accent-orange,.15)+ 1px rgba(accent-orange,.4)+ accent-orange
danger ：rgba(248,81,73,.15)   + 1px rgba(248,81,73,.4)   + #f85149
圆角 4px，font-weight 500
```

### 3.8 Dialog / Drawer

```
背景：--ops-bg-2
圆角：10px
阴影：--shadow-pop
Title：--accent-blue，font-weight 600
Header 底部分割线：--ops-border-soft
```

### 3.9 滚动条

```
宽 / 高：8px
轨道：--ops-bg
滑块：linear-gradient(180deg, accent-blue, accent-purple)，圆角 4px
hover：linear-gradient(180deg, accent-cyan, accent-pink)
```

---

## 4. 运维专属组件样式

以下 class **不是 Element Plus 自带**，是运维系统自定义样式，写在 `theme.scss` 的「运维系统专属组件风格」区块。

### 4.1 状态徽章 `.status-dot / .node-status / .tab-status`

```scss
<span class="status-dot online"><i class="dot"/>在线</span>
<span class="status-dot connecting"><i class="dot"/>连接中</span>
<span class="status-dot offline"><i class="dot"/>离线</span>
<span class="status-dot disconnected"><i class="dot"/>异常</span>
```

| 类名 | 底色 | 文字色 | dot 发光 | 动画 |
|---|---|---|---|---|
| `.online / .status-online` | `rgba(63,185,80,.15)` | green | ✅ | — |
| `.offline / .status-offline` | `rgba(110,118,129,.15)` | gray | ✅ | — |
| `.connecting / .status-connecting` | `rgba(255,166,87,.15)` | orange | ✅ | pulse 1.2s |
| `.disconnected` | `rgba(248,81,73,.15)` | red | ✅ | — |

dot 尺寸 7×7，发光 `box-shadow: 0 0 6px currentColor`。

### 4.2 Dashboard 统计卡 `.stat-card`

配合 `.el-card` 使用，四种主色：

| 类名 | 大数字色 | 顶部 3px 彩条 |
|---|---|---|
| `.stat-blue` | `--accent-blue` | `--grad-blue` |
| `.stat-green` | `--accent-green` | `--grad-green` |
| `.stat-orange` | `--accent-orange` | `--grad-orange` |
| `.stat-purple` | `--accent-purple` | `--grad-purple` |

```vue
<el-card class="stat-card stat-blue">
  <div class="stat-icon">🖥️</div>
  <div class="stat-value">{{ total }}</div>
  <div class="stat-label">主机总数</div>
</el-card>
```

### 4.3 卡片顶部彩色强调条（通用 accent）

在任何 `.el-card` 上追加以下 class 切换顶部 3px 彩条：

| class | 彩条颜色 | 典型用途 |
|---|---|---|
| `.accent-purple` | `--accent-purple` | VNC / RDP / 快速操作面板 |
| `.accent-cyan` | `--accent-cyan` | 活动日志 / SSH 相关 |
| `.accent-orange` | `--accent-orange` | 告警面板 / 离线主机 |
| `.accent-green` | `--accent-green` | 在线主机概览 |
| `.accent-pink` | `--accent-pink` | 审计失败 / 高危提示 |

> 不指定时默认 `--accent-blue`（由 `.el-card { border-top: 3px solid var(--accent-blue) }` 设定）。

### 4.4 协议 Tag `.protocol-xxx`

给 `<el-tag>` 直接加 class，四种协议各一色：

```vue
<el-tag size="small" :class="`protocol-${host.protocol}`">SSH</el-tag>
```

| class | 效果 |
|---|---|
| `.protocol-ssh` | 青色 (cyan) |
| `.protocol-vnc` | 紫色 (purple) |
| `.protocol-rdp` | 粉色 (pink) |
| `.protocol-tcp` | 橙色 (orange) |

> 这些 class 也适配非 Element Plus 的原生 span，内部写了独立的 `.el-tag.protocol-xxx` 选择器。

### 4.5 终端工具条

| class | 底色 | 下边框 | 用途 |
|---|---|---|---|
| `.ssh-toolbar` | `linear-gradient(90deg, rgba(blue,.08), rgba(purple,.08))` | `--accent-purple` | SSH 终端顶部 |
| `.vnc-toolbar` | `linear-gradient(90deg, rgba(purple,.12), rgba(pink,.12))` | `--accent-pink` | VNC / RDP 顶部 |

### 4.6 快捷命令 `.qc-item`

```scss
.qc-item {
  background: rgba(--accent-cyan, .08);
  border: 1px solid rgba(--accent-cyan, .25);
  transition: all .2s;
  &:hover {
    background: rgba(--accent-cyan, .18);
    border-color: --accent-cyan;
    color: --accent-cyan;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(--accent-cyan, .15);
  }
}
```

### 4.7 登录页 `.login-wrapper / .login-card`

```
.login-wrapper：三层 radial-gradient 装饰 + linear-gradient 基底
  - circle at 15% 20%:   rgba(blue,.25)
  - circle at 85% 30%:   rgba(purple,.22)
  - circle at 50% 85%:   rgba(pink,.18)
  - base: linear-gradient(180deg, #0d1117, #0a0e14)

.login-card 顶部彩条：border-image linear-gradient(90deg, blue, purple, pink)
```

### 4.8 表单相关

| Token / 规则 | 值 |
|---|---|
| `--accent-blue` | 表单项 label 颜色 |
| `--accent-pink` | 必填项红色 *（通过 `.el-form-item.is-required::before`） |

### 4.9 审计日志文字

```scss
.log-success { color: var(--accent-green); }  // 成功
.log-fail    { color: var(--accent-pink); }   // 失败
```

### 4.10 全局交互细节

| 项目 | 规则 |
|---|---|
| 选中文字 `::selection` | 底色 `rgba(--accent-purple,.45)`，白字 |
| 全局链接 `a` | 常态 `--accent-blue`，hover `--accent-cyan` |
| 高亮 mark | 底色 `rgba(--accent-orange,.3)`，字 `--accent-orange` |

---

## 5. 使用规范（组件开发 Checklist）

### ✅ 必须遵守

1. **只通过 CSS 变量取色**，禁止硬编码 HEX 到 Vue 组件 `<style>` 中  
   ```scss
   // ✅ 正确
   .my-card { border-top: 3px solid var(--accent-purple); }
   
   // ❌ 错误
   .my-card { border-top: 3px solid #bc8cff; }
   ```

2. **协议 / 状态 / accent 色必须复用**现有语义 class，不要在新组件里再定义一套  
   ```vue
   <!-- ✅ 正确：复用 .protocol-vnc -->
   <el-tag :class="`protocol-${h.protocol}`">{{ h.protocol }}</el-tag>
   
   <!-- ❌ 错误：新写一套 color -->
   <span style="color: #bc8cff">{{ h.protocol }}</span>
   ```

3. **卡片顶部有彩色强调条**，默认蓝色；用 accent class 切换  
   ```vue
   <el-card class="accent-cyan" header="活动日志">
   ```

4. **状态展示统一使用 `.status-dot`**，带 dot + 文字；不要自己拼 `span + icon`  
   ```vue
   <span class="status-dot" :class="host.status"><i class="dot"/>在线</span>
   ```

5. **新增 accent 色需要时**，先在 `theme.scss` 的 `:root` 加 Token，再在各组件里引用；不要在组件里临时写 `$new-color` 变量

### ⚠️ 建议遵守

| 项 | 建议 |
|---|---|
| 按钮 | 优先使用 Element Plus 内置 `type`（primary/success/warning/danger/info），它们自动带渐变色 |
| 新统计卡 | 复用 `.stat-card stat-{color}` 组合，保持统一视觉 |
| 错误 / 告警文字 | 复用 `.log-fail / .log-success` 或用 `<el-tag type="danger">` |
| 动效时长 | 状态连接中用 `pulse 1.2s`，其余 hover 用 `transition: all .15~.2s` |
| 圆角 | 按钮 / 输入框 6px，卡片 / Dialog 8~10px，状态徽章 10px |

### 🚫 禁止

- 引入 element-plus/theme-chalk 暗色包（与我们的主题冲突）
- 在任意位置写 `color: white` / `#fff`（会破坏 Token 一致性，应该用 `#fff` 仅出现在按钮文字等白色合理处）
- 把 Element Plus 默认亮色变量覆盖回去（如 `--el-menu-bg-color` 等）

---

## 6. 主题文件结构

```
theme.scss
├── :root { ... }                     // 所有 CSS 变量 Token（唯一源文件）
├── html, body                        // 全局基础覆盖
├── Element Plus 暗色覆盖
│   ├── .el-menu--dark                // 侧边栏
│   ├── .el-card                      // 卡片 + accent-{color}
│   ├── .el-table                     // 表格（表头 cyan）
│   ├── .el-input__wrapper 等         // 表单控件
│   ├── .el-button                    // 六种渐变按钮
│   ├── .el-pagination                // 分页
│   ├── .el-tabs                      // Tab（紫激活 + 渐变下划线）
│   ├── .el-dialog, .el-drawer        // 弹窗
│   ├── .el-tag                       // Tag 半透明方案
│   ├── ::-webkit-scrollbar           // 滚动条（蓝紫渐变）
│   ├── .el-empty / .el-divider       // 其他
│   └── .el-select-dropdown / popper  // 下拉
└── 运维系统专属组件风格
    ├── .status-dot / .node-status    // 状态徽章
    ├── .stat-card                    // Dashboard 统计卡
    ├── .login-wrapper / .login-card  // 登录页装饰
    ├── .ssh-toolbar / .vnc-toolbar   // 终端工具条
    ├── .qc-item                      // 快捷命令
    ├── .protocol-xxx                 // 协议 tag
    ├── .log-success / .log-fail      // 审计日志颜色
    └── ::selection / a / mark        // 全局细节
```

---

## 7. 常见改动场景

### 7.1 想换某个 accent 色

只改 `theme.scss` 里的 Token 值：

```scss
:root {
  --accent-green: #2ea043;   // ← 改这里，所有引用它的地方自动更新
}
```

> 注意同步更新对应的 `--grad-green`、`--status-online`（它们可能复用同一个 HEX）。

### 7.2 想让某个 el-card 用橙色强调条

```vue
<el-card class="accent-orange" header="离线主机">
```

### 7.3 想新增一种彩色状态（例如 warning 黄色）

1. `:root` 加 Token：
   ```scss
   --accent-yellow: #d29922;
   --grad-yellow: linear-gradient(135deg, ...);
   --status-warning: #d29922;
   ```
2. 在 `.status-dot` 组里追加 class 样式
3. 给 `.el-card` 追加 `.accent-yellow` 覆盖

---

## 8. 浏览器兼容性

| 目标 | 支持 |
|---|---|
| Chromium 100+ / Edge | ✅ 完整 |
| Firefox 100+ | ✅ 完整（渐变 / backdrop-filter 全部支持） |
| Safari 15.4+ | ✅ 完整 |
| IE11 | ❌ 不支持 CSS 变量（项目本来也不兼容 IE） |

> `build.target` 已设为 `es2022`，与 noVNC top-level await 匹配。

---

## 9. 快速速查卡

```
┌─ 需要做什么 ────────┬─ 怎么写 ──────────────────────────────────────┐
│ 主色按钮            │ <el-button type="primary">                   │
│ 成功提示            │ <el-tag type="success"> 或 class="log-fail" │
│ 状态徽章            │ <span class="status-dot" :class="s"><i class="dot"/>...</span> │
│ 协议彩色 tag        │ <el-tag :class="`protocol-${p}`">           │
│ 顶部橙色强调条卡    │ <el-card class="accent-orange">              │
│ 统计卡绿色          │ <el-card class="stat-card stat-green">      │
│ SSH 工具条底色      │ class="ssh-toolbar"                          │
│ VNC 工具条底色      │ class="vnc-toolbar"                          │
│ 快速命令 hover 感   │ class="qc-item"                               │
│ 审计成功文字        │ class="log-success"                          │
│ 审计失败文字        │ class="log-fail"                             │
│ 表单项 label 彩     │ 自动生效，无需处理                           │
│ 必填项红色 *        │ 自动生效，无需处理                           │
└─────────────────────┴──────────────────────────────────────────────┘
```

---

**唯一源文件**：`frontend/src/assets/theme.scss`  
**任何样式问题** → 先查本文档 Section 5 Checklist → 再去该文件定位 → 禁止在组件里绕开 Token

