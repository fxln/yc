# =======================================================
# OpsManager 多阶段构建 Dockerfile
# Phase 1: 编译 Vue3 前端
# Phase 2: 安装 Node 后端 + 合并前端 dist 到镜像
# =======================================================

# —— Phase 1: 前端构建 ——
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
# 先复制依赖清单以便利用 layer 缓存
COPY frontend/package.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install --no-audit --no-fund
# 复制前端源码
COPY frontend/ ./
# 生产构建（所有依赖本地打包进 dist，无任何外部 CDN）
RUN npm run build

# —— Phase 2: 后端运行时 ——
FROM node:20-alpine AS runtime
# better-sqlite3 / node-pty 需要编译工具链
RUN apk add --no-cache python3 make g++ tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && npm config set registry https://registry.npmmirror.com

WORKDIR /app

# 后端依赖
COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# 后端源码
COPY backend/src ./src

# 前端构建产物（静态文件，由后端 Express serve）
COPY --from=frontend-builder /build/frontend/dist /app/frontend/dist

# 数据目录（运行时由 volume 挂载覆盖）
RUN mkdir -p /app/data/db /app/data/logs /app/data/webdav /app/data/ssh_keys

# 非 root 用户运行（可选）
RUN adduser -D -H opsmgr \
    && chown -R opsmgr:opsmgr /app
USER opsmgr

# 端口：HTTP 3000、WebDAV 8081
EXPOSE 3000 8081

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r)=>{process.exit(r.statusCode===200?0:1);}).on('error',()=>process.exit(1))"

ENV NODE_ENV=production \
    TZ=Asia/Shanghai

VOLUME ["/app/data"]

CMD ["node", "src/app.js"]
