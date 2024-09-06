import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GroupCallOneView from '@/views/GroupCallOneView.vue'
import GroupCallTwoView from '@/views/GroupCallTwoView.vue'
import GroupCallTreeView from '@/views/GroupCallTreeView.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/call/1',
    name: 'call-1',
    component: GroupCallOneView
  },
  {
    path: '/call/2',
    name: 'call-2',
    component: GroupCallTwoView
  },
  {
    path: '/call/3',
    name: 'call-3',
    component: GroupCallTreeView
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
