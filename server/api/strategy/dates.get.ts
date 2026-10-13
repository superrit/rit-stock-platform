import { requireUser } from '../../utils/auth'
import { cachedStrategyDates } from '../../utils/strategy-cache'

// GET /api/strategy/dates —— 按周期分组的分析日期（登录即可，缓存 2 小时）
// 返回形如 { day: ['2024-01-03', ...], week: [...] }（key 为 period，动态）
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await cachedStrategyDates()
})
