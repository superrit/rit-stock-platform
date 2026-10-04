// 集中式配置：从 runtimeConfig 读取并做类型转换与校验（快速失败）
export interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export interface RedisConfig {
  host: string
  port: number
  password: string
  db: number
}

export interface AppConfig {
  db: DbConfig
  redis: RedisConfig
  jwt: { secret: string; expiresIn: string }
  passwordSalt: string
}

function requireValue(name: string, value: string): string {
  if (!value || !value.trim()) {
    throw new Error(`[config] 缺少必需配置项 ${name}，请在对应 .env 文件中设置`)
  }
  return value.trim()
}

export function getConfig(): AppConfig {
  const rc = useRuntimeConfig()

  const config: AppConfig = {
    db: {
      host: String(rc.db?.host || '127.0.0.1'),
      port: Number(rc.db?.port || 5432),
      user: String(rc.db?.user || 'postgres'),
      password: String(rc.db?.password || ''),
      database: String(rc.db?.database || 'rit_stock_platform')
    },
    redis: {
      host: String(rc.redis?.host || '127.0.0.1'),
      port: Number(rc.redis?.port || 6379),
      password: String(rc.redis?.password || ''),
      db: Number(rc.redis?.db || 0)
    },
    jwt: {
      secret: requireValue('NUXT_JWT_SECRET', String(rc.jwt?.secret || '')),
      expiresIn: String(rc.jwt?.expiresIn || '1d')
    },
    passwordSalt: requireValue('NUXT_PASSWORD_SALT', String(rc.passwordSalt || ''))
  }

  if (Number.isNaN(config.db.port) || config.db.port <= 0) {
    throw new Error('[config] NUXT_DB_PORT 非法')
  }
  if (Number.isNaN(config.redis.port) || config.redis.port <= 0) {
    throw new Error('[config] NUXT_REDIS_PORT 非法')
  }

  return config
}

// 解析 "1d" / "12h" / "30m" / "60s" 为秒
export function parseDuration(input: string): number {
  const m = /^(\d+)([smhd])$/.exec(input.trim())
  if (!m) throw new Error(`[config] 非法时长格式: ${input}`)
  const n = Number(m[1])
  const unit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return n * unit[m[2]]
}
