-- 002：股票分析策略上报表（hash 唯一索引，重复上报覆盖）
CREATE TABLE IF NOT EXISTS strategy_reports (
  hash                VARCHAR(128)  PRIMARY KEY,          -- 策略 hash（唯一索引）
  ud_str              VARCHAR(64),
  stock_number        VARCHAR(32),
  stock_name          VARCHAR(128),
  next_index          INTEGER,
  direct              VARCHAR(16),
  price               DOUBLE PRECISION,
  tp                  DOUBLE PRECISION,
  sl                  DOUBLE PRECISION,
  pl                  DOUBLE PRECISION,
  result              TEXT,                                -- 统计结果（JSON 字符串原样存储）
  ratio               DOUBLE PRECISION,
  total               BIGINT,
  period              VARCHAR(32),
  tactic_resolve_time TIMESTAMPTZ,
  bsp                 DOUBLE PRECISION,
  jxp                 DOUBLE PRECISION,
  calc_cha            TEXT,                                -- 统计结果（JSON 字符串）
  must_eles           TEXT,                                -- 统计特征（JSON 字符串）
  score_detail        TEXT,                                -- 分数详情（JSON 字符串）
  analyze_score       DOUBLE PRECISION,
  report_ts           BIGINT,                              -- 上报时间戳
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_reports_stock ON strategy_reports (stock_number);
CREATE INDEX IF NOT EXISTS idx_strategy_reports_resolve_time ON strategy_reports (tactic_resolve_time);
