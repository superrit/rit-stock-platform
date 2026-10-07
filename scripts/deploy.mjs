#!/usr/bin/env node
/**
 * 生产部署脚本：构建 → 打包 → 上传 → 远程初始化/启动 → 健康检查。
 *
 * 用法：
 *   npm run deploy            # 完整流程（构建 + 打包 + 上传 + 初始化 + 重启 + 健康检查）
 *   node scripts/deploy.mjs --skip-build      # 跳过本地构建（已有 .output）
 *   node scripts/deploy.mjs --skip-provision  # 跳过服务器环境初始化（首次部署后可用）
 *   node scripts/deploy.mjs --dry-run         # 只打印将要执行的步骤，不真正执行
 *
 * 依赖：读取项目根目录 .env.production 中的 SSH_* 配置（SSH_SERVE/SSH_PORT/SSH_USER/SSH_PASSWORD），
 *       使用 SSH_PASSWORD 密码认证登录服务器。运行时密钥通过 NUXT_* 环境变量注入。
 */
import {
  readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, statSync, mkdirSync, renameSync
} from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { Client } from 'ssh2'
import { c as tarCreate, x as tarExtract } from 'tar'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ENV_FILE = resolve(ROOT, '.env.production')

// 服务器端部署路径
const REMOTE_DIR = '/opt/rit-stock-platform'
const NODE_VERSION = '22.22.2' // 与本地构建所用 Node 主版本一致
const SERVICE_NAME = 'rit-stock'
const APP_PORT = 80

const args = process.argv.slice(2)
const FLAG = {
  skipBuild: args.includes('--skip-build'),
  skipProvision: args.includes('--skip-provision'),
  dryRun: args.includes('--dry-run')
}

/* ---------------- 工具函数 ---------------- */

function loadEnv(file) {
  if (!existsSync(file)) {
    console.error(`✗ 未找到环境文件：${file}`)
    process.exit(1)
  }
  const text = readFileSync(file, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

function sh(cmd, opts = {}) {
  if (FLAG.dryRun) {
    console.log('  [dry-run] $ ' + cmd)
    return ''
  }
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: 'inherit', ...opts })
  if (r.status !== 0) {
    throw new Error(`本地命令失败(${r.status}): ${cmd}`)
  }
  return r.stdout || ''
}

async function download(url, dest) {
  if (FLAG.dryRun) {
    console.log(`  [dry-run] 下载 ${url}`)
    return
  }
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function log(msg) { console.log(msg) }
function step(msg) { console.log(`\n▶ ${msg}`) }

/* ---------------- 生成服务器运行时环境文件（systemd 安全格式） ---------------- */

function buildRuntimeEnv(env) {
  // 只保留 NUXT_* 运行时配置，去掉 SSH_* 等本机专用项
  const keys = Object.keys(env).filter((k) => k.startsWith('NUXT_'))
  const lines = keys.map((k) => `${k}=${env[k]}`)
  // Nitro 监听端口/地址
  lines.push(`NITRO_PORT=${APP_PORT}`)
  lines.push(`NITRO_HOST=0.0.0.0`)
  lines.push(`PORT=${APP_PORT}`)
  lines.push(`HOST=0.0.0.0`)
  return lines.join('\n') + '\n'
}

/* ---------------- SSH 连接与命令执行 ---------------- */

function connect(env) {
  const client = new Client()
  return new Promise((resolvePromise, reject) => {
    client.on('ready', () => resolvePromise(client))
    client.on('error', (e) => reject(new Error(`SSH 连接失败：${e.message}`)))
    client.connect({
      host: env.SSH_SERVE,
      port: Number(env.SSH_PORT || 22),
      username: env.SSH_USER,
      password: env.SSH_PASSWORD || '',
      readyTimeout: 30000,
      tryKeyboard: true
    })
  })
}

// 执行远程命令，返回 { code, out, err }，实时打印输出
function run(client, cmd, { echo = true } = {}) {
  return new Promise((resolvePromise, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let out = ''
      let errOut = ''
      stream.on('data', (d) => { const s = d.toString(); out += s; if (echo) process.stdout.write(s) })
      stream.stderr.on('data', (d) => { const s = d.toString(); errOut += s; if (echo) process.stderr.write(s) })
      stream.on('close', (code) => resolvePromise({ code, out, err: errOut }))
    })
  })
}

