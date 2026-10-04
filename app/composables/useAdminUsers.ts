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
  { label: '1个月', months: 1 },
  { label: '3个月', months: 3 },
  { label: '半年', months: 6 },
  { label: '1年', months: 12 }
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

  async function extendVip(id: number, months: number): Promise<AdminUser> {
    const data = await $fetch<{ user: AdminUser }>(`/api/users/${id}/vip`, {
      method: 'POST',
      body: { months }
    })
    return data.user
  }

  async function remove(id: number): Promise<void> {
    await $fetch(`/api/users/${id}`, { method: 'DELETE' })
  }

  return { list, create, updateRemark, extendVip, remove }
}
