export interface AdminUser {
  id: number
  phone: string
  role: string
  effectiveRole: string
  isVip: boolean
  vipExpireAt: string | null
  vipRemainingDays: number | null
  remark: string | null
  mustChangePassword: boolean
  status: string
  createdAt: string
}

export const vipDurationOptions = [
  { label: '1个月', duration: '1month' },
  { label: '3个月', duration: '3months' },
  { label: '半年', duration: '6months' },
  { label: '1年', duration: '1year' }
]

export function useAdminUsers() {
  async function list(): Promise<AdminUser[]> {
    const data = await $fetch<{ users: AdminUser[] }>('/api/users')
    return data.users
  }

  async function create(phone: string, remark: string): Promise<AdminUser> {
    const data = await $fetch<{ user: AdminUser }>('/api/users', {
      method: 'POST',
      body: { phone, remark }
    })
    return data.user
  }

  async function updateRemark(id: number, remark: string): Promise<AdminUser> {
    const data = await $fetch<{ user: AdminUser }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: { remark }
    })
    return data.user
  }

  async function extendVip(id: number, duration: string): Promise<AdminUser> {
    const data = await $fetch<{ user: AdminUser }>(`/api/users/${id}/vip`, {
      method: 'POST',
      body: { duration }
    })
    return data.user
  }

  async function remove(id: number): Promise<void> {
    await $fetch(`/api/users/${id}`, { method: 'DELETE' })
  }

  return { list, create, updateRemark, extendVip, remove }
}
