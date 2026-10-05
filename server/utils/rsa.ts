import {
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  constants
} from 'node:crypto'
import { getConfig } from './config'

let cachedPrivateKey: ReturnType<typeof createPrivateKey> | null = null
let cachedPublicKeyPem: string | null = null

function getPrivateKey() {
  if (!cachedPrivateKey) {
    const b64 = getConfig().rsaPrivateKey
    const pem = Buffer.from(b64, 'base64').toString('utf8')
    cachedPrivateKey = createPrivateKey(pem)
  }
  return cachedPrivateKey
}

// 对外提供公钥（SPKI PEM），客户端用它做 RSA-OAEP(SHA-256) 加密
export function getPublicKeyPem(): string {
  if (!cachedPublicKeyPem) {
    const publicKey = createPublicKey(getPrivateKey())
    cachedPublicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  }
  return cachedPublicKeyPem
}

export function getPublicKeyInfo() {
  return {
    algorithm: 'RSA-OAEP-256',
    keySize: 2048,
    padding: 'oaep-sha256',
    publicKey: getPublicKeyPem()
  }
}

// 用私钥解密客户端 RSA 加密的数据（入参为 base64 密文），供后续接口使用
export function decryptWithPrivateKey(encryptedBase64: string): string {
  const buffer = privateDecrypt(
    {
      key: getPrivateKey(),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encryptedBase64, 'base64')
  )
  return buffer.toString('utf8')
}
