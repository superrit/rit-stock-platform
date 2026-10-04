import { requireAdmin } from '../../../utils/auth'
import { extendVip } from '../../../utils/users'

const ALLOWED_MONTHS = [1, 3, 6, 12]

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '非法用户 ID' })
  }

  const body = await readBody<{ months?: number }>(event).catch(() => ({}))
  const months = Number(body?.months)
  if (!ALLOWED_MONTHS.includes(months)) {
    throw createError({ statusCode: 400, message: '不支持的有效期选项' })
  }

  const user = await extendVip(id, months)
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })
  return { user }
})
