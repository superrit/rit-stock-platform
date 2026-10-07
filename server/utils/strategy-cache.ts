import { createHash } from 'node:crypto'
import { getRedis } from './redis'
import { getConfig } from './config'
import { cacheGetOrSet } from './cache'
import type { Role } from './auth'
import {
  queryReportRows,
  fetchMetaRaw,
  toStrategyItem,
  type StrategyQuery,
  type StrategyMeta
} from './strategy-reports'

// ============================================================
// 策略查询缓存：generation-based 失效（版本号）+ cache-aside
//
// 失效策略：写库成功后调用 bumpStrategyVersion()，版本号 +1，
//   使所有以旧版本号为前缀的缓存键「自动失效」（O(1)，无需扫描删除），
//   旧键由各自 TTL 自然过期回收，避免脏读与内存泄漏。
// ============================================================

const VERSION_KEY = 'strategy:version'

// 进程内版本号缓存（1 秒内复用，降低 Redis 往返；写库时立即失效）
let memVersion: { value: number; at: number } | null = null

async function getVersion(): Promise<number> {
  if (memVersion && Date.now() - memVersion.at < 1000) return memVersion.value
  const v = Number((await getRedis().get(VERSION_KEY)) ?? 0)
  memVersion = { value: v, at: Date.now() }
  return v
}

// 写库成功后调用：版本 +1，全部旧缓存键失效
export async function bumpStrategyVersion(): Promise<void> {
  await getRedis().incr(VERSION_KEY)
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

// 维度下拉（带缓存）：directs/periods/dates 变化频率低，TTL 更长
export async function cachedStrategyMeta(): Promise<StrategyMeta> {
  const { meta, lock } = ttl()
  const key = `strategy:meta:${await getVersion()}`
  return cacheGetOrSet(key, fetchMetaRaw, { ttl: meta, lockTtl: lock })
}
