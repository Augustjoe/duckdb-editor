import { defineComponent, ref, reactive, h, onMounted } from 'vue'
import {
  NLayout,
  NLayoutContent,
  NButton,
  NIcon,
  NTree,
  NDataTable,
  NTabs,
  NTabPane,
  NSpace,
  NEmpty,
  NSplit,
  useMessage,
} from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import { Codemirror } from 'vue-codemirror'
import { sql } from '@codemirror/lang-sql'
import {
  RefreshOutline,
  PlayOutline,
  GridOutline,
  CodeSlashOutline,
} from '@vicons/ionicons5'
import { queryData, updateData, executeSql } from '@/api/duckdb'
import './style.less'

// ==================== 类型定义 ====================
/** 日志条目 */
interface LogEntry {
  time: string
  type: 'success' | 'error' | 'info'
  message: string
}

/** 树节点数据 */
interface TreeNodeData extends TreeOption {
  key: string
  label: string
  children?: TreeNodeData[]
  isLeaf?: boolean
  tableName?: string
}

/** Tab 键值 */
type TabKey = 'query' | 'update' | 'execute'

export default defineComponent({
  name: 'DuckDbConsole',
  setup() {
    // ==================== 全局消息提示 ====================
    const message = useMessage()

    // ==================== 多页签 SQL 编辑器状态 ====================
    const activeTab = ref<TabKey>('query')
    const tabSqls = reactive<Record<TabKey, string>>({
      query: 'show tables',
      update: '',
      execute: '',
    })
    const cmExtensions = [sql()]

    // ==================== 执行状态 ====================
    const executing = ref(false)
    /** 当前激活的 Tab 标签显示名 */
    const tabLabels: Record<TabKey, string> = {
      query: '查询',
      update: '更新',
      execute: '建表',
    }

    // ==================== 数据库对象树 ====================
    const treeLoading = ref(false)
    const treeData = ref<TreeNodeData[]>([])

    async function loadTables() {
      treeLoading.value = true
      try {
        const result = await queryData('show tables')
        treeData.value = result.map((row: any, index: number) => {
          const tableName = row.name || row.table_name || row.Name || (Object.values(row)[0] as string)
          return {
            key: `table-${index}`,
            label: tableName,
            tableName: tableName,
            isLeaf: false,
            children: [],
          }
        })
        addLog('info', `成功加载 ${treeData.value.length} 个表`)
      } catch (err: any) {
        addLog('error', `加载表失败: ${err.message}`)
      } finally {
        treeLoading.value = false
      }
    }

    async function loadColumns(node: TreeNodeData) {
      if (!node.tableName) return
      if (node.children && node.children.length > 0) return

      try {
        const result = await queryData(`PRAGMA table_info('${node.tableName}')`)
        node.children = result.map((col: any, index: number) => {
          const colName = col.name || col.column_name || ''
          const colType = col.type || col.data_type || ''
          return {
            key: `${node.key}-col-${index}`,
            label: `${colName} (${colType})`,
            isLeaf: true,
          }
        })
        addLog('info', `已加载表 "${node.tableName}" 的 ${node.children.length} 个字段`)
        treeData.value = [...treeData.value]
      } catch (err: any) {
        addLog('error', `加载字段失败: ${err.message}`)
      }
    }

    function nodeProps({ option }: { option: TreeOption }) {
      return {
        onClick() {
          const node = option as TreeNodeData
          if (!node.isLeaf && node.tableName) {
            loadColumns(node)
          }
        },
      }
    }

    function renderTreePrefix({ option }: { option: TreeOption }) {
      const node = option as TreeNodeData
      if (node.isLeaf) {
        return h(NIcon, null, { default: () => h(CodeSlashOutline) })
      }
      return h(NIcon, { color: '#2080f0' }, { default: () => h(GridOutline) })
    }

    // ==================== 结果表格 ====================
    const resultData = ref<any[]>([])
    const resultColumns = ref<any[]>([])

    function buildColumns(data: any[]) {
      if (!data || data.length === 0) {
        resultColumns.value = []
        return
      }
      const keys = Object.keys(data[0])
      resultColumns.value = keys.map((key) => ({
        title: key,
        key: key,
        ellipsis: { tooltip: true },
        minWidth: 100,
      }))
    }

    // ==================== 日志 ====================
    const logMessages = ref<LogEntry[]>([])

    function addLog(type: LogEntry['type'], msg: string) {
      const now = new Date()
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      logMessages.value.push({ time, type, message: msg })
    }

    /**
     * 富文本渲染：将错误消息中的关键标识符高亮加粗
     * 高亮目标：商业版A、18100847
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

    // ==================== 统一执行逻辑 ====================
    async function handleUnifiedExecute() {
      const sql = tabSqls[activeTab.value]
      if (!sql.trim()) {
        message.warning(`请输入 ${tabLabels[activeTab.value]} SQL 语句`)
        return
      }
      executing.value = true
      const tabKey = activeTab.value
      try {
        if (tabKey === 'query') {
          const result = await queryData(sql)
          resultData.value = Array.isArray(result) ? result : []
          buildColumns(resultData.value)
          addLog('success', `查询成功，返回 ${resultData.value.length} 行数据`)
          message.success(`查询成功，返回 ${resultData.value.length} 行数据`)
        } else if (tabKey === 'update') {
          const result = await updateData(sql)
          const msg = result.message || '更新执行成功'
          addLog(result.code === '000' ? 'success' : 'error', `更新结果: ${msg}`)
          if (result.code === '000') {
            message.success(msg)
            loadTables()
          } else {
            message.error(msg)
          }
        } else {
          const result = await executeSql(sql)
          const msg = result.message || '结构变更执行成功'
          addLog(result.code === '000' ? 'success' : 'error', `结构变更: ${msg}`)
          if (result.code === '000') {
            message.success(msg)
            loadTables()
          } else {
            message.error(msg)
          }
        }
      } catch (err: any) {
        if (tabKey === 'query') {
          resultData.value = []
          resultColumns.value = []
        }
        addLog('error', `${tabLabels[tabKey]}失败: ${err.message}`)
        message.error(`${err.message}`)
      } finally {
        executing.value = false
      }
    }

    // ==================== 生命周期 ====================
    onMounted(() => {
      loadTables()
    })

    // ==================== 渲染函数 ====================
    return () => (
      <NLayout class="duckdb-console-layout">
        <NLayoutContent class="main-content">
          <NSplit
            direction="horizontal"
            default-size={0.22}
            min="200px"
            max="400px"
            class="main-hsplit"
          >
            {{
              first: () => (
                /* ==================== 左侧栏：数据库导航 ==================== */
                <div class="sidebar-panel">
                  <div class="sidebar-header">
                    <span class="sidebar-title">数据库导航</span>
                    <NButton
                      size="tiny"
                      quaternary
                      onClick={loadTables}
                      loading={treeLoading.value}
                    >
                      {{
                        icon: () => (
                          <NIcon>
                            <RefreshOutline />
                          </NIcon>
                        ),
                      }}
                    </NButton>
                  </div>
                  <div class="sidebar-tree-wrapper">
                    {treeData.value.length > 0 ? (
                      <NTree
                        data={treeData.value}
                        blockLine
                        nodeProps={nodeProps}
                        keyField="key"
                        labelField="label"
                        childrenField="children"
                        renderPrefix={renderTreePrefix}
                        class="object-tree"
                      />
                    ) : (
                      <NEmpty
                        description={treeLoading.value ? '正在加载...' : '暂无表数据'}
                        class="tree-empty"
                      />
                    )}
                  </div>
                </div>
              ),
              second: () => (
                /* ==================== 右侧工作区 ==================== */
                <NSplit
                  direction="vertical"
                  default-size={0.45}
                  min="120px"
                  class="work-vsplit"
                >
                  {{
                    first: () => (
                      /* ---------- 上半区：多页签编辑器 ---------- */
                      <div class="editor-panel">
                        <div class="editor-tabs-header">
                          <NTabs
                            type="line"
                            size="medium"
                            value={activeTab.value}
                            onUpdate:value={(val: string) => {
                              activeTab.value = val as TabKey
                            }}
                            class="editor-tabs"
                          >
                            <NTabPane name="query" tab="查询" />
                            <NTabPane name="update" tab="更新" />
                            <NTabPane name="execute" tab="建表" />
                          </NTabs>
                        </div>
                        <div class="codemirror-wrapper">
                          <Codemirror
                            modelValue={tabSqls[activeTab.value]}
                            onUpdate:modelValue={(val: string) => {
                              tabSqls[activeTab.value] = val
                            }}
                            extensions={cmExtensions}
                            style={{ height: '100%' }}
                            placeholder={`在此输入 ${tabLabels[activeTab.value]} SQL 语句...`}
                          />
                        </div>
                        {/* 悬浮执行按钮 */}
                        <div class="execute-fab">
                          <NButton
                            type="primary"
                            size="large"
                            onClick={handleUnifiedExecute}
                            loading={executing.value}
                            round
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
                        </div>
                      </div>
                    ),
                    second: () => (
                      /* ---------- 下半区：结果与日志 ---------- */
                      <div class="result-panel">
                        <NTabs type="line" size="small" class="result-tabs">
                          {/* 数据 Tab */}
                          <NTabPane name="data" tab="数据">
                            <div class="data-wrapper">
                              {resultData.value.length > 0 ? (
                                <NDataTable
                                  columns={resultColumns.value}
                                  data={resultData.value}
                                  loading={executing.value}
                                  bordered
                                  singleLine={false}
                                  size="small"
                                  maxHeight="100%"
                                  class="data-table"
                                />
                              ) : (
                                <NEmpty
                                  description={
                                    executing.value
                                      ? '正在执行查询...'
                                      : '暂无数据，请在上方编辑器中输入 SQL 并点击执行'
                                  }
                                  class="panel-empty"
                                />
                              )}
                            </div>
                          </NTabPane>
                          {/* 日志 Tab */}
                          <NTabPane name="log" tab="日志">
                            <div class="log-container">
                              {logMessages.value.length > 0 ? (
                                logMessages.value.map((log, index) => (
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
                                <NEmpty
                                  description="暂无日志记录"
                                  class="panel-empty"
                                />
                              )}
                            </div>
                          </NTabPane>
                        </NTabs>
                      </div>
                    ),
                  }}
                </NSplit>
              ),
            }}
          </NSplit>
        </NLayoutContent>
      </NLayout>
    )
  },
})
