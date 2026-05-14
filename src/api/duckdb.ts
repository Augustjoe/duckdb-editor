/**
 * DuckDB API 服务模块 (Mock 版本)
 * 前端脱机演示用 —— 拦截所有请求并使用 setTimeout 模拟网络延迟
 */

const MOCK_DELAY = 300

function delay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 查询数据 (GET) - Mock
 * 根据入参 SQL 内容返回不同的模拟数据集
 * @param sql - 要执行的 SQL 查询语句
 * @returns Promise<any[]> - 查询结果数组
 */
export async function queryData(sql: string): Promise<any[]> {
  await delay()
  const lowerSql = sql.toLowerCase().trim()

  // 包含 show tables → 返回表名列表
  if (lowerSql.includes('show tables')) {
    return [{ name: 'mpc_task_test' }, { name: 'consumer_transfer_process' }]
  }

  // 包含 PRAGMA table_info → 返回字段信息
  if (lowerSql.includes('pragma table_info')) {
    return [
      { cid: 0, name: 'id', type: 'BIGINT', notnull: true },
      { cid: 1, name: 'task_name', type: 'VARCHAR', notnull: true },
    ]
  }

  // 包含 error 关键字 → 模拟权限错误
  if (lowerSql.includes('error')) {
    throw new Error('当前用户（18100847）在调度商业版A环境中无有效权限')
  }

  // 默认普通 SELECT → 返回动态列测试数据
  return [
    { id: 1, task_name: '特征提取', status: '成功' },
    { id: 2, task_name: '模型训练', status: '运行中' },
  ]
}

/**
 * 更新数据 (POST) - Mock
 * @param _sql - 要执行的 SQL 更新语句
 * @returns Promise - 统一返回结构
 */
export async function updateData(_sql: string): Promise<{ code: string; message: string; data: any }> {
  await delay()
  return { code: '000', message: '模拟操作成功执行', data: true }
}

/**
 * 结构变更 / DDL 执行 (POST) - Mock
 * @param _sql - 要执行的 DDL 语句
 * @returns Promise - 统一返回结构
 */
export async function executeSql(_sql: string): Promise<{ code: string; message: string; data: any }> {
  await delay()
  return { code: '000', message: '模拟操作成功执行', data: true }
}
