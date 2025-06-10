import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomePage.vue')
  },
  {
    path: '/chats/:chatId/user',
    name: 'chat-user',
    component: () => import('../views/ChatUserView.vue')
  },
  {
    path: '/chats/:chatId/assistant',
    name: 'chat-assistant',
    component: () => import('../views/ChatAssistantView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router