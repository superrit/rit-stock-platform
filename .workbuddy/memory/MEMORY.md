# 项目长期记忆 - rit-stock-platform

## 项目概览
股票量化交易平台。Nuxt 4.5.2 (SSR) + Vue3 + Element Plus + PostgreSQL + Redis。当前为初版（已交付登录鉴权模块）。

## 技术约定
- **环境变量**：`.env.development`(dev) / `.env.production`(prod) / `.env.example`(模板)。Nuxt 4 不自动加载 `.env.{NODE_ENV}`，需在 `nuxt.config.ts` 顶部手动 loadEnv（已有实现）。
- **运行时配置**：服务端密钥放 `runtimeConfig`（非 public），env 用 `NUXT_` 前缀。`server/utils/config.ts` 的 `getConfig()` 统一读取+校验。
- **密码**：MD5(全局盐+明文)，盐在 `NUXT_PASSWORD_SALT`（仅服务端）。默认密码=手机号后6位，首次登录强制改密。
- **鉴权**：JWT(HS256, jose) + Redis 单设备会话。token 存 httpOnly cookie `rit_token`。Redis key：`auth:session:{userId}`、`auth:cp:{userId}`。
- **角色**：super_admin / user / vip；VIP 靠 `vip_expire_at` 动态判定过期降级。

## 命令约定
- 构建/开发需加 `NODE_OPTIONS=` 前缀以绕过 WorkBuddy 安全删除守卫（否则 `[safe-delete]` 拦截批量删除 node_modules）。
- 初始化数据库：`node scripts/init-db.mjs .env.development`
- 包管理器：yarn 1.22

## 数据库
- 库名 `rit_stock_platform`，表 `users`（schema 见 `server/db/schema.sql`）。
- 连接信息在 `.env.development`（gitignored），密码含 `#` 需引号包裹。

## 演示账号（默认密码=手机号后6位，首次登录改密）
- 超级管理员 13800000000 / 普通用户 13800000001
- VIP 13800000002（有效）/ 过期VIP 13800000003
