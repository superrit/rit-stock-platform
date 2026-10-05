import { requireAdmin } from '../utils/auth'
import { listLoginRecords } from '../utils/login-records'

// GET /api/login-records?page=1&pageSize=20 —— 登录记录分页查询（仅管理员）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const q = getQuery(event)
  const page = Math.max(1, Number(q?.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q?.pageSize) || 20))
  return await listLoginRecords(page, pageSize)
})
