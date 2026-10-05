#!/usr/bin/env node
/**
 * 初始化数据库：创建数据库、执行 schema.sql、写入种子用户。
 * 用法：
 *   node scripts/init-db.mjs [.env 文件路径]
 * 默认读取 .env.development。
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const { Pool, Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))

// 极简 .env 解析
function loadEnv(file) {
  const text = readFileSync(file, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let v = m[2]
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

// 默认超级管理员账号（首次登录强制改密，默认密码 = 手机号后 6 位）
const defaultAdmin = {
  phone: '13800000000',
  role: 'super_admin'
}

async function main() {
  // 1) 确保数据库存在
  const admin = new Client({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: 'postgres'
  })
  await admin.connect()
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [db.database])
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${db.database}"`)
    console.log(`[init] 数据库 ${db.database} 已创建`)
  } else {
    console.log(`[init] 数据库 ${db.database} 已存在`)
  }
  await admin.end()

  // 2) 执行 schema
  const pool = new Pool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database
  })
  const schemaSql = readFileSync(resolve(__dirname, '../server/db/schema.sql'), 'utf8')
  await pool.query(schemaSql)
  console.log('[init] schema 已应用')

  // 3) 写入默认超级管理员
  const pw = defaultPassword(defaultAdmin.phone)
  await pool.query(
    `INSERT INTO users (phone, password_hash, salt, role, must_change_password)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (phone) DO NOTHING`,
    [defaultAdmin.phone, hashPassword(pw), salt, defaultAdmin.role]
  )
  console.log(`[init] 默认超级管理员 ${defaultAdmin.phone}（默认密码 ${pw}）就绪`)

  await pool.end()
  console.log('[init] 数据库初始化完成 ✅')
}

main().catch((err) => {
  console.error('[init] 初始化失败:', err)
  process.exit(1)
})
