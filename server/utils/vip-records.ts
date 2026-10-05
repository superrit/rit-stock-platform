import { query } from './db'

export interface VipOperationRecord {
  id: number
  operator_phone: string
  target_phone: string
  duration: string
  months: number
  operated_at: string
}

export async function recordVipOperation(
  operatorPhone: string,
  targetPhone: string,
  durationLabel: string,
  months: number
): Promise<void> {
  await query(
    `INSERT INTO vip_operation_records (operator_phone, target_phone, duration, months)
     VALUES ($1, $2, $3, $4)`,
    [operatorPhone, targetPhone, durationLabel, months]
  )
}

export async function listVipRecords(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize
  const records = await query<VipOperationRecord>(
    `SELECT id, operator_phone, target_phone, duration, months, operated_at
     FROM vip_operation_records ORDER BY operated_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  )
  const countRes = await query<{ count: string }>('SELECT COUNT(*) AS count FROM vip_operation_records')
  const total = Number(countRes[0]?.count ?? 0)
  return { records, total, page, pageSize }
}
