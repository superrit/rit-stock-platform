-- 003：用户登录记录表（保留 6 个月，登录时记录）
CREATE TABLE IF NOT EXISTS login_records (
  id        BIGSERIAL     PRIMARY KEY,
  phone     VARCHAR(20)   NOT NULL,
  ip        VARCHAR(64),
  device    VARCHAR(512),                                  -- User-Agent
  login_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_records_login_at ON login_records (login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_records_phone ON login_records (phone);
