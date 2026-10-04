import Redis from 'ioredis'
import { getConfig } from './config'

let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) {
    const { redis } = getConfig()
    client = new Redis({
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true
    })
  }
  return client
}
