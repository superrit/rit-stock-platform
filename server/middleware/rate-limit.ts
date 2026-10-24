import { getRequestIP } from 'h3'
import { getRedis } from '../utils/redis'
import { getConfig } from '../utils/config'

// 原子计数 + 过期：INCR 且首次设置 60s 过期。
// 用 Lua 保证原子性，避免 INCR 与 EXPIRE 分离导致 key 无过期时间而永久限流。
const RATE_LIMIT_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`

// 接口防刷：每个 IP 每分钟最多 N 次请求（仅对 /api/* 接口生效）
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return

  const limit = getConfig().rateLimitPerMinute
  if (limit <= 0) return // 0 或负数表示禁用限流

  let ip = 'unknown'
  try {
    ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  } catch {
    ip = 'unknown'
  }

  const key = `ratelimit:${ip}`
  let count = 0
  try {
    count = Number(await getRedis().eval(RATE_LIMIT_LUA, 1, key, String(60)))
  } catch {
    return // Redis 异常时 fail-open，不阻断正常请求
  }

  if (count > limit) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: '请求过于频繁，请稍后再试'
    })
  }
})
