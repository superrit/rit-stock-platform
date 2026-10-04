import type { H3Event } from 'h3'
import { verifyToken } from './jwt'
import { getRedis } from './redis'
import { queryOne } from './db'

export type Role = 'super_admin' | 'user' | 'vip'

export interface UserRecord {
  id: number
  phone: string
  password_hash: string
  salt: string
  role: string
  must_change_password: boolean
  vip_expire_at: string | null
  remark: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: number
  phone: string
  role: Role
  isVip: boolean
  vipExpireAt: string | null
  vipRemainingDays: number | null
}

// VIP 有效期判定：过期自动失去 VIP 身份（动态计算，无需定时任务）
export function effectiveRole(user: UserRecord): Role {
  if (user.role === 'vip') {
    if (user.vip_expire_at && new Date(user.vip_expire_at).getTime() > Date.now()) {
      return 'vip'
    }
    return 'user'
  }
  return user.role as Role
}

// VIP 剩余天数：非 VIP 返回 null，VIP 返回向上取整的天数（最小 0）
export function vipRemainingDays(user: UserRecord): number | null {
  if (effectiveRole(user) !== 'vip' || !user.vip_expire_at) return null
  const ms = new Date(user.vip_expire_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export function toAuthUser(user: UserRecord): AuthUser {
  const role = effectiveRole(user)
  return {
    id: Number(user.id),
    phone: user.phone,
    role,
    isVip: role === 'vip',
    vipExpireAt: user.vip_expire_at,
    vipRemainingDays: vipRemainingDays(user)
  }
}

export function sessionKey(userId: number): string {
  return `auth:session:${userId}`
}

export function cpKey(userId: number): string {
  return `auth:cp:${userId}`
}

export interface SessionPayload {
  sub: string
  sid: string
  role: string
  scope?: string
}

// 从 Authorization Bearer 或 httpOnly cookie 中提取令牌
export function extractToken(event: H3Event): string | null {
  const auth = getHeader(event, 'authorization')
  if (auth) {
    const [scheme, token] = auth.split(' ')
    if (scheme?.toLowerCase() === 'bearer' && token) return token
  }
  const cookie = getCookie(event, 'rit_token')
  if (cookie) return cookie
  return null
}

// 校验登录态：验证 JWT + Redis 单设备会话 + 实时拉取用户与 VIP 状态
export async function getCurrentUser(event: H3Event): Promise<AuthUser | null> {
  const token = extractToken(event)
  if (!token) return null

  let payload: SessionPayload
  try {
    payload = await verifyToken<SessionPayload>(token)
  } catch {
    return null
  }

  const userId = Number(payload.sub)
  if (!Number.isInteger(userId) || userId <= 0) return null

  // 单设备：Redis 中当前会话 sid 必须与令牌一致
  const storedSid = await getRedis().get(sessionKey(userId))
  if (!storedSid || storedSid !== payload.sid) return null

  const user = await queryOne<UserRecord>(
    'SELECT * FROM users WHERE id = $1 AND status = $2',
    [userId, 'active']
  )
  if (!user) return null

  return toAuthUser(user)
}

export async function requireUser(event: H3Event): Promise<AuthUser> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: '未登录或登录已失效' })
  }
  return user
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireUser(event)
  if (user.role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: '无权限，仅超级管理员可操作' })
  }
  return user
}
