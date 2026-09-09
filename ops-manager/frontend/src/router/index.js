import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '主机总览' } },
      { path: 'hosts', name: 'hosts', component: () => import('../views/Hosts.vue'), meta: { title: '主机管理' } },
      { path: 'commands', name: 'commands', component: () => import('../views/Commands.vue'), meta: { title: '快捷命令仓库' } },
      { path: 'users', name: 'users', component: () => import('../views/Users.vue'), meta: { title: '用户管理', admin: true } },
      { path: 'webdav', name: 'webdav', component: () => import('../views/WebDAV.vue'), meta: { title: 'WebDAV 设置', admin: true } },
      { path: 'logs', name: 'logs', component: () => import('../views/Logs.vue'), meta: { title: '系统日志' } }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('ops_token');
  if (to.meta.public) return next();
  if (!token) return next('/login');
  next();
});

export default router;
