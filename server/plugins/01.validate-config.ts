import { getConfig } from '../utils/config'

// 启动时集中校验环境配置，快速失败
export default defineNitroPlugin(() => {
  try {
    const cfg = getConfig()
    console.log(
      `[init] 环境配置校验通过 → db=${cfg.db.host}:${cfg.db.port}/${cfg.db.database}, ` +
      `redis=${cfg.redis.host}:${cfg.redis.port}, jwt=${cfg.jwt.expiresIn}`
    )
  } catch (err) {
    console.error('[init] 环境配置校验失败:', err instanceof Error ? err.message : err)
    throw err
  }
})
