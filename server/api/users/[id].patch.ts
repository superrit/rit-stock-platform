import { requireAdmin } from '../../utils/auth'
import { updateUserRemark } from '../../utils/users'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '非法用户 ID' })
  }

  const body = await readBody<{ remark?: string }>(event).catch(() => ({}))
  const remark = body?.remark != null && String(body.remark).trim() !== ''
    ? String(body.remark).trim()
    : null
  if (remark && remark.length > 255) {
    throw createError({ statusCode: 400, message: '备注过长（最多 255 字）' })
  }

  const user = await updateUserRemark(id, remark)
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })
  return { user }
})
