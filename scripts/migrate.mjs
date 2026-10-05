#!/usr/bin/env node
/**
 * 应用数据库迁移：按文件名顺序执行 server/db/migrations/*.sql。
 * 每个迁移文件应为幂等（使用 IF NOT EXISTS / IF EXISTS 等）。
 * 用法：
 *   node scripts/migrate.mjs [.env 文件路径]
 */
import { readFileSync, readdirSync } from 'node:fs'
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

const pool = new Pool({
  host: env.NUXT_DB_HOST || '127.0.0.1',
  port: Number(env.NUXT_DB_PORT || 5432),
  user: env.NUXT_DB_USER || 'postgres',
  password: env.NUXT_DB_PASSWORD || '',
  database: env.NUXT_DB_DATABASE || 'rit_stock_platform'
})

const migrationsDir = new URL('../server/db/migrations/', import.meta.url)

async function main() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) {
    console.log('[migrate] 无待执行迁移')
  }
  for (const file of files) {
    const sql = readFileSync(new URL(file, migrationsDir), 'utf8')
    await pool.query(sql)
    console.log(`[migrate] ✓ ${file}`)
  }
  await pool.end()
  console.log('[migrate] 迁移完成 ✅')
}

main().catch((err) => {
  console.error('[migrate] 失败:', err)
  process.exit(1)
})
