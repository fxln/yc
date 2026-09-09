import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';

import App from './App.vue';
import router from './router';
import './assets/theme.scss';

const app = createApp(App);
const pinia = createPinia();

// 按需注册 Element Plus 图标（避免全量打包所有 SVG 图标）
import {
  Monitor, Promotion, User, Connection, Document,
  Plus, Folder, Close, Loading, Refresh, FullScreen,
  Search, Upload, Download, Delete, Star, StarFilled,
  CopyDocument, DocumentCopy, FolderAdd, Hide,
  ZoomIn, ZoomOut, RefreshRight, MagicStick, Lock,
  Histogram, Picture
} from '@element-plus/icons-vue';

const icons = {
  Monitor, Promotion, User, Connection, Document,
  Plus, Folder, Close, Loading, Refresh, FullScreen,
  Search, Upload, Download, Delete, Star, StarFilled,
  CopyDocument, DocumentCopy, FolderAdd, Hide,
  ZoomIn, ZoomOut, RefreshRight, MagicStick, Lock,
  Histogram, Picture
};
for (const [key, component] of Object.entries(icons)) {
  app.component(key, component);
}

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn, size: 'default' });

app.mount('#app');
