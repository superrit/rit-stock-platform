import { requireAdmin } from '../utils/auth'
import { listUsers } from '../utils/users'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const users = await listUsers()
  return { users }
})
