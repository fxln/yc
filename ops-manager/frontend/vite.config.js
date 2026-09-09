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
    // 避免 chunk 太大
    rollupOptions: {
      output: {
        manualChunks: {
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
          'xterm': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links', 'xterm-addon-search'],
          'novnc': ['@novnc/novnc'],
          'vendor': ['axios', 'pinia', 'vue-router']
        }
      }
    }
  }
});
