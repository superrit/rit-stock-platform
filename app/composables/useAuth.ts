export interface AuthUser {
  id: number
  phone: string
  role: 'super_admin' | 'user' | 'vip'
  isVip: boolean
  vipExpireAt: string | null
}

export interface LoginSuccess {
  needChangePassword: false
  token: string
  user: AuthUser
}

export interface LoginNeedChange {
  needChangePassword: true
  changePasswordToken: string
  message?: string
}

export type LoginResult = LoginSuccess | LoginNeedChange

export const roleLabels: Record<AuthUser['role'], string> = {
  super_admin: '超级管理员',
  user: '普通用户',
  vip: 'VIP 用户'
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth:user', () => null)

  // 使用 useRequestFetch 以便 SSR 时自动转发 cookie
  async function fetchMe(): Promise<AuthUser | null> {
    try {
      const requestFetch = useRequestFetch()
      const data = await requestFetch<{ user: AuthUser }>('/api/auth/me')
      user.value = data.user
      return data.user
    } catch {
      user.value = null
      return null
    }
  }

  async function login(phone: string, password: string): Promise<LoginResult> {
    return await $fetch<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: { phone, password }
    })
  }

  async function changePassword(
    changePasswordToken: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ token: string; user: AuthUser }> {
    const data = await $fetch<{ token: string; user: AuthUser }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: { changePasswordToken, oldPassword, newPassword }
      }
    )
    user.value = data.user
    return data
  }

  async function logout(): Promise<void> {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    user.value = null
    await navigateTo('/login')
  }

  return { user, fetchMe, login, changePassword, logout }
}
