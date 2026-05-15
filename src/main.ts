import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App'
import './global.less'

// 创建 Vue 应用实例、注册 Pinia 并挂载到 #app
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')
