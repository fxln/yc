import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// Vite 配置
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      // HTTP API 代理到后端
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      // WebSocket 代理（必须单独配置 ws: true）
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2022',
    // Element Plus 完整组件库压缩后约 880KB，已拆分为独立 chunk，
    // 后续可用 unplugin-vue-components 实现真正按需加载；当前将警告阈值设为 1000KB。
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 第三方依赖按库拆分
          if (id.includes('node_modules')) {
            if (id.includes('@element-plus/icons-vue')) return 'element-icons';
            if (id.includes('element-plus')) return 'element-plus';
            if (id.includes('xterm') || id.includes('@xterm')) return 'xterm';
            if (id.includes('@novnc')) return 'novnc';
            if (id.includes('vue-router')) return 'vue-router';
            if (id.includes('pinia')) return 'pinia';
            if (id.includes('axios')) return 'axios';
            if (id.includes('vue') && !id.includes('vue-router')) return 'vue';
          }
          return null;
        }
      }
    }
  }
});
