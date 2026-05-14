import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    // 【关键】配置代理，将 /bdmp-connector-master 代理到后端服务，解决跨域问题
    proxy: {
      '/bdmp-connector-master': {
        target: 'http://10.86.151.94:8689',
        changeOrigin: true,
        // 保持原始路径，不重写
      },
    },
  },
})
