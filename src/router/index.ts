import { createRouter, createWebHistory } from 'vue-router'
import SimulatorView from '@/views/SimulatorView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'simulator', component: SimulatorView },
    { path: '/b/:shareCode', name: 'build', component: SimulatorView, props: true },
  ],
})
