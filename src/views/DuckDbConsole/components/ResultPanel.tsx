import { defineComponent, ref, h, PropType } from 'vue'
import { NTabs, NTabPane, NDataTable, NEmpty } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'

/** 日志条目 */
export interface LogEntry {
  time: string
  type: 'success' | 'error' | 'info'
  message: string
}

export default defineComponent({
  name: 'ResultPanel',
  props: {
    /** 表格数据 */
    data: {
      type: Array as PropType<any[]>,
      default: () => [],
    },
    /** 表格列定义 */
    columns: {
      type: Array as PropType<DataTableColumns<any>>,
      default: () => [],
    },
    /** 日志列表 */
    logs: {
      type: Array as PropType<LogEntry[]>,
      default: () => [],
    },
    /** 全局加载状态 */
    loading: {
      type: Boolean,
      default: false,
    },
    /** 是否正在加载更多（无限滚动触发） */
    isLoadingMore: {
      type: Boolean,
      default: false,
    },
    /** 无数据时的提示文本 */
    emptyDescription: {
      type: String,
      default: '暂无数据，请在上方编辑器中输入 SQL 并点击执行',
    },
    /** 滚动到底部时触发加载更多 */
    onLoadMore: {
      type: Function as PropType<() => void>,
      default: undefined,
    },
  },
  setup(props) {
    /** 表格外层容器的 DOM 引用 */
    const dataWrapperRef = ref<HTMLElement | null>(null)

    /** 表格容器滚动事件：触底判断加载更多 */
    function handleDataScroll(e: Event) {
      const target = e.target as HTMLElement
      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
        props.onLoadMore?.()
      }
    }

    /**
     * 富文本渲染：将错误消息中的关键标识符高亮加粗
     */
    function renderHighlightedText(text: string) {
      const regex = /(商业版A|18100847)/g
      const parts = text.split(regex)
      return parts.map((part, i) => {
        if (part === '商业版A' || part === '18100847') {
          return h('strong', { key: i, style: { color: '#d03050', fontWeight: 'bold' } }, part)
        }
        return h('span', { key: i }, part)
      })
    }

    return () => (
      <div class="result-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <NTabs
          type="segment"
          size="small"
          {...({ displayDirective: 'show' } as any)}
          class="result-tabs"
          pane-wrapper-style={{ flex: 1, overflow: 'hidden' }}
          pane-style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          {{
            default: () => [
              <NTabPane name="data" tab="数据" key="data">
                <div
                  class="data-wrapper"
                  style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                  ref={(el) => {
                    dataWrapperRef.value = el as HTMLElement | null
                  }}
                >
                  {props.data.length > 0 ? (
                    <NDataTable
                      columns={props.columns}
                      data={props.data}
                      loading={props.loading || props.isLoadingMore}
                      bordered
                      singleLine={false}
                      size="small"
                      flex-height={true}
                      style={{ flex: 1 }}
                      class="data-table"
                      onScroll={handleDataScroll}
                    />
                  ) : (
                    <NEmpty
                      description={
                        props.loading || props.isLoadingMore
                          ? '正在执行查询...'
                          : props.emptyDescription
                      }
                      class="panel-empty"
                    />
                  )}
                </div>
              </NTabPane>,
              <NTabPane name="log" tab="日志" key="log">
                <div class="log-container">
                  {props.logs.length > 0 ? (
                    props.logs.map((log, index) => (
                      <div
                        key={index}
                        class={[
                          'log-item',
                          log.type === 'error'
                            ? 'log-error'
                            : log.type === 'success'
                              ? 'log-success'
                              : 'log-info',
                        ]}
                      >
                        <span class="log-time">{log.time}</span>
                        <span class="log-text">
                          {renderHighlightedText(log.message)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <NEmpty description="暂无日志记录" class="panel-empty" />
                  )}
                </div>
              </NTabPane>,
            ],
          }}
        </NTabs>
      </div>
    )
  },
})
