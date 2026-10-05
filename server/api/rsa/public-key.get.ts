import { getPublicKeyInfo } from '../../utils/rsa'

// GET /api/rsa/public-key —— 公开接口，无需鉴权
export default defineEventHandler(() => {
  return getPublicKeyInfo()
})
