import { requireAdmin } from '../../utils/auth'
import { findUserById, deleteUser } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '非法用户 ID' })
  }
  if (id === admin.id) {
    throw createError({ statusCode: 400, message: '不能删除自己的账户' })
  }

  const target = await findUserById(id)
  if (!target) throw createError({ statusCode: 404, message: '用户不存在' })

  await deleteUser(id)
  return { success: true }
})