// 上传单个文件
function putFile(client, local, remote) {
  return new Promise((resolvePromise, reject) => {
    client.sftp((err, sftp) => {
      if (err) return reject(err)
      sftp.fastPut(local, remote, (e) => {
        sftp.end()
        if (e) reject(e); else resolvePromise()
      })
    })
  })
}

/* ---------------- 各部署阶段 ---------------- */

// 1) 本地构建
function build() {
  if (FLAG.skipBuild) {
    if (!existsSync(join(ROOT, '.output/server/index.mjs'))) {
      throw new Error('--skip-build 指定但 .output/server/index.mjs 不存在，请先构建')
    }
    log('⏭  跳过构建（使用已有 .output）')
    return
  }
  step('构建项目（nuxt build）')
  sh('npm run build', { cwd: ROOT, env: { ...process.env, NODE_OPTIONS: '' } })
  log('✓ 构建完成 → .output/')
}

// 1.5) 跨平台防御：向 .output 注入 Linux 版 sharp 原生库。
//      @nuxt/image 的 ipx 在运行时惰性 `import("sharp")`；本机 Windows 构建默认只打包
//      win32 的 sharp.node。此处补齐 linux-x64 的 sharp.node + libvips，保证在 Linux 服务器上
//      即使触发图片优化也能正常加载（应用当前未使用图片优化，此步为可选加固，失败仅告警）。
async function ensureLinuxSharp() {
  step('补齐 Linux 版 sharp 原生库（跨平台加固）')
  const sharpPkgPath = join(ROOT, 'node_modules/sharp/package.json')
  if (!existsSync(sharpPkgPath)) {
    log('  ⚠ 未检测到 sharp，跳过')
    return
  }
  const sharpPkg = JSON.parse(readFileSync(sharpPkgPath, 'utf8'))
  const ver = sharpPkg.version || '0.35.5'
  const libvipsVer = sharpPkg.optionalDependencies?.['@img/sharp-libvips-linux-x64'] || '1.3.4'
  const outImg = join(ROOT, '.output/server/node_modules/@img')
  const bindingDir = join(outImg, 'sharp-linux-x64')
  const libvipsDir = join(outImg, 'sharp-libvips-linux-x64')
  if (existsSync(bindingDir) && existsSync(libvipsDir)) {
    log('  ✓ 已存在，跳过')
    return
  }
  try {
    if (FLAG.dryRun) {
      log(`  [dry-run] 将注入 sharp@${ver} (linux-x64) + libvips@${libvipsVer}`)
      return
    }
    const cacheDir = join(ROOT, 'node_modules/.cache/deploy-sharp')
    mkdirSync(cacheDir, { recursive: true })
    const bindingTgz = join(cacheDir, `sharp-linux-x64-${ver}.tgz`)
    const libvipsTgz = join(cacheDir, `sharp-libvips-linux-x64-${libvipsVer}.tgz`)
    if (!existsSync(bindingTgz)) {
      await download(`https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-${ver}.tgz`, bindingTgz)
    }
    if (!existsSync(libvipsTgz)) {
      await download(`https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-${libvipsVer}.tgz`, libvipsTgz)
    }
    mkdirSync(outImg, { recursive: true })
    if (!existsSync(bindingDir)) {
      mkdirSync(bindingDir, { recursive: true })
      await tarExtract({ file: bindingTgz, cwd: bindingDir, strip: 1 })
    }
    if (!existsSync(libvipsDir)) {
      mkdirSync(libvipsDir, { recursive: true })
      await tarExtract({ file: libvipsTgz, cwd: libvipsDir, strip: 1 })
    }
    log(`  ✓ 已注入 sharp@${ver} (linux-x64) + libvips@${libvipsVer}`)
  } catch (e) {
    log(`  ⚠ Linux sharp 注入失败（可忽略，应用未使用图片优化）：${e.message}`)
  }
}

// 2) 打包：.output + server/db → release.tar.gz；rit.env 单独上传
async function packageRelease(env) {
  step('打包产物')
  const tmp = mkdtempSync(join(os.tmpdir(), 'rit-deploy-'))
  const ritEnvPath = join(tmp, 'rit.env')
  const tarPath = join(tmp, 'release.tar.gz')
  writeFileSync(ritEnvPath, buildRuntimeEnv(env))
  if (FLAG.dryRun) {
    log('  [dry-run] tar(.output + server/db) → release.tar.gz；rit.env 单独上传')
    return { tmp, tarPath, ritEnvPath }
  }
  await tarCreate({ gzip: true, cwd: ROOT, file: tarPath }, ['.output', 'server/db'])
  const size = (statSync(tarPath).size / 1024 / 1024).toFixed(1)
  log(`✓ 打包完成：release.tar.gz（${size} MB）`)
  return { tmp, tarPath, ritEnvPath }
}

