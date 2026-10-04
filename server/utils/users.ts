import { query, queryOne } from './db'
import { hashPassword, defaultPassword } from './password'
import { getConfig } from './config'
import { effectiveRole, vipRemainingDays } from './auth'
import type { UserRecord } from './auth'

// 管理端用户列表项
export interface AdminUserItem {
  id: number
  phone: string
  role: string
  effectiveRole: string
  isVip: boolean
  vipExpireAt: string | null
  vipRemainingDays: number | null
  remark: string | null
  mustChangePassword: boolean
  status: string
  createdAt: string
}

export function toAdminUserItem(user: UserRecord): AdminUserItem {
  const role = effectiveRole(user)
  return {
    id: Number(user.id),
    phone: user.phone,
    role: user.role,
    effectiveRole: role,
    isVip: role === 'vip',
    vipExpireAt: user.vip_expire_at,
    vipRemainingDays: vipRemainingDays(user),
    remark: user.remark,
    mustChangePassword: user.must_change_password,
    status: user.status,
    createdAt: user.created_at
  }
}

export async function listUsers(): Promise<AdminUserItem[]> {
  const rows = await query<UserRecord>('SELECT * FROM users ORDER BY id ASC')
  return rows.map(toAdminUserItem)
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  return await queryOne<UserRecord>('SELECT * FROM users WHERE id = $1', [id])
}

export async function findUserByPhone(phone: string): Promise<UserRecord | null> {
  return await queryOne<UserRecord>('SELECT * FROM users WHERE phone = $1', [phone])
}

// 创建新用户：默认密码 = 手机号后 6 位，首次登录强制改密
export async function createUser(phone: string, remark: string | null): Promise<AdminUserItem> {
  const { passwordSalt } = getConfig()
  const password = defaultPassword(phone)
  const hash = hashPassword(password, passwordSalt)
  const rows = await query<UserRecord>(
    `INSERT INTO users (phone, password_hash, salt, role, must_change_password, remark)
     VALUES ($1, $2, $3, 'user', TRUE, $4)
     RETURNING *`,
    [phone, hash, passwordSalt, remark]
  )
  return toAdminUserItem(rows[0])
}

export async function updateUserRemark(id: number, remark: string | null): Promise<AdminUserItem | null> {
  const rows = await query<UserRecord>(
    'UPDATE users SET remark = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [remark, id]
  )
  return rows.length ? toAdminUserItem(rows[0]) : null
}

// 续期/开通 VIP：若当前仍在有效期内则从当前到期时间续期，否则从现在开始
export async function extendVip(id: number, months: number): Promise<AdminUserItem | null> {
  const user = await findUserById(id)
  if (!user) return null

  const now = Date.now()
  const currentExpire = user.vip_expire_at ? new Date(user.vip_expire_at).getTime() : 0
  const base = currentExpire > now ? new Date(currentExpire) : new Date(now)
  base.setMonth(base.getMonth() + months)

  const rows = await query<UserRecord>(
    `UPDATE users SET role = 'vip', vip_expire_at = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [base.toISOString(), id]
  )
  return rows.length ? toAdminUserItem(rows[0]) : null
}

export async function deleteUser(id: number): Promise<boolean> {
  const rows = await query<{ id: number }>('DELETE FROM users WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}
