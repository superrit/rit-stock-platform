import { SignJWT, jwtVerify } from 'jose'
import { getConfig } from './config'

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getConfig().jwt.secret)
}

// 签发 JWT，expiresInSeconds 为相对秒数
export async function signToken(
  payload: Record<string, unknown>,
  expiresInSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(now + expiresInSeconds)
    .sign(getSecret())
}

// 校验 JWT，失败（过期/签名错误）抛错
export async function verifyToken<T extends Record<string, unknown>>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
  return payload as unknown as T
}
