import { createHash } from 'node:crypto'
import { getConfig } from '../../utils/config'
import { bulkUpsertReports } from '../../utils/strategy-reports'
import { bumpStrategyVersion } from '../../utils/strategy-cache'
import { logger } from '../../utils/logger'

// POST /api/strategy/report —— 外部策略上报接口（MD5 签名 + 时间戳防重放）
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    ts?: string | number
    data?: Record<string, unknown>[]
    sign?: string
  }>(event).catch(() => ({}))

  const ts = body?.ts
  const data = body?.data
  const sign = String(body?.sign ?? '')

  if (ts == null) throw createError({ statusCode: 400, message: '缺少时间戳 ts' })
  if (!Array.isArray(data) || data.length === 0) {
    throw createError({ statusCode: 400, message: 'data 必须为非空数组' })
  }
  if (!sign) throw createError({ statusCode: 400, message: '缺少签名 sign' })

  const cfg = getConfig()

  // 防重放：ts 窗口校验（兼容 13 位毫秒 / 10 位秒）
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) throw createError({ statusCode: 400, message: 'ts 非法' })
  const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum
  if (Math.abs(Date.now() - tsMs) > cfg.replayWindowMs) {
    throw createError({ statusCode: 400, message: '时间戳已过期，请求可能被重放' })
  }

  // 签名校验：MD5(ts + JSON.stringify(data) + signSalt)
  const payloadStr = JSON.stringify(data)
  const computed = createHash('md5')
    .update(String(ts) + payloadStr + cfg.signSalt, 'utf8')
    .digest('hex')
  if (computed !== sign.toLowerCase()) {
    throw createError({ statusCode: 401, message: '签名校验失败' })
  }

  // 校验每条 hash 存在
  for (const item of data) {
    if (!item || !String(item.hash || '').trim()) {
      throw createError({ statusCode: 400, message: 'data 中存在缺少 hash 的条目' })
    }
  }

  const saved = await bulkUpsertReports(data, tsNum)

  // 写库成功 → 失效策略查询缓存（版本号 +1，O(1)）。缓存失效失败不阻断上报。
  await bumpStrategyVersion().catch((err) => {
    logger.warn('策略缓存版本号更新失败', { error: String(err) })
  })

  return { success: true, saved }
})
