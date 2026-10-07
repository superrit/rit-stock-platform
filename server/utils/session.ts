import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { getConfig, parseDuration } from './config'
import { signToken, verifyToken } from './jwt'
import { getRedis } from './redis'
import { effectiveRole, sessionKey, cpKey } from './auth'
import type { UserRecord } from './auth'

export const AUTH_COOKIE_NAME = 'rit_token'

// 登录成功后把 access token 写入 httpOnly cookie（禁止存 localStorage / URL 参数）
export function setAuthCookie(event: H3Event, token: string): void {
  const ttl = parseDuration(getConfig().jwt.expiresIn)
  setCookie(event, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ttl,
    // Secure 仅在 HTTPS 下生效；纯 HTTP 部署必须为 false，否则浏览器会拒绝存储 cookie
    secure: getConfig().cookieSecure
  })
}

export function clearAuthCookie(event: H3Event): void {
  deleteCookie(event, AUTH_COOKIE_NAME, { path: '/' })
}

// 改密令牌有效期 10 分钟
const CP_TTL_SECONDS = 10 * 60

// 正常登录：创建单设备会话（覆盖旧 sid，实现单设备登录），返回 access token
export async function issueSession(user: UserRecord): Promise<string> {
  const sid = randomUUID()
  const ttl = parseDuration(getConfig().jwt.expiresIn) // 1 天 = 86400s
  await getRedis().set(sessionKey(user.id), sid, 'EX', ttl)
  return await signToken({ sub: String(user.id), sid, role: effectiveRole(user) }, ttl)
}

// 首次登录：签发仅可用于改密的短时效令牌
export async function issueChangePasswordToken(user: UserRecord): Promise<string> {
  const sid = randomUUID()
  await getRedis().set(cpKey(user.id), sid, 'EX', CP_TTL_SECONDS)
  return await signToken(
    { sub: String(user.id), sid, scope: 'change_password' },
    CP_TTL_SECONDS
  )
}

interface ChangePasswordPayload {
  sub: string
  sid: string
  scope?: string
}

// 校验改密令牌：类型 + Redis 会话一致性
export async function verifyChangePasswordToken(token: string): Promise<{ userId: number; sid: string }> {
  const payload = await verifyToken<ChangePasswordPayload>(token)
  if (payload.scope !== 'change_password') {
    throw createError({ statusCode: 403, message: '令牌类型不正确，请重新登录' })
  }
  const userId = Number(payload.sub)
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 401, message: '改密令牌无效' })
  }
  const stored = await getRedis().get(cpKey(userId))
  if (!stored || stored !== payload.sid) {
    throw createError({ statusCode: 401, message: '改密令牌已失效，请重新登录' })
  }
  return { userId, sid: payload.sid }
}

export async function revokeSession(userId: number): Promise<void> {
  await getRedis().del(sessionKey(userId))
}

export async function revokeChangePassword(userId: number): Promise<void> {
  await getRedis().del(cpKey(userId))
}
