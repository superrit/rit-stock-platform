import { getPool, query } from './db'
import type { Role } from './auth'

// 列顺序与 strategy_reports 表对应
const COLS = [
  'hash', 'ud_str', 'stock_number', 'stock_name', 'next_index', 'direct',
  'price', 'tp', 'sl', 'pl', 'result', 'ratio', 'total', 'period',
  'tactic_resolve_time', 'bsp', 'jxp', 'calc_cha', 'must_eles', 'score_detail',
  'analyze_score', 'report_ts'
]

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function numInt(v: unknown): number | null {
  const n = num(v)
  return n == null ? null : Math.round(n)
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v)
  return s === '' ? null : s
}

function toRow(item: Record<string, unknown>, reportTs: number): unknown[] {
  return [
    str(item.hash),
    str(item.udStr),
    str(item.stockNumber),
    str(item.stockName),
    numInt(item.nextIndex),
    str(item.direct),
    num(item.price),
    num(item.tp),
    num(item.sl),
    num(item.pl),
    str(item.result),
    num(item.ratio),
    numInt(item.total),
    str(item.period),
    str(item.tacticResolveTime),
    num(item.BSP),
    num(item.JXP),
    str(item.CalcCha),
    str(item.mustEles),
    str(item.scoreDetail),
    num(item.analyzeScore),
    reportTs
  ]
}

// 批量 upsert：hash 冲突则覆盖，否则新增；按 500 条分片，事务内执行
export async function bulkUpsertReports(items: Record<string, unknown>[], reportTs: number): Promise<number> {
  if (!items.length) return 0

  const client = await getPool().connect()
  const setClause = COLS.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ')
  const batchSize = 500
  let total = 0

  try {
    await client.query('BEGIN')
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const values: unknown[] = []
      const rowPlaceholders: string[] = []
      for (const item of batch) {
        const row = toRow(item, reportTs)
        const start = values.length + 1
        rowPlaceholders.push(`(${row.map((_, k) => `$${start + k}`).join(', ')})`)
        values.push(...row)
      }
      const sql = `INSERT INTO strategy_reports (${COLS.join(', ')})
        VALUES ${rowPlaceholders.join(', ')}
        ON CONFLICT (hash) DO UPDATE SET ${setClause}, updated_at = NOW()`
      await client.query(sql, values)
      total += batch.length
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return total
}

// ============ 策略查询（分页/排序/筛选 + 按角色裁剪字段） ============

// 允许排序的字段（camelCase → 数据库列），防止 SQL 注入
const SORTABLE: Record<string, string> = {
  hash: 'hash',
  stockNumber: 'stock_number',
  stockName: 'stock_name',
  nextIndex: 'next_index',
  direct: 'direct',
  price: 'price',
  tp: 'tp',
  sl: 'sl',
  pl: 'pl',
  ratio: 'ratio',
  total: 'total',
  period: 'period',
  tacticResolveTime: 'tactic_resolve_time',
  BSP: 'bsp',
  JXP: 'jxp',
  analyzeScore: 'analyze_score',
  createdAt: 'created_at'
}

export interface StrategyQuery {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  stockNumber?: string
  stockName?: string
  direct?: string
  tacticResolveTimeFrom?: string
  tacticResolveTimeTo?: string
}

// 普通用户可见字段；VIP/超管额外可见 udStr/mustEles/scoreDetail/analyzeScore
function toStrategyItem(row: Record<string, unknown>, role: Role): Record<string, unknown> {
  const item: Record<string, unknown> = {
    hash: row.hash,
    stockNumber: row.stock_number,
    stockName: row.stock_name,
    nextIndex: row.next_index,
    direct: row.direct,
    price: row.price,
    tp: row.tp,
    sl: row.sl,
    pl: row.pl,
    result: row.result,
    ratio: row.ratio,
    total: row.total,
    period: row.period,
    tacticResolveTime: row.tactic_resolve_time,
    BSP: row.bsp,
    JXP: row.jxp,
    CalcCha: row.calc_cha
  }
  if (role !== 'user') {
    item.udStr = row.ud_str
    item.mustEles = row.must_eles
    item.scoreDetail = row.score_detail
    item.analyzeScore = row.analyze_score
  }
  return item
}

export async function listReports(q: StrategyQuery, role: Role) {
  const conditions: string[] = []
  const whereParams: unknown[] = []

  if (q.stockNumber) {
    whereParams.push('%' + q.stockNumber + '%')
    conditions.push('stock_number ILIKE $' + whereParams.length)
  }
  if (q.stockName) {
    whereParams.push('%' + q.stockName + '%')
    conditions.push('stock_name ILIKE $' + whereParams.length)
  }
  if (q.direct) {
    whereParams.push(q.direct)
    conditions.push('direct = $' + whereParams.length)
  }
  if (q.tacticResolveTimeFrom) {
    whereParams.push(q.tacticResolveTimeFrom)
    conditions.push('tactic_resolve_time >= ($' + whereParams.length + ')::date')
  }
  if (q.tacticResolveTimeTo) {
    whereParams.push(q.tacticResolveTimeTo)
    conditions.push("tactic_resolve_time < ($" + whereParams.length + ")::date + INTERVAL '1 day'")
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const sortCol = SORTABLE[q.sortBy || 'tacticResolveTime'] || 'tactic_resolve_time'
  const sortDir = q.sortOrder === 'asc' ? 'ASC' : 'DESC'

  const listParams = [...whereParams, q.pageSize, (q.page - 1) * q.pageSize]
  const limitIdx = whereParams.length + 1
  const offsetIdx = whereParams.length + 2

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM strategy_reports ' + where +
    ' ORDER BY ' + sortCol + ' ' + sortDir + ' NULLS LAST' +
    ' LIMIT $' + limitIdx + ' OFFSET $' + offsetIdx,
    listParams
  )
  const countRes = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM strategy_reports ' + where,
    whereParams
  )
  const total = Number(countRes[0]?.count ?? 0)

  return {
    records: rows.map((r) => toStrategyItem(r, role)),
    total,
    page: q.page,
    pageSize: q.pageSize
  }
}

// direct 字段可选值（用于筛选下拉）
export async function listDirects(): Promise<string[]> {
  const rows = await query<{ direct: string }>(
    'SELECT DISTINCT direct FROM strategy_reports WHERE direct IS NOT NULL ORDER BY direct ASC'
  )
  return rows.map((r) => r.direct)
}
