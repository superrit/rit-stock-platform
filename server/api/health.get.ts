import { query } from '../utils/db'
import { getRedis } from '../utils/redis'

export default defineEventHandler(async () => {
  let dbStatus = 'down'
  let redisStatus = 'down'
  try {
    await query('SELECT 1')
    dbStatus = 'up'
  } catch {}
  try {
    await getRedis().ping()
    redisStatus = 'up'
  } catch {}
  return {
    status: dbStatus === 'up' && redisStatus === 'up' ? 'ok' : 'degraded',
    db: dbStatus,
    redis: redisStatus,
    env: import.meta.dev ? 'dev' : 'prod',
    time: new Date().toISOString()
  }
})
