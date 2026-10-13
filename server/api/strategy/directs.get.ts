import { requireUser } from '../../utils/auth'
import { cachedStrategyDirects } from '../../utils/strategy-cache'

// GET /api/strategy/directs —— 方向可选值（登录即可，缓存 2 小时）
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return { directs: await cachedStrategyDirects() }
})
