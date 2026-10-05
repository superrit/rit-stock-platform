import { getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import { query } from './db'

export interface LoginRecord {
  id: number
  phone: string
  ip: string | null
  device: string | null
  login_at: string
}

// 登录成功后记录登录时间/IP/设备/手机号，并顺带清理超过 6 个月的旧记录
export async function recordLogin(event: H3Event, phone: string): Promise<void> {
  const ip = getRequestIP(event, { xForwardedFor: true }) || ''
  const device = getHeader(event, 'user-agent') || ''
  await query(
    'INSERT INTO login_records (phone, ip, device) VALUES ($1, $2, $3)',
    [phone, ip, device]
  )
  // 只保留 6 个月
  await query("DELETE FROM login_records WHERE login_at < NOW() - INTERVAL '6 months'")
}

export async function listLoginRecords(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize
  const records = await query<LoginRecord>(
    'SELECT id, phone, ip, device, login_at FROM login_records ORDER BY login_at DESC LIMIT $1 OFFSET $2',
    [pageSize, offset]
  )
  const countRes = await query<{ count: string }>('SELECT COUNT(*) AS count FROM login_records')
  const total = Number(countRes[0]?.count ?? 0)
  return { records, total, page, pageSize }
}
