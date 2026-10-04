import { Pool } from 'pg'
import type { QueryResultRow } from 'pg'
import { getConfig } from './config'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const { db } = getConfig()
    pool = new Pool({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })
  }
  return pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows.length > 0 ? rows[0] : null
}
