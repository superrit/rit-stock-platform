#!/usr/bin/env node
/**
 * 生成 favicon.ico（多尺寸，PNG 嵌入）+ logo.png（用于站内展示）。
 * 用法：node scripts/build-logo.mjs <源图片路径>
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const src = resolve(process.argv[2])
const outDir = fileURLToPath(new URL('../public/', import.meta.url))

const SIZES = [256, 48, 32, 16]

function buildIco(pngs) {
  // ICO 头 6 字节
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = 1 (icon)
  header.writeUInt16LE(pngs.length, 4) // count

  const entries = []
  const datas = []
  let offset = 6 + 16 * pngs.length

  for (const { size, buf } of pngs) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size === 256 ? 0 : size, 0) // width（0 表示 256）
    entry.writeUInt8(size === 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bit count
    entry.writeUInt32LE(buf.length, 8) // bytes in resource
    entry.writeUInt32LE(offset, 12) // image offset
    entries.push(entry)
    datas.push(buf)
    offset += buf.length
  }

  return Buffer.concat([header, ...entries, ...datas])
}

async function main() {
  if (!existsSync(src)) {
    console.error('源图片不存在:', src)
    process.exit(1)
  }

  const pngs = []
  for (const size of SIZES) {
    const buf = await sharp(src).resize(size, size).png().toBuffer()
    pngs.push({ size, buf })
  }

  writeFileSync(resolve(outDir, 'favicon.ico'), buildIco(pngs))
  console.log('✓ public/favicon.ico 已生成（尺寸:', SIZES.join('/'), '）')

  // 站内展示用 logo（512px PNG）
  const logo = await sharp(src).resize(512, 512).png().toBuffer()
  writeFileSync(resolve(outDir, 'logo.png'), logo)
  console.log('✓ public/logo.png 已生成（512x512）')
}

main().catch((err) => {
  console.error('生成失败:', err)
  process.exit(1)
})
