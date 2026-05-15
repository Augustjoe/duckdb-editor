import { defineComponent, ref, h, onMounted } from 'vue'
import {
  NLayout,
  NLayoutContent,
  NButton,
  NIcon,
  NSplit,
  NScrollbar,
  useMessage,
} from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { sql as sqlLang } from '@codemirror/lang-sql'
import { queryData, updateData, executeSql } from '@/api/duckdb'
import SidebarTree from './components/SidebarTree'
import type { TreeNodeData } from './components/SidebarTree'
import SqlEditor from './components/SqlEditor'
import ResultPanel from './components/ResultPanel'
import type { LogEntry } from './components/ResultPanel'
import './style.less'

/** 无限滚动每次加载的行数 */
const PAGE_SIZE = 50

/** 表格列类型 */
type DataTableColumn = {
  title: string
  key: string
  width?: number
  fixed?: 'left'
  ellipsis?: { tooltip: boolean }
  minWidth?: number
  render?: (rowData: any, rowIndex: number) => any
}

export default defineComponent({
  name: 'DuckDbConsole',
  setup() {
    const message = useMessage()

    // ==================== 核心状态 ====================
    const loading = ref(false)
    const tables = ref<TreeNodeData[]>([])
    /** 当前激活的编辑器 Tab */
    const activeEditorTab = ref('query')
    /** 三个 Tab 各自的 SQL 内容 */
    const sqlMap = ref<Record<string, string>>({
      query: 'show tables',
      update: '',
      execute: '',
    })
    const tableData = ref<any[]>([])
    const tableColumns = ref<DataTableColumn[]>([])
    const logs = ref<LogEntry[]>([])

    // 编辑器扩展
    const cmExtensions = [sqlLang()]

    // ==================== 无限滚动相关状态 ====================
    const currentTableName = ref('')
    const dataOffset = ref(0)
    const isLoadingMore = ref(false)
    const hasMoreData = ref(true)

    // ==================== 工具函数 ====================
    function addLog(type: LogEntry['type'], msg: string) {
      const now = new Date()
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      logs.value.push({ time, type, message: msg })
    }

    function buildColumns(data: any[]) {
      if (!data || data.length === 0) {
        tableColumns.value = []
        return
      }
      const keys = Object.keys(data[0])
      tableColumns.value = [
        {
          title: '*',
          key: '__row_num__',
          width: 60,
          fixed: 'left',
          render(_rowData: any, rowIndex: number) {
            return rowIndex + 1
          },
        },
        ...keys.map((key) => ({
          title: key,
          key: key,
          ellipsis: { tooltip: true } as const,
          minWidth: 100,
        })),
      ]
    }

    // ==================== 左侧树：加载表名 ====================
    async function loadTables() {
      loading.value = true
      addLog('info', '[发起请求] 接口: GET /query, 入参: { querySql: "show tables" }')
      try {
        const result = await queryData<any[]>('show tables')
        addLog('success', `[请求成功] 接口: GET /query, 出参: ${JSON.stringify(result).substring(0, 150)}...`)
        tables.value = result.map((row: any, index: number) => {
          const tableName = row.name || row.table_name || row.Name || (Object.values(row)[0] as string)
          return {
            key: `table-${index}`,
            label: tableName,
            tableName,
            isLeaf: false,
          }
        })
        addLog('info', `成功加载 ${tables.value.length} 个表`)
      } catch (err: any) {
        addLog('error', `加载表失败: ${err.message}`)
      } finally {
        loading.value = false
      }
    }

    // ==================== 左侧树：单击展开 → PRAGMA table_info ====================
    async function handleNodeClick(node: TreeNodeData) {
      if (!node.tableName) return
      if (node.children && node.children.length > 0) return

      addLog('info', `[发起请求] 接口: GET /query, 入参: { querySql: "PRAGMA table_info('${node.tableName}')" }`)
      try {
        const result = await queryData<any[]>(`PRAGMA table_info('${node.tableName}')`)
        addLog('success', `[请求成功] 接口: GET /query, 出参: ${JSON.stringify(result).substring(0, 150)}...`)
        node.children = result.map((col: any, index: number) => {
          const colName = col.name || col.column_name || ''
          const colType = col.type || col.data_type || ''
          return {
            key: `${node.key}-col-${index}`,
            label: `${colName} (${colType})`,
            isLeaf: true,
          } as TreeNodeData
        })
        addLog('info', `已加载表 "${node.tableName}" 的 ${node.children!.length} 个字段`)
        tables.value = [...tables.value]
      } catch (err: any) {
        addLog('error', `加载字段失败: ${err.message}`)
      }
    }

    // ==================== 左侧树：双击表节点 → SELECT * FROM 表 ====================
    async function handleNodeDblClick(node: TreeNodeData) {
      if (!node.tableName) return
      currentTableName.value = node.tableName
      dataOffset.value = 0
      hasMoreData.value = true
      isLoadingMore.value = false
      tableData.value = []

      loading.value = true
      addLog('info', `[发起请求] 接口: GET /query, 入参: { querySql: "SELECT * FROM ${node.tableName} LIMIT ${PAGE_SIZE} OFFSET 0" }`)
      try {
        const data = await queryData<any[]>(
          `SELECT * FROM ${node.tableName} LIMIT ${PAGE_SIZE} OFFSET 0`,
        )
        addLog('success', `[请求成功] 接口: GET /query, 出参: ${JSON.stringify(data).substring(0, 150)}...`)
        tableData.value = data
        if (data.length === 0) hasMoreData.value = false
        buildColumns(data)
        addLog('success', `已加载表 "${node.tableName}" 的前 ${data.length} 行数据`)
      } catch (err: any) {
        tableData.value = []
        tableColumns.value = []
        addLog('error', `加载数据失败: ${err.message}`)
      } finally {
        loading.value = false
      }
    }

    // ==================== 无限滚动：加载下一页 ====================
    async function handleLoadMore() {
      if (isLoadingMore.value || !hasMoreData.value || !currentTableName.value) return
      isLoadingMore.value = true
      const nextOffset = dataOffset.value + PAGE_SIZE

      addLog('info', `[发起请求] 接口: GET /query, 入参: { querySql: "SELECT * FROM ${currentTableName.value} LIMIT ${PAGE_SIZE} OFFSET ${nextOffset}" }`)
      try {
        const data = await queryData<any[]>(
          `SELECT * FROM ${currentTableName.value} LIMIT ${PAGE_SIZE} OFFSET ${nextOffset}`,
        )
        addLog('success', `[请求成功] 接口: GET /query, 出参: ${JSON.stringify(data).substring(0, 150)}...`)
        if (data.length === 0) {
          hasMoreData.value = false
          addLog('info', '已加载全部数据')
        } else {
          dataOffset.value = nextOffset
          tableData.value = [...tableData.value, ...data]
          addLog('info', `追加加载 ${data.length} 行（总计 ${tableData.value.length} 行）`)
        }
      } catch (err: any) {
        addLog('error', `加载更多数据失败: ${err.message}`)
      } finally {
        isLoadingMore.value = false
      }
    }

    // ==================== 通用 SQL 执行核心逻辑 ====================
    async function handleRunSql(stmt: string) {
      if (!stmt.trim()) {
        message.warning('请输入 SQL 语句')
        return
      }
      currentTableName.value = ''
      hasMoreData.value = false
      loading.value = true

      const tab = activeEditorTab.value

      if (tab === 'query') {
        // ── query Tab：调用 queryData，结果渲染至表格 ──
        addLog('info', `[发起请求] 接口: GET /query, 入参: { querySql: "${stmt}" }`)
        try {
          const result = await queryData<any[]>(stmt)
          addLog('success', `[请求成功] 接口: GET /query, 出参: ${JSON.stringify(result).substring(0, 150)}...`)
          tableData.value = Array.isArray(result) ? result : []
          buildColumns(tableData.value)
          addLog('success', `查询成功，返回 ${tableData.value.length} 行数据`)
          message.success(`查询成功，返回 ${tableData.value.length} 行数据`)
        } catch (err: any) {
          tableData.value = []
          tableColumns.value = []
          addLog('error', `查询失败: ${err.message}`)
          message.error(`${err.message}`)
        } finally {
          loading.value = false
        }
      } else if (tab === 'update') {
        // ── update Tab：调用 updateData，清空表格，仅保留日志 ──
        addLog('info', `[发起请求] 接口: POST /update, 入参: { updateSql: "${stmt}" }`)
        try {
          const result = await updateData(stmt)
          addLog('success', `[请求成功] 接口: POST /update, 出参: ${JSON.stringify(result)}`)
          tableData.value = []
          tableColumns.value = []
          addLog('success', '更新操作执行成功')
          message.success('更新操作执行成功')
        } catch (err: any) {
          tableData.value = []
          tableColumns.value = []
          addLog('error', `更新失败: ${err.message}`)
          message.error(`${err.message}`)
        } finally {
          loading.value = false
        }
      } else if (tab === 'execute') {
        // ── execute Tab：调用 executeSql (API)，清空表格，仅保留日志 ──
        addLog('info', `[发起请求] 接口: POST /execute, 入参: { executeSql: "${stmt}" }`)
        try {
          const result = await executeSql(stmt)
          addLog('success', `[请求成功] 接口: POST /execute, 出参: ${JSON.stringify(result)}`)
          tableData.value = []
          tableColumns.value = []
          addLog('success', 'DDL 操作执行成功')
          message.success('DDL 操作执行成功')
        } catch (err: any) {
          tableData.value = []
          tableColumns.value = []
          addLog('error', `DDL 执行失败: ${err.message}`)
          message.error(`${err.message}`)
        } finally {
          loading.value = false
        }
      }
    }

    // ==================== SQL 编辑器：执行全部 ====================
    function handleExecuteAll() {
      handleRunSql(sqlMap.value[activeEditorTab.value])
    }

    // ==================== SQL 编辑器：执行选中 ====================
    function handleExecuteSelected(selectedSql: string) {
      handleRunSql(selectedSql)
    }

    // ==================== 生命周期 ====================
    onMounted(() => {
      loadTables()
    })

    // ==================== 渲染 ====================
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
              1: () => (
                <div class="sidebar-panel">
                  <div class="sidebar-header">
                    <span class="sidebar-title">数据库导航</span>
                    <NButton
                      size="tiny"
                      quaternary
                      onClick={loadTables}
                      loading={loading.value}
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
                  <NScrollbar class="sidebar-scrollbar">
                    <SidebarTree
                      treeData={tables.value}
                      loading={loading.value}
                      onLoadChildren={handleNodeClick}
                      onNodeDblClick={handleNodeDblClick}
                    />
                  </NScrollbar>
                </div>
              ),
              2: () => (
                <NSplit
                  direction="vertical"
                  default-size={0.45}
                  min="120px"
                  class="work-vsplit"
                >
                  {{
                    1: () => (
                      <SqlEditor
                        sql={sqlMap.value[activeEditorTab.value]}
                        activeTab={activeEditorTab.value}
                        loading={loading.value}
                        extensions={cmExtensions}
                        placeholder="在此输入 SQL 语句..."
                        onUpdate:sql={(val: string) => {
                          sqlMap.value[activeEditorTab.value] = val
                        }}
                        onUpdate:activeTab={(val: string) => {
                          activeEditorTab.value = val
                        }}
                        onExecuteAll={handleExecuteAll}
                        onExecuteSelected={handleExecuteSelected}
                      />
                    ),
                    2: () => (
                      <ResultPanel
                        data={tableData.value}
                        columns={tableColumns.value}
                        logs={logs.value}
                        loading={loading.value}
                        isLoadingMore={isLoadingMore.value}
                        onLoadMore={handleLoadMore}
                      />
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
