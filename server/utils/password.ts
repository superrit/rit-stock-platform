import { createHash } from 'node:crypto'
import { getConfig } from './config'

/**
 * 密码散列：MD5(盐 + 明文密码)。
 * 盐值来自重要配置文件（NUXT_PASSWORD_SALT），仅服务端可见。
 *
 * 安全提示：MD5 加盐强度有限，生产环境建议升级为 bcrypt / argon2（且每个用户独立随机盐）。
 */
export function hashPassword(password: string, salt: string): string {
  return createHash('md5').update(salt + password, 'utf8').digest('hex')
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = hashPassword(password, salt)
  // 常量时间比较，降低时序侧信道风险
  const a = Buffer.from(actual)
  const b = Buffer.from(expectedHash)
  if (a.length !== b.length) return false
  return createHash('sha256').update(a).digest().equals(createHash('sha256').update(b).digest())
}

// 默认密码 = 手机号后 6 位
export function defaultPassword(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) throw new Error('手机号长度不足，无法生成默认密码')
  return digits.slice(-6)
}
