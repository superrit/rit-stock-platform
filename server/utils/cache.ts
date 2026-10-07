import { randomUUID } from 'node:crypto'
import { getRedis } from './redis'

// ============================================================
// 通用缓存工具（cache-aside 读旁路模式）
//   - 命中即返回，未命中则「单飞锁」重建，避免并发重复查库
//   - 空结果也缓存（防穿透）：不存在的查询条件不再反复打到数据库
//   - 热点 key 过期瞬间仅允许一个请求重建（防击穿）
//   - 锁释放用 Lua compare-and-delete，避免锁超时后误删他人持有的锁
// ============================================================

// 释放锁：仅当 value 仍匹配时才删除
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

// 空结果标记：以 NUL 控制符开头，绝不与 JSON.stringify 产物冲突
const EMPTY_MARKER = '\u0000__EMPTY__'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface CacheGetOrSetOptions {
  ttl: number // 正常值缓存秒数
  lockTtl?: number // 单飞锁超时秒数，默认 10s
}

/**
 * 读旁路缓存：loader 返回 null/undefined 视为「空结果」，以短 TTL 缓存防穿透。
 * 注意：缓存值统一 JSON 序列化；时间等类型在读取后为字符串，调用方需保证可接受。
 */
export async function cacheGetOrSet<T>(
  key: string,
  loader: () => Promise<T>,
  opts: CacheGetOrSetOptions
): Promise<T> {
  const { ttl, lockTtl = 10 } = opts
  const redis = getRedis()

  const parse = <V>(raw: string): V => {
    if (raw === EMPTY_MARKER) return undefined as unknown as V
    return JSON.parse(raw) as V
  }

  // 1) 命中缓存
  const hit = await redis.get(key)
  if (hit !== null) return parse<T>(hit)

  // 2) 未命中 → 尝试抢单飞锁
  const lockKey = `${key}:lock`
  const lockVal = randomUUID()
  const got = await redis.set(lockKey, lockVal, 'EX', lockTtl, 'NX')

  if (got === 'OK') {
    try {
      // 双检：抢到锁后再次读缓存（可能已被其他进程填充）
      const again = await redis.get(key)
      if (again !== null) return parse<T>(again)

      const value = await loader()
      if (value == null) {
        await redis.set(key, EMPTY_MARKER, 'EX', ttl)
        return value as T
      }
      await redis.set(key, JSON.stringify(value), 'EX', ttl)
      return value
    } finally {
      await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, lockVal)
    }
  }

  // 3) 未抢到锁：其他请求正在重建，短暂等待后重读一次
  await sleep(50)
  const retry = await redis.get(key)
  if (retry !== null) return parse<T>(retry)

  // 兜底：仍失败则直接查库（不缓存），保证可用性
  return loader()
}
