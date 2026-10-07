-- 005：策略查询性能优化——预计算日期列 + 补建索引
-- 目的：
--   1) 让“分析日期”筛选走索引（原 (tactic_resolve_time AT TIME ZONE ...)::date 表达式不可用于 B-tree 索引）
--   2) 为高频筛选/排序字段（direct/period/analyze_score）补索引
--   3) 为默认查询组合（周期 + 日期）建组合索引
--   4) 为 stock_number/stock_name 模糊搜索建 pg_trgm GIN 索引
-- 幂等：均可重复执行

-- 1) 预计算分析日期（中国时区 Asia/Shanghai 的日期，语义与原表达式一致）
ALTER TABLE strategy_reports ADD COLUMN IF NOT EXISTS resolve_date DATE;

-- 回填历史数据（仅填充尚未计算的行）
UPDATE strategy_reports
   SET resolve_date = (tactic_resolve_time AT TIME ZONE 'Asia/Shanghai')::date
 WHERE resolve_date IS NULL
   AND tactic_resolve_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_strategy_reports_resolve_date ON strategy_reports (resolve_date);

-- 2) 高频筛选/排序字段索引
CREATE INDEX IF NOT EXISTS idx_strategy_reports_direct ON strategy_reports (direct);
CREATE INDEX IF NOT EXISTS idx_strategy_reports_period ON strategy_reports (period);
CREATE INDEX IF NOT EXISTS idx_strategy_reports_analyze_score ON strategy_reports (analyze_score DESC);

-- 3) 默认查询组合索引：最常见的「周期=day 且 最新分析日期」
CREATE INDEX IF NOT EXISTS idx_strategy_reports_period_date ON strategy_reports (period, resolve_date);

-- 4) 模糊搜索（ILIKE '%kw%'）：pg_trgm GIN 索引
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_strategy_reports_stock_number_trgm ON strategy_reports USING gin (stock_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_strategy_reports_stock_name_trgm ON strategy_reports USING gin (stock_name gin_trgm_ops);
