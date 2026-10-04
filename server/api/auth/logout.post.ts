import { getCurrentUser } from '../../utils/auth'
import { revokeSession, clearAuthCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (user) {
    await revokeSession(user.id)
  }
  clearAuthCookie(event)
  return { success: true }
})
