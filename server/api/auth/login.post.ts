import { queryOne } from '../../utils/db'
import { verifyPassword } from '../../utils/password'
import { toAuthUser } from '../../utils/auth'
import type { UserRecord } from '../../utils/auth'
import { issueSession, issueChangePasswordToken, setAuthCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ phone?: string; password?: string }>(event).catch(() => ({}))
  const phone = String(body?.phone ?? '').trim()
  const password = String(body?.password ?? '')

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw createError({ statusCode: 400, message: '手机号格式不正确' })
  }
  if (!password) {
    throw createError({ statusCode: 400, message: '请输入密码' })
  }

  const user = await queryOne<UserRecord>(
    'SELECT * FROM users WHERE phone = $1 AND status = $2',
    [phone, 'active']
  )
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    throw createError({ statusCode: 401, message: '手机号或密码错误' })
  }

  // 首次登录：强制修改密码，只签发短时效改密令牌，不建立正式会话
  if (user.must_change_password) {
    const changePasswordToken = await issueChangePasswordToken(user)
    return {
      needChangePassword: true,
      changePasswordToken,
      message: '首次登录需修改密码'
    }
  }

  // 正常登录：创建单设备会话
  const token = await issueSession(user)
  setAuthCookie(event, token)
  return { token, user: toAuthUser(user) }
})
