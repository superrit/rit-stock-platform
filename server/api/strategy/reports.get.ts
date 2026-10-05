import { requireUser } from '../../utils/auth'
import { listReports, listDirects, listPeriods } from '../../utils/strategy-reports'

// GET /api/strategy/reports —— 策略分页查询（登录即可，字段按角色裁剪）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)

  const page = Math.max(1, Number(q?.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q?.pageSize) || 20))

  const result = await listReports(
    {
      page,
      pageSize,
      sortBy: q?.sortBy ? String(q.sortBy) : undefined,
      sortOrder: q?.sortOrder === 'asc' ? 'asc' : 'desc',
      stockNumber: q?.stockNumber ? String(q.stockNumber).trim() : undefined,
      stockName: q?.stockName ? String(q.stockName).trim() : undefined,
      direct: q?.direct ? String(q.direct).trim() : undefined,
      period: q?.period ? String(q.period).trim() : undefined,
      tacticResolveTimeFrom: q?.tacticResolveTimeFrom ? String(q.tacticResolveTimeFrom) : undefined,
      tacticResolveTimeTo: q?.tacticResolveTimeTo ? String(q.tacticResolveTimeTo) : undefined
    },
    user.role
  )

  const directs = await listDirects()
  const periods = await listPeriods()
  return { ...result, directs, periods }
})
