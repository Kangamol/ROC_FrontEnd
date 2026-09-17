import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    host: true, // listen on IPv4 + IPv6 so http://localhost works from every browser
    proxy: {
      // ElysiaJS API + extracted item icons
      '/api': 'http://localhost:3000',
      '/assets': 'http://localhost:3000',
      '/sprites': 'http://localhost:3000',
    },
  },
})
