# RIT 股票量化交易平台

基于 Nuxt 4 的全栈股票量化交易平台。当前已交付：登录鉴权、用户管理、VIP 续期、登录记录、策略上报与策略查看等模块。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Nuxt 4.5.2 (SSR) + Vue 3.5 + Element Plus |
| 后端 | Nuxt Server (Nitro) |
| 数据库 | PostgreSQL |
| 缓存/会话 | Redis |
| 鉴权 | JWT（`jose`，HS256）+ Redis 单设备会话 |
| 包管理 | yarn |

## 目录结构

```
rit-stock-platform/
├── app/                    # 前端源码（Nuxt 4 的 srcDir）
│   ├── pages/              # 页面（index=策略查看、login、profile、admin/*）
│   ├── components/         # 组件（AppHeader 等）
│   ├── composables/        # useAuth、useAdminUsers
│   ├── middleware/         # auth、guest、admin 路由守卫
│   └── plugins/            # auth-redirect.client（401 全局跳登录）
├── server/                 # 后端
│   ├── api/                # 接口（auth、users、strategy、rsa、login-records、vip-records）
│   ├── utils/              # 服务层（config/db/redis/auth/password/jwt/session/users/...）
│   └── db/                 # schema.sql + migrations/
├── scripts/                # init-db、migrate、reset-demo、build-logo
├── docs/api.md             # 接口文档
├── public/                 # logo.png、favicon.ico
└── nuxt.config.ts          # 运行时配置 + 环境变量加载
```

## 快速开始

### 1. 环境变量

复制模板并按环境填写真实值：

```bash
cp .env.example .env.development   # 开发环境
cp .env.example .env.production    # 生产环境（上线前替换为真实值）
```

关键配置项：`NUXT_DB_*`（数据库）、`NUXT_REDIS_*`（Redis）、`NUXT_JWT_SECRET`（JWT 密钥）、`NUXT_PASSWORD_SALT`（密码盐，一旦设置不可更改）、`NUXT_RSA_PRIVATE_KEY`（RSA 私钥 base64）、`NUXT_SIGN_SALT`（策略上报签名盐，32 位）。

> Nuxt 4 不会自动加载 `.env.{NODE_ENV}`，本项目在 `nuxt.config.ts` 顶部手动加载（dev → `.env.development`，build → `.env.production`）。

### 2. 安装依赖

```bash
yarn install
```

### 3. 初始化数据库（建库 + 建表 + 种子用户）

```bash
yarn db:setup
```

> 该命令等价于依次执行 `yarn db:init`（建库 + users 表 + 种子用户）和 `yarn db:migrate`（补建其余表）。生产环境需指定 `.env.production` 时，直接跑脚本：`node scripts/init-db.mjs .env.production && node scripts/migrate.mjs .env.production`。

### 4. 启动

```bash
yarn dev                  # 开发 http://localhost:3000
yarn build                # 生产构建
node .output/server/index.mjs   # 运行生产产物
```

## 数据库表重建（重要）

所有建表脚本都是**幂等**的（`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`），删表后执行一条命令即可完整重建：

```bash
yarn db:setup
```

等价于：

```bash
yarn db:init      # 建库（如不存在）+ users 表 + 种子用户
yarn db:migrate   # 迁移：strategy_reports / login_records / vip_operation_records / users.remark
```

表清单：

| 表 | 用途 | 来源 |
| --- | --- | --- |
| users | 用户（含 remark、vip_expire_at） | schema.sql + 迁移 001 |
| strategy_reports | 策略分析上报（hash 唯一 upsert） | 迁移 002 |
| login_records | 登录记录（保留 6 个月） | 迁移 003 |
| vip_operation_records | VIP 续期操作记录 | 迁移 004 |

> 只删了某张表时，直接重跑 `yarn db:migrate` 即可补建（`users` 表被删则先跑 `yarn db:init`）。如需重置演示账号密码，运行 `yarn db:reset`。

## 演示账号

默认密码 = 手机号后 6 位，首次登录强制改密。

| 手机号 | 角色 | 说明 |
| --- | --- | --- |
| 13800000000 | 超级管理员 | 用户管理、登录记录、VIP 记录 |
| 13800000001 | 普通用户 | — |
| 13800000002 | VIP | 有效期内 |
| 13800000003 | VIP | 已过期（演示自动降级为普通用户） |

## 功能与鉴权

- **登录鉴权**：密码 = `MD5(全局盐 + 明文)`；JWT（1 天）+ Redis 单设备会话；令牌存 httpOnly cookie `rit_token`。
- **角色**：`super_admin` / `user` / `vip`，VIP 靠 `vip_expire_at` 动态判定过期降级。
- **用户管理**（仅超管）：新增/改备注/删除用户；VIP 续期走统一枚举 `1month/3months/6months/1year`（前端不可自由上送时长），并写操作记录。
- **策略上报**：`POST /api/strategy/report`，MD5 签名 + 时间戳防重放，`hash` 唯一 upsert，单次约 2000 条。
- **策略查看**：首页 `/`，分页 + 排序 + 筛选（代码/名称/方向/周期/分析时间），字段按角色裁剪（普通用户 16 字段，VIP/超管多 `scoreDetail`/`analyzeScore`；`hash`/`udStr`/`mustEles` 不对外返回）。
- **RSA**：`GET /api/rsa/public-key` 返回公钥，供客户端 RSA-OAEP(SHA-256) 加密上传，后端私钥解密。

## 接口文档

完整接口定义（含签名规则、字段可见性、枚举值）见 **[docs/api.md](docs/api.md)**。

## 脚本速查

| 命令 | 说明 |
| --- | --- |
| `yarn db:init` | 建库 + users 表 + 种子用户 |
| `yarn db:migrate` | 应用 `server/db/migrations/*.sql` |
| `yarn db:setup` | `db:init` + `db:migrate`（一键建表） |
| `yarn db:reset` | 重置演示账号密码/角色/VIP |
| `node scripts/build-logo.mjs <源图>` | 生成多尺寸 favicon.ico + logo.png |

> 脚本默认读取项目根目录的 `.env.development`（不依赖当前工作目录）；生产环境可传参数指定：`node scripts/init-db.mjs .env.production`。

## 开发环境备注

本机 WorkBuddy 环境执行 `yarn` / `yarn build` 可能触发「安全删除守卫」拦截（批量删除 node_modules 时），可在命令前加 `NODE_OPTIONS=` 前缀绕过；普通开发机无此问题。
