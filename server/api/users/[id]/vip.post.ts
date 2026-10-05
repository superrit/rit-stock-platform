import { requireAdmin } from '../../../utils/auth'
import { extendVip, VIP_DURATIONS } from '../../../utils/users'
import type { VipDurationKey } from '../../../utils/users'
import { findUserById } from '../../../utils/users'
import { recordVipOperation } from '../../../utils/vip-records'

// POST /api/users/:id/vip —— VIP 续期（解耦为独立接口，仅管理员，延长类型走统一枚举）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '非法用户 ID' })
  }

  const body = await readBody<{ duration?: string }>(event).catch(() => ({}))
  const durationKey = body?.duration as VipDurationKey
  const opt = VIP_DURATIONS[durationKey]
  if (!opt) {
    throw createError({
      statusCode: 400,
      message: '不支持的有效期选项，可选：1month / 3months / 6months / 1year'
    })
  }

  const target = await findUserById(id)
  if (!target) throw createError({ statusCode: 404, message: '用户不存在' })

  const user = await extendVip(id, opt.months)
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  // 记录操作：操作时间、延长类型、操作人手机号、被修改人手机号
  await recordVipOperation(admin.phone, target.phone, opt.label, opt.months)

  return { user, duration: opt.label, months: opt.months }
})
