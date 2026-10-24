import { queryOne, getPool } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'
import { verifyPassword } from '../../utils/password'
import { invalidateStrategyCache } from '../../utils/strategy-cache'
import { logger } from '../../utils/logger'

// DELETE /api/strategy/reports —— 清空全部策略（仅超级管理员，需输入本人密码二次确认）
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)

  const body = await readBody<{ password?: string }>(event).catch(() => ({}))
  const password = String(body?.password ?? '')
  if (!password) {
    throw createError({ statusCode: 400, message: '请输入密码' })
  }

  // 校验当前管理员本人密码（二次确认，密码校验在服务端进行，防止越权/误操作）
  const admin = await queryOne<{ password_hash: string; salt: string }>(
    'SELECT password_hash, salt FROM users WHERE id = $1',
    [user.id]
  )
  if (!admin || !verifyPassword(password, admin.salt, admin.password_hash)) {
    throw createError({ statusCode: 401, message: '密码错误，无法清空' })
  }

  // 清空全部策略数据（TRUNCATE 秒级清空，避免长时间锁表影响上报）
  await getPool().query('TRUNCATE TABLE strategy_reports')

  // 失效策略查询缓存（列表版本号 +1，dates/periods/directs DEL）
  await invalidateStrategyCache().catch((err) => {
    logger.warn('策略缓存失效失败', { error: String(err) })
  })

  return { success: true, message: '已清空全部策略' }
})
