import { defineStore } from 'pinia';

/**
 * 多会话 Tab 管理
 * 每个 tab 对应一个远程连接（SSH/VNC/RDP/TCP）
 */
let tabSeq = 1;
function genId() { return 'tab_' + Date.now() + '_' + (tabSeq++); }

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: [], // { id, type(ssh/vnc/rdp/tcp), hostId, hostName, title, status(connecting/connected/disconnected) }
    activeId: null
  }),
  getters: {
    activeTab: (s) => s.tabs.find((t) => t.id === s.activeId) || null
  },
  actions: {
    openTab(tab) {
      const id = tab.id || genId();
      const exist = this.tabs.find((t) => t.hostId === tab.hostId && t.type === tab.type);
      if (exist) {
        this.activeId = exist.id;
        return exist;
      }
      const newTab = { id, status: 'connecting', ...tab };
      this.tabs.push(newTab);
      this.activeId = id;
      return newTab;
    },
    closeTab(id) {
      const idx = this.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;
      this.tabs.splice(idx, 1);
      if (this.activeId === id) {
        this.activeId = this.tabs[idx]?.id || this.tabs[idx - 1]?.id || null;
      }
    },
    setStatus(id, status, msg) {
      const tab = this.tabs.find((t) => t.id === id);
      if (tab) {
        tab.status = status;
        if (msg) tab.msg = msg;
      }
    },
    closeAll() {
      this.tabs = [];
      this.activeId = null;
    }
  }
});
