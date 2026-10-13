import { requireUser } from '../../utils/auth'
import { cachedStrategyPeriods } from '../../utils/strategy-cache'

// GET /api/strategy/periods —— 周期可选值（登录即可，缓存 2 小时）
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return { periods: await cachedStrategyPeriods() }
})
