import { requireAdmin } from '../utils/auth'
import { listVipRecords } from '../utils/vip-records'

// GET /api/vip-records?page=1&pageSize=20 —— VIP 续期操作记录分页查询（仅管理员）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q?.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q?.pageSize) || 20))
  return await listVipRecords(page, pageSize)
})
