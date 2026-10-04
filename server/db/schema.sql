-- ============================================================
-- 股票量化交易平台 - 数据库初始化迁移
-- 数据库: rit_stock_platform
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                   BIGSERIAL     PRIMARY KEY,
  phone                VARCHAR(20)   NOT NULL UNIQUE,          -- 手机号（登录账号）
  password_hash        VARCHAR(64)   NOT NULL,                 -- MD5(盐 + 明文) 十六进制
  salt                 VARCHAR(128)  NOT NULL,                 -- 加盐值（全局盐，来自重要配置）
  role                 VARCHAR(20)   NOT NULL DEFAULT 'user',  -- super_admin | user | vip
  must_change_password BOOLEAN       NOT NULL DEFAULT TRUE,    -- 首次登录强制改密
  vip_expire_at        TIMESTAMPTZ,                            -- VIP 有效期截止时间
  remark               VARCHAR(255),                           -- 备注
  status               VARCHAR(20)   NOT NULL DEFAULT 'active',-- active | disabled
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_vip_expire ON users (vip_expire_at);
