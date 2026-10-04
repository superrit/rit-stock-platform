import { queryOne, query } from '../../utils/db'
import { hashPassword, verifyPassword } from '../../utils/password'
import { getConfig } from '../../utils/config'
import { toAuthUser } from '../../utils/auth'
import type { UserRecord } from '../../utils/auth'
import {
  verifyChangePasswordToken,
  revokeChangePassword,
  issueSession,
  setAuthCookie
} from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    changePasswordToken?: string
    oldPassword?: string
    newPassword?: string
  }>(event).catch(() => ({}))
  const token = String(body?.changePasswordToken ?? '')
  const oldPassword = String(body?.oldPassword ?? '')
  const newPassword = String(body?.newPassword ?? '')

  if (!token) throw createError({ statusCode: 400, message: '缺少改密令牌' })
  if (!oldPassword) throw createError({ statusCode: 400, message: '请输入原密码' })
  if (!newPassword || newPassword.length < 6 || newPassword.length > 20) {
    throw createError({ statusCode: 400, message: '新密码长度需为 6-20 位' })
  }
  if (newPassword === oldPassword) {
    throw createError({ statusCode: 400, message: '新密码不能与原密码相同' })
  }

  const { userId } = await verifyChangePasswordToken(token)

  const user = await queryOne<UserRecord>('SELECT * FROM users WHERE id = $1', [userId])
  if (!user || user.status !== 'active') {
    throw createError({ statusCode: 404, message: '用户不存在或已停用' })
  }
  if (!verifyPassword(oldPassword, user.salt, user.password_hash)) {
    throw createError({ statusCode: 401, message: '原密码不正确' })
  }

  // 用全局盐重新散列并落库，解除强制改密标记
  const { passwordSalt } = getConfig()
  const newHash = hashPassword(newPassword, passwordSalt)
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
    [newHash, userId]
  )

  // 使改密令牌失效
  await revokeChangePassword(userId)

  // 改密成功后直接建立正式会话
  const refreshed = await queryOne<UserRecord>('SELECT * FROM users WHERE id = $1', [userId])
  if (!refreshed) throw createError({ statusCode: 500, message: '改密后会话建立失败' })
  const accessToken = await issueSession(refreshed)
  setAuthCookie(event, accessToken)
  return { token: accessToken, user: toAuthUser(refreshed) }
})
