import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 显式加载环境变量（保证 dev/prod 区分）：
//   nuxt dev   → 加载 .env + .env.development
//   nuxt build → 加载 .env + .env.production
// 已存在的环境变量优先，不会被覆盖。
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let value = m[2].trim()
    // 去除首尾引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = value
    }
  }
}

const cwd = process.cwd()
const envName = process.env.NODE_ENV === 'production' ? 'production' : 'development'
loadEnvFile(resolve(cwd, '.env'))
loadEnvFile(resolve(cwd, `.env.${envName}`))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/image',
    '@element-plus/nuxt',
    '@formkit/auto-animate'
  ],

  app: {
    head: {
      title: '股票量化交易平台',
      htmlAttrs: { lang: 'zh-CN' }
    }
  },

  // 运行时配置：服务端密钥只放在 runtimeConfig（非 public），
  // 由环境变量以 NUXT_ 前缀覆盖。
  runtimeConfig: {
    // 数据库（PostgreSQL）
    db: {
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      password: '',
      database: 'rit_stock_platform'
    },
    // 缓存与消息队列（Redis）
    redis: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      db: 0
    },
    // 鉴权
    jwt: {
      secret: '',
      expiresIn: '1d' // 登录有效期 1 天
    },
    // 密码加盐（重要配置，仅服务端可见，绝不暴露给客户端）
    passwordSalt: '',

    public: {
      appName: '股票量化交易平台'
    }
  }
})
