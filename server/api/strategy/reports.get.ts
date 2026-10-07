import { requireUser } from '../../utils/auth'
import { cachedListReports, cachedStrategyMeta } from '../../utils/strategy-cache'

// GET /api/strategy/reports —— 策略分页查询（登录即可，字段按角色裁剪；Redis 缓存高频查询）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)

  const page = Math.max(1, Number(q?.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q?.pageSize) || 20))

  // 分析时间：逗号分隔的日期列表（可多选）
  const tacticResolveTimes = q?.tacticResolveTime
    ? String(q.tacticResolveTime).split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  // 列表与维度下拉互不依赖，并行查询（各自命中缓存）
  const [result, meta] = await Promise.all([
    cachedListReports(
      {
        page,
        pageSize,
        sortBy: q?.sortBy ? String(q.sortBy) : undefined,
        sortOrder: q?.sortOrder === 'asc' ? 'asc' : 'desc',
        stockNumber: q?.stockNumber ? String(q.stockNumber).trim() : undefined,
        stockName: q?.stockName ? String(q.stockName).trim() : undefined,
        direct: q?.direct ? String(q.direct).trim() : undefined,
        period: q?.period ? String(q.period).trim() : undefined,
        tacticResolveTimes
      },
      user.role
    ),
    cachedStrategyMeta()
  ])

  return { ...result, ...meta }
})