// 3) 上传并解压
async function uploadAndExtract(client, tarPath, ritEnvPath) {
  step('上传产物到服务器')
  await run(client, `sudo mkdir -p ${REMOTE_DIR} && sudo chown -R $USER ${REMOTE_DIR}`, { echo: false })
  await putFile(client, tarPath, '/tmp/release.tar.gz')
  await putFile(client, ritEnvPath, '/tmp/rit.env')
  log('✓ 已上传 release.tar.gz + rit.env')
  await run(client, [
    `sudo mv /tmp/release.tar.gz ${REMOTE_DIR}/release.tar.gz`,
    `sudo mv /tmp/rit.env ${REMOTE_DIR}/rit.env`,
    `cd ${REMOTE_DIR}`,
    `tar -xzf release.tar.gz`,
    `rm -f release.tar.gz`,
    `sudo chown -R $USER ${REMOTE_DIR}`,
    `sudo chmod 600 ${REMOTE_DIR}/rit.env`,
    `echo "解压完成 → ${REMOTE_DIR}"`
  ].join(' && '))
  log('✓ 解压完成')
}

// 4) 服务器环境初始化（幂等）：Node / PostgreSQL / Redis + 建库建表 + 种子账号
async function provision(client, env) {
  step('初始化服务器环境（Node / PostgreSQL / Redis）')

  // 4.1 Node.js（缺失时通过官方 tarball 安装）
  const nodeCheck = await run(client, 'command -v node && node -v', { echo: false })
  if (nodeCheck.code !== 0) {
    log('  · 安装 Node.js ' + NODE_VERSION + ' ...')
    await run(client, [
      `sudo apt-get update -qq`,
      `sudo apt-get install -y -qq xz-utils ca-certificates curl`,
      `cd /tmp && curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz -o node.tar.xz`,
      `sudo mkdir -p /opt/nodejs && sudo tar -xJf /tmp/node.tar.xz -C /opt/nodejs --strip-components=1`,
      `sudo ln -sf /opt/nodejs/bin/node /usr/local/bin/node`,
      `sudo ln -sf /opt/nodejs/bin/npm /usr/local/bin/npm`,
      `sudo ln -sf /opt/nodejs/bin/npx /usr/local/bin/npx`,
      `node -v`
    ].join(' && '))
    log('  ✓ Node.js 就绪')
  } else {
    log(`  ✓ Node 已存在：${nodeCheck.out.trim()}`)
  }

  // 4.2 PostgreSQL + Redis（缺失时 apt 安装）
  const depCheck = await run(client, 'command -v psql >/dev/null && command -v redis-server >/dev/null && echo ok', { echo: false })
  if (depCheck.code !== 0) {
    log('  · 安装 PostgreSQL / Redis ...')
    await run(client, 'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql redis-server')
    log('  ✓ PostgreSQL / Redis 安装完成')
  } else {
    log('  ✓ PostgreSQL / Redis 已存在')
  }

  // 4.3 启动并设置 postgres 密码
  const dbPassword = env.NUXT_DB_PASSWORD || ''
  const dbUser = env.NUXT_DB_USER || 'postgres'
  const dbName = env.NUXT_DB_DATABASE || 'rit_stock_platform'
  await run(client, 'sudo systemctl enable --now postgresql redis-server', { echo: false })
  await run(client, `sudo -u postgres psql -c "ALTER USER ${dbUser} WITH PASSWORD '${dbPassword}'"`, { echo: false })

  // 4.4 建库（幂等）
  await run(client, `sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${dbName}'" | grep -q 1 || sudo -u postgres createdb -O ${dbUser} ${dbName}`, { echo: false })
  log(`  ✓ 数据库 ${dbName} 就绪`)

  // 4.5 应用 schema + 迁移（幂等）
  await run(client, `sudo -u postgres psql -q -d ${dbName} -f ${REMOTE_DIR}/server/db/schema.sql`, { echo: false })
  await run(client, `for f in ${REMOTE_DIR}/server/db/migrations/*.sql; do sudo -u postgres psql -q -d ${dbName} -f "$f"; done`, { echo: false })
  log('  ✓ schema + 迁移已应用')

  // 4.6 种子默认超级管理员（密码 = 手机号后 6 位，首次登录强制改密）
  const salt = env.NUXT_PASSWORD_SALT || ''
  const adminPhone = '13800000000'
  const adminHash = createHash('md5').update(salt + adminPhone.slice(-6)).digest('hex')
  await run(client, `sudo -u postgres psql -d ${dbName} -c "INSERT INTO users (phone, password_hash, salt, role, must_change_password) VALUES ('${adminPhone}', '${adminHash}', '${salt}', 'super_admin', TRUE) ON CONFLICT (phone) DO NOTHING"`, { echo: false })
  log('  ✓ 默认超级管理员就绪（13800000000 / 000000）')
}

