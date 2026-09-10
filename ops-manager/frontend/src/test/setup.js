import { config } from '@vue/test-utils';

// 默认 stub 复杂子组件与图标，避免测试被 UI 库细节干扰
config.global.stubs = {
  ...config.global.stubs,
  'el-icon': true
};

// 清理 jsdom 的 localStorage
beforeEach(() => {
  window.localStorage.clear();
});
