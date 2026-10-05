import { getPool } from './db'

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