// 5) 写入 systemd 服务（监听 80 端口，进程守护 + 开机自启）
async function writeService(client, env) {
  step('配置 systemd 服务（端口 ' + APP_PORT + '，守护进程）')
  const unit = `[Unit]
Description=RIT Stock Trading Platform (Nuxt/Nitro)
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=${env.SSH_USER}
WorkingDirectory=${REMOTE_DIR}
EnvironmentFile=${REMOTE_DIR}/rit.env
AmbientCapabilities=CAP_NET_BIND_SERVICE
ExecStart=/opt/nodejs/bin/node .output/server/index.mjs
Restart=always
RestartSec=5
TimeoutStartSec=60
# 安全加固
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`
  if (FLAG.dryRun) {
    log('  [dry-run] 写入 /etc/systemd/system/' + SERVICE_NAME + '.service')
    return
  }
  const localUnit = join(os.tmpdir(), `${SERVICE_NAME}.service`)
  writeFileSync(localUnit, unit)
  await putFile(client, localUnit, `/tmp/${SERVICE_NAME}.service`)
  await run(client, [
    `sudo mv /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service`,
    `sudo systemctl daemon-reload`,
    `sudo systemctl enable ${SERVICE_NAME}`
  ].join(' && '))
  log('✓ systemd 服务已写入并启用开机自启')
}

// 6) 重启服务
async function restart(client) {
  step('重启服务')
  await run(client, `sudo systemctl restart ${SERVICE_NAME} && sleep 2 && sudo systemctl --no-pager -l status ${SERVICE_NAME} | head -20`)
}

// 7) 健康检查
async function healthcheck(client, env) {
  step('健康检查')
  const checks = [
    ['本地端口 80 健康检查', `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${APP_PORT}/api/health`],
    ['本地首页', `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${APP_PORT}/`],
    ['RSA 公钥接口', `curl -s http://127.0.0.1:${APP_PORT}/api/rsa/public-key | head -c 120`]
  ]
  for (const [title, cmd] of checks) {
    const r = await run(client, cmd + '\n', { echo: false })
    console.log(`  ${title}: ${(r.out || r.err || '').trim() || '(无输出)'}`)
  }
  const svc = await run(client, `sudo systemctl is-active ${SERVICE_NAME}`, { echo: false })
  console.log(`  服务状态: ${svc.out.trim()}`)
}

/* ---------------- 主流程 ---------------- */

async function main() {
  const env = loadEnv(ENV_FILE)
  if (!env.SSH_SERVE || !env.SSH_USER) {
    console.error('✗ .env.production 缺少 SSH_SERVE / SSH_USER 配置')
    process.exit(1)
  }
  log(`目标服务器：${env.SSH_USER}@${env.SSH_SERVE}:${env.SSH_PORT || 22}`)
  if (FLAG.dryRun) log('（dry-run 模式，不执行任何真实操作）')

  let tmp = null
  try {
    build()
    await ensureLinuxSharp()
    const pkg = await packageRelease(env)
    tmp = pkg.tmp

    if (FLAG.dryRun) {
      log('\n[dry-run] 后续将执行：SSH 连接 → 上传解压 → 环境初始化 → 写 systemd 服务 → 重启 → 健康检查')
      log('[dry-run] 目标端口：' + APP_PORT + '；服务名：' + SERVICE_NAME)
      return
    }

    const client = await connect(env)
    log('✓ SSH 已连接')

    await uploadAndExtract(client, pkg.tarPath, pkg.ritEnvPath)
    if (!FLAG.skipProvision) {
      await provision(client, env)
    } else {
      log('⏭  跳过服务器环境初始化（--skip-provision）')
    }
    await writeService(client, env)
    await restart(client)
    await healthcheck(client, env)

    client.end()
    log('\n🎉 部署完成！访问：http://' + env.SSH_SERVE)
  } catch (e) {
    console.error('\n✗ 部署失败：', e.message || e)
    process.exit(1)
  } finally {
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true })
    }
  }
}

main()
