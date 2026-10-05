-- 004：VIP 续期操作记录表
CREATE TABLE IF NOT EXISTS vip_operation_records (
  id             BIGSERIAL     PRIMARY KEY,
  operator_phone VARCHAR(20)   NOT NULL,                   -- 操作人手机号
  target_phone   VARCHAR(20)   NOT NULL,                   -- 被修改人手机号
  duration       VARCHAR(20)   NOT NULL,                   -- 延长类型：1个月/3个月/半年/1年
  months         INTEGER       NOT NULL,                   -- 对应月数
  operated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()      -- 操作时间
);

CREATE INDEX IF NOT EXISTS idx_vip_records_operated_at ON vip_operation_records (operated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vip_records_target ON vip_operation_records (target_phone);
