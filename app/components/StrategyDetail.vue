<script setup lang="ts">
/**
 * 策略详情面板：展示扩展字段（K线索引/进场价）与 JSON 统计字段
 * （result / CalcCha / scoreDetail），将原始 JSON 字符串解析为键值徽章，
 * 降低阅读成本。PC 端用于表格展开行，移动端用于卡片展开区。
 */
interface StrategyItem {
  stockNumber: string
  stockName: string
  nextIndex: number | null
  direct: string | null
  price: number | null
  tp: number | null
  sl: number | null
  pl: number | null
  result: string | null
  ratio: number | null
  total: number | null
  period: string | null
  tacticResolveTime: string | null
  BSP: number | null
  JXP: number | null
  CalcCha: string | null
  scoreDetail?: string | null
  analyzeScore?: number | null
}

const props = defineProps<{
  row: StrategyItem
  canSeeAll: boolean
}>()

// JSON 字符串 → 键值对数组；解析失败或为空返回 null
function parseEntries(s: string | null | undefined): Array<{ k: string; v: string }> | null {
  if (!s) return null
  try {
    const obj = JSON.parse(s)
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.entries(obj as Record<string, unknown>).map(([k, v]) => ({
        k,
        v: typeof v === 'number' ? String(v) : String(v ?? '-')
      }))
    }
    return [{ k: '值', v: String(obj) }]
  } catch {
    return [{ k: '原文', v: s }]
  }
}

const resultEntries = computed(() => parseEntries(props.row.result))
const calcChaEntries = computed(() => parseEntries(props.row.CalcCha))
const scoreEntries = computed(() =>
  props.canSeeAll ? parseEntries(props.row.scoreDetail) : null
)

const fmtNum = (v: number | null | undefined) => (v == null ? '-' : v)
</script>

<template>
  <div class="detail-panel">
    <!-- 扩展数值字段 -->
    <div class="detail-grid">
      <div class="detail-item">
        <span class="dl">K 线索引</span>
        <span class="dv tabular-nums">{{ fmtNum(row.nextIndex) }}</span>
      </div>
      <div class="detail-item">
        <span class="dl">保守进场价 (BSP)</span>
        <span class="dv tabular-nums">{{ fmtNum(row.BSP) }}</span>
      </div>
      <div class="detail-item">
        <span class="dl">极限进场价 (JXP)</span>
        <span class="dv tabular-nums">{{ fmtNum(row.JXP) }}</span>
      </div>
      <div class="detail-item">
        <span class="dl">结果订单数</span>
        <span class="dv tabular-nums">{{ fmtNum(row.total) }}</span>
      </div>
      <div class="detail-item">
        <span class="dl">平保 (PL)</span>
        <span class="dv tabular-nums">{{ fmtNum(row.pl) }}</span>
      </div>
    </div>

    <!-- JSON 统计字段：键值徽章化 -->
    <div v-if="resultEntries" class="json-block">
      <div class="json-title">统计结果 · result</div>
      <div class="kv-chips">
        <span v-for="e in resultEntries" :key="e.k" class="kv">
          <i>{{ e.k }}</i>
          <b class="tabular-nums">{{ e.v }}</b>
        </span>
      </div>
    </div>

    <div v-if="calcChaEntries" class="json-block">
      <div class="json-title">通道统计 · CalcCha</div>
      <div class="kv-chips">
        <span v-for="e in calcChaEntries" :key="e.k" class="kv kv-gold">
          <i>{{ e.k }}</i>
          <b class="tabular-nums">{{ e.v }}</b>
        </span>
      </div>
    </div>

    <div v-if="scoreEntries" class="json-block">
      <div class="json-title">分数详情 · scoreDetail</div>
      <div class="kv-chips">
        <span v-for="e in scoreEntries" :key="e.k" class="kv kv-gold">
          <i>{{ e.k }}</i>
          <b class="tabular-nums">{{ e.v }}</b>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 6px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border-light);
  border-radius: 10px;
}
.dl {
  font-size: 11px;
  color: var(--app-text-3);
  letter-spacing: 0.02em;
}
.dv {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-1);
}

.json-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.json-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-3);
  letter-spacing: 0.05em;
}
.kv-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.kv {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--app-surface-2);
  border: 1px solid var(--app-border);
}
.kv i {
  font-style: normal;
  font-size: 12px;
  color: var(--app-text-3);
}
.kv b {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-1);
}
.kv-gold {
  background: var(--app-gold-soft);
  border-color: rgba(230, 172, 0, 0.28);
}
.kv-gold b {
  color: var(--app-gold-strong);
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
