import { createHash } from 'node:crypto'
import { getRedis } from './redis'
import { getConfig } from './config'
import { cacheGetOrSet } from './cache'
import type { Role } from './auth'
import {
  queryReportRows,
  fetchDatesGroupedRaw,
  fetchPeriodsRaw,
  fetchDirectsRaw,
  toStrategyItem,
  type StrategyQuery
} from './strategy-reports'

// ============================================================
// 策略查询缓存
//   - 列表结果：generation-based 失效（版本号），键 strategy:list:{version}:{md5}
//   - 维度元数据（dates/periods/directs）：固定 key + 写库时 DEL 主动清掉，TTL 2 小时
// ============================================================

const VERSION_KEY = 'strategy:version'

// 维度元数据缓存固定 key（写库时 DEL 清掉）
const DATES_KEY = 'strategy:dates'
const PERIODS_KEY = 'strategy:periods'
const DIRECTS_KEY = 'strategy:directs'

// 进程内版本号缓存（1 秒内复用，降低 Redis 往返；写库时立即失效）
let memVersion: { value: number; at: number } | null = null

async function getVersion(): Promise<number> {
  if (memVersion && Date.now() - memVersion.at < 1000) return memVersion.value
  const v = Number((await getRedis().get(VERSION_KEY)) ?? 0)
  memVersion = { value: v, at: Date.now() }
  return v
}

// 写库成功后调用：失效全部策略查询缓存
//   - INCR 版本号 → 列表缓存（strategy:list:{version}:*）自动失效
//   - DEL 固定 key → dates/periods/directs 元数据缓存直接清掉
export async function invalidateStrategyCache(): Promise<void> {
  const redis = getRedis()
  await redis.incr(VERSION_KEY)
  await redis.del(DATES_KEY, PERIODS_KEY, DIRECTS_KEY)
  memVersion = null
}

interface Ttl {
  meta: number
  list: number
  lock: number
}

function ttl(): Ttl {
  const c = getConfig().strategyCache
  return { meta: c.metaTtl, list: c.listTtl, lock: c.lockTtl }
}

// 列表查询指纹：规范化参数后 MD5，作为缓存键的一部分（稳定且紧凑）
function listFingerprint(q: StrategyQuery): string {
  const canonical = JSON.stringify({
    page: q.page,
    pageSize: q.pageSize,
    sortBy: q.sortBy ?? '',
    sortOrder: q.sortOrder ?? '',
    stockNumber: q.stockNumber ?? '',
    stockName: q.stockName ?? '',
    direct: q.direct ?? '',
    period: q.period ?? '',
    dates: q.tacticResolveTimes ? [...q.tacticResolveTimes].sort() : []
  })
  return createHash('md5').update(canonical, 'utf8').digest('hex')
}

export interface ReportListResult {
  records: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
}

// 列表查询（带缓存）：缓存「原始行 + 总数」，读取时按角色裁剪字段
// （同一份缓存同时服务普通用户与 VIP/超管，字段裁剪保证不出界）
export async function cachedListReports(q: StrategyQuery, role: Role): Promise<ReportListResult> {
  const { list, lock } = ttl()
  const key = `strategy:list:${await getVersion()}:${listFingerprint(q)}`

  const raw = await cacheGetOrSet(key, () => queryReportRows(q), { ttl: list, lockTtl: lock })

  return {
    records: raw.rows.map((r) => toStrategyItem(r, role)),
    total: raw.total,
    page: q.page,
    pageSize: q.pageSize
  }
}

// 分析日期（按 period 分组，缓存 2 小时）
export async function cachedStrategyDates(): Promise<Record<string, string[]>> {
  const { meta, lock } = ttl()
  return cacheGetOrSet(DATES_KEY, fetchDatesGroupedRaw, { ttl: meta, lockTtl: lock })
}

// 周期可选值（缓存 2 小时）
export async function cachedStrategyPeriods(): Promise<string[]> {
  const { meta, lock } = ttl()
  return cacheGetOrSet(PERIODS_KEY, fetchPeriodsRaw, { ttl: meta, lockTtl: lock })
}

// 方向可选值（缓存 2 小时）
export async function cachedStrategyDirects(): Promise<string[]> {
  const { meta, lock } = ttl()
  return cacheGetOrSet(DIRECTS_KEY, fetchDirectsRaw, { ttl: meta, lockTtl: lock })
}
