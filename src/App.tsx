import { defineComponent } from 'vue'
import { NMessageProvider, NDialogProvider } from 'naive-ui'
import DuckDbConsole from './views/DuckDbConsole/index'

/**
 * App 根组件
 * 使用 Naive UI 的 message 和 dialog 提供者包裹整个应用，方便全局消息提示和对话框
 */
export default defineComponent({
  name: 'App',
  setup() {
    return () => (
      <NMessageProvider>
        <NDialogProvider>
          <DuckDbConsole />
        </NDialogProvider>
      </NMessageProvider>
    )
  },
})
