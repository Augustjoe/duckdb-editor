import { defineComponent, ref, PropType } from 'vue'
import { NButton, NIcon, NTabs, NTabPane, useMessage } from 'naive-ui'
import { PlayOutline, PricetagsOutline } from '@vicons/ionicons5'
import { Codemirror } from 'vue-codemirror'
import { sql as sqlLang } from '@codemirror/lang-sql'

export default defineComponent({
  name: 'SqlEditor',
  props: {
    sql: {
      type: String,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    /** CodeMirror 扩展（至少包含 sql()） */
    extensions: {
      type: Array as PropType<any[]>,
      default: () => [sqlLang()],
    },
    /** 编辑器占位提示文本 */
    placeholder: {
      type: String,
      default: '在此输入 SQL 语句...',
    },
    /** 当前激活的编辑器 Tab（由父组件分发） */
    activeTab: {
      type: String,
      default: 'query',
    },
    /** v-model 更新回调 */
    'onUpdate:sql': {
      type: Function as PropType<(val: string) => void>,
      default: undefined,
    },
    /** activeTab 更新回调（由父组件分发） */
    'onUpdate:activeTab': {
      type: Function as PropType<(val: string) => void>,
      default: undefined,
    },
    /** 执行全部 SQL 回调 */
    onExecuteAll: {
      type: Function as PropType<() => void>,
      default: undefined,
    },
    /** 执行选中 SQL 回调（携带选中文本） */
    onExecuteSelected: {
      type: Function as PropType<(sql: string) => void>,
      default: undefined,
    },
  },
  setup(props) {
    const message = useMessage()
    // 专门存储 CodeMirror EditorView 实例（通过 onReady 事件获取）
    const cmViewRef = ref<any>(null)

    function handleReady(payload: any) {
      // payload 包含 view, state, container
      cmViewRef.value = payload.view
    }

    /** 执行选中 SQL：通过 onReady 捕获的 EditorView 实例精准提取选区 */
    function handleExecuteSelected() {
      const view = cmViewRef.value
      if (!view || !view.state) {
        props.onExecuteSelected?.('')
        return
      }

      // 从 EditorState 中精准提取当前选中的文本
      const selection = view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to,
      )

      if (!selection || selection.trim() === '') {
        message.warning('请先选中要执行的 SQL')
        return
      }

      // 提取成功，将选中文本传给父组件
      props.onExecuteSelected?.(selection)
    }

    return () => {
      return (
        <div class="editor-panel">
          {/* 页签头部 */}
          <div class="editor-tabs-header">
            <NTabs
              type="line"
              size="medium"
              value={props.activeTab}
              onUpdate:value={(val: string) => {
                ;(props as any)['onUpdate:activeTab']?.(val)
              }}
              class="editor-tabs"
            >
              <NTabPane name="query" tab="查询" />
              <NTabPane name="update" tab="更新" />
              <NTabPane name="execute" tab="建表" />
            </NTabs>
          </div>

          {/* CodeMirror 编辑器 */}
          <div class="codemirror-wrapper">
            <Codemirror
              modelValue={props.sql}
              onUpdate:modelValue={(val: string) => {
                ;(props as any)['onUpdate:sql']?.(val)
              }}
              onReady={handleReady}
              extensions={props.extensions}
              style={{ height: '100%' }}
              placeholder={props.placeholder}
            />
          </div>

          {/* 悬浮操作按钮区 */}
          <div class="execute-fab">
            <NButton
              type="primary"
              size="large"
              onClick={() => props.onExecuteAll?.()}
              loading={props.loading}
              round
              class="execute-btn-main"
            >
              {{
                icon: () => (
                  <NIcon>
                    <PlayOutline />
                  </NIcon>
                ),
                default: () => '执行当前 SQL',
              }}
            </NButton>
            <NButton
              type="warning"
              size="large"
              onClick={handleExecuteSelected}
              loading={props.loading}
              round
              class="execute-btn-selection"
            >
              {{
                icon: () => (
                  <NIcon>
                    <PricetagsOutline />
                  </NIcon>
                ),
                default: () => '执行选中 SQL',
              }}
            </NButton>
          </div>
        </div>
      )
    }
  },
})
