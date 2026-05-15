/**
 * DuckDB API 服务模块
 * 通过原生 fetch 与后端 /bdmp-connector-master/duckdb 通信
 *
 * 编码策略：手动拼接查询字符串并强制使用 encodeURIComponent，
 * 确保空格被编码为后端可识别的 %20（而非 URLSearchParams 的 +）。
 */

const BASE_URL = '/bdmp-connector-master/duckdb'

/** 后端统一响应结构 (仅适用于 update 和 execute) */
export interface BaseResponse<T = any> {
  code: string
  message: string
  data: T
}

/** 请求公共 Headers（身份认证 + 内容类型） */
function buildHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    // 记得将这里的 Token 替换为你真实的 Token
    Authorization: 'Bearer <你的Token内容>',
  }
}

/**
 * 将键值对手动拼接为 query string
 * 使用 encodeURIComponent 确保空格 → %20
 */
function toQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&')
}

/**
 * 查询数据 (GET)
 * 契约回顾：后端直接返回纯 JSON 数组，非标准包装体
 * @param sql - 要执行的 SQL 查询语句
 * @returns 解析后的数据数组
 */
export async function queryData<T = any>(sql: string): Promise<T[]> {
  const qs = toQueryString({ querySql: sql })
  const url = `${BASE_URL}/query?${qs}`

  console.log('[queryData] 发起请求:', { method: 'GET', url })

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  // query 接口直接返回纯数组
  const json = await response.json()
  
  // 兼容性处理：如果后端后续改成了包装体，这里做了个兜底
  if (Array.isArray(json)) {
    console.log('[queryData] 请求成功, 返回数组长度:', json.length)
    return json
  } else if (json.code && json.data) {
    console.log('[queryData] 请求成功:', { code: json.code, message: json.message })
    return json.data || []
  }
  
  return json
}

/**
 * 更新数据 (POST)
 * 契约回顾：即使是 POST，参数也必须通过 URL Query 传递，并验证 code === '000'
 * @param sql - 要执行的 SQL 更新语句
 * @returns 解析后的 data 字段
 */
export async function updateData(sql: string): Promise<any> {
  const qs = toQueryString({ querySql: sql })
  const url = `${BASE_URL}/update?${qs}`

  console.log('[updateData] 发起请求:', { method: 'POST', url })

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    // 强制不传 body，全靠 URL 参数
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  const json: BaseResponse = await response.json()
  console.log('[updateData] 请求成功:', { code: json.code, message: json.message, data: json.data })

  if (json.code !== '000') {
    throw new Error(`[${json.code}] ${json.message}`)
  }

  return json.data
}

/**
 * 结构变更 / DDL 执行 (POST)
 * 契约回顾：同 update 接口，参数走 URL，验证 code === '000'
 * @param sql - 要执行的 DDL 语句
 * @returns 解析后的 data 字段 (通常是 boolean)
 */
export async function executeSql(sql: string): Promise<boolean> {
  const qs = toQueryString({ querySql: sql })
  const url = `${BASE_URL}/execute?${qs}`

  console.log('[executeSql] 发起请求:', { method: 'POST', url })

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    // 强制不传 body，全靠 URL 参数
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  const json: BaseResponse<boolean> = await response.json()
  console.log('[executeSql] 请求成功:', { code: json.code, message: json.message, data: json.data })

  if (json.code !== '000') {
    throw new Error(`[${json.code}] ${json.message}`)
  }

  return json.data
}