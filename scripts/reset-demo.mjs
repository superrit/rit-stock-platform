#!/usr/bin/env node
/**
 * 重置演示账号到初始状态：默认密码 = 手机号后 6 位，must_change_password = true。
 * 用于修复「演示账号密码被改过后无法用默认密码登录」的情况。
 * 用法：
 *   node scripts/reset-demo.mjs [.env 文件路径]
 * 默认读取 .env.development。
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(file) {
  const text = readFileSync(file, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

// 默认 .env 路径基于脚本所在目录（项目根），而非当前工作目录
const envFile = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, '../.env.development')
const env = loadEnv(envFile)

const db = {
  host: env.NUXT_DB_HOST || '127.0.0.1',
  port: Number(env.NUXT_DB_PORT || 5432),
  user: env.NUXT_DB_USER || 'postgres',
  password: env.NUXT_DB_PASSWORD || '',
  database: env.NUXT_DB_DATABASE || 'rit_stock_platform'
}
const salt = env.NUXT_PASSWORD_SALT || ''

function hashPassword(password) {
  return createHash('md5').update(salt + password).digest('hex')
}
function defaultPassword(phone) {
  return phone.replace(/\D/g, '').slice(-6)
}

const demoUsers = [
  { phone: '13800000000', role: 'super_admin', vipDays: null },
  { phone: '13800000001', role: 'user', vipDays: null },
  { phone: '13800000002', role: 'vip', vipDays: 30 },   // 有效 VIP
  { phone: '13800000003', role: 'vip', vipDays: -1 }    // 已过期 VIP
]

async function main() {
  const pool = new Pool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database
  })

  for (const u of demoUsers) {
    const pw = defaultPassword(u.phone)
    const vipExpire = u.vipDays === null
      ? null
      : new Date(Date.now() + u.vipDays * 24 * 60 * 60 * 1000)
    const res = await pool.query(
      `UPDATE users
       SET password_hash = $1, salt = $2, role = $3,
           must_change_password = TRUE, vip_expire_at = $4,
           status = 'active', updated_at = NOW()
       WHERE phone = $5`,
      [hashPassword(pw), salt, u.role, vipExpire, u.phone]
    )
    console.log(`[reset] ${u.phone} (${u.role}) → 默认密码 ${pw}，重置 ${res.rowCount} 行`)
  }

  await pool.end()
  console.log('[reset] 演示账号已全部重置 ✅')
}

main().catch((err) => {
  console.error('[reset] 失败:', err)
  process.exit(1)
})
