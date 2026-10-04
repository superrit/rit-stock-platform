import { requireAdmin } from '../utils/auth'
import { findUserByPhone, createUser } from '../utils/users'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ phone?: string; remark?: string }>(event).catch(() => ({}))
  const phone = String(body?.phone ?? '').trim()
  const remark = body?.remark != null && String(body.remark).trim() !== ''
    ? String(body.remark).trim()
    : null

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw createError({ statusCode: 400, message: '手机号格式不正确' })
  }
  if (remark && remark.length > 255) {
    throw createError({ statusCode: 400, message: '备注过长（最多 255 字）' })
  }

  const existing = await findUserByPhone(phone)
  if (existing) {
    throw createError({ statusCode: 400, message: '该手机号已存在' })
  }

  const user = await createUser(phone, remark)
  return { user }
})
