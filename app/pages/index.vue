<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft, TrendCharts, DataAnalysis, Upload, Download } from '@element-plus/icons-vue'

definePageMeta({ middleware: 'auth', layout: 'default' })

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

const { user } = useAuth()
// 普通用户只能看基础字段，VIP/超管可见全部
const canSeeAll = computed(() => user.value?.role !== 'user')

const loading = ref(false)
const records = ref<StrategyItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const directs = ref<string[]>([])
const periods = ref<string[]>([])
const dates = ref<string[]>([])

// 筛选条件（周期默认 day，分析时间默认选中最后上报时间）
const filters = reactive({
  stockNumber: '',
  stockName: '',
  direct: '',
  period: 'day',
  dates: [] as string[]
})

// 周期下拉选项（确保 day 始终存在）
const periodOptions = computed(() => Array.from(new Set(['day', ...periods.value])))

// 移动端筛选面板折叠状态
const filterExpanded = ref(false)

// 移动端卡片展开集合
const expandedCards = ref(new Set<string>())

// 视口检测（仅影响分页布局等轻量差异，首屏 SSR 与客户端一致）
const isMobile = ref(false)
onMounted(() => {
  const check = () => {
    isMobile.value = window.innerWidth < 768
  }
  check()
  window.addEventListener('resize', check, { passive: true })
})

// 卡片唯一键（hash 不下发，用业务字段组合 + 序号兜底）
function cardKey(row: StrategyItem, idx: number) {
  return `${row.stockNumber}|${row.period}|${row.direct}|${idx}`
}
function isCardExpanded(row: StrategyItem, idx: number) {
  return expandedCards.value.has(cardKey(row, idx))
}
function toggleCard(row: StrategyItem, idx: number) {
  const key = cardKey(row, idx)
  const next = new Set(expandedCards.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedCards.value = next
}

// 默认排序：普通用户按股票代码正序；VIP/超管按分析分数倒序
function defaultSort() {
  return canSeeAll.value
    ? { by: 'analyzeScore', order: 'desc' as const }
    : { by: 'stockNumber', order: 'asc' as const }
}
const sortBy = ref(defaultSort().by)
const sortOrder = ref<'asc' | 'desc'>(defaultSort().order)

// 应用默认筛选：最新分析时间 + 默认排序
function applyDefaultFilters() {
  const d = defaultSort()
  sortBy.value = d.by
  sortOrder.value = d.order
  filters.dates = dates.value.length ? [dates.value[dates.value.length - 1]] : []
}

function buildQueryUrl() {
  const p = new URLSearchParams()
  p.set('page', String(page.value))
  p.set('pageSize', String(pageSize.value))
  p.set('sortBy', sortBy.value)
  p.set('sortOrder', sortOrder.value)
  if (filters.stockNumber) p.set('stockNumber', filters.stockNumber)
  if (filters.stockName) p.set('stockName', filters.stockName)
  if (filters.direct) p.set('direct', filters.direct)
  if (filters.period) p.set('period', filters.period)
  if (filters.dates.length) p.set('tacticResolveTime', filters.dates.join(','))
  return `/api/strategy/reports?${p.toString()}`
}

async function fetchData() {
  loading.value = true
  try {
    const data = await $fetch<{
      records: StrategyItem[]
      total: number
      directs: string[]
      periods: string[]
      dates: string[]
    }>(buildQueryUrl())
    records.value = data.records
    total.value = data.total
    if (data.directs?.length) directs.value = data.directs
    if (data.periods?.length) periods.value = data.periods
    if (data.dates?.length) dates.value = data.dates
    expandedCards.value = new Set()
    return data
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '加载策略数据失败')
    return null
  } finally {
    loading.value = false
  }
}

// 首次进入：先拉可选日期，默认选中最新日期后带条件重新查询
async function initialLoad() {
  const data = await fetchData()
  if (data?.dates?.length) {
    dates.value = data.dates
    applyDefaultFilters()
    await fetchData()
  }
}

function onSearch() {
  page.value = 1
  fetchData()
}

function onReset() {
  filters.stockNumber = ''
  filters.stockName = ''
  filters.direct = ''
  filters.period = 'day'
  // 恢复默认排序 + 默认分析时间
  applyDefaultFilters()
  page.value = 1
  fetchData()
}

function onSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!order) {
    const d = defaultSort()
    sortBy.value = d.by
    sortOrder.value = d.order
  } else {
    sortBy.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
  page.value = 1
  fetchData()
}

function onPageChange(p: number) {
  page.value = p
  fetchData()
}

// 当前筛选时间（展示用）
const activeDateText = computed(() =>
  filters.dates.length ? filters.dates.join(' / ') : '全部时间'
)

// 当页统计：帮助快速把握方向分布
const stats = computed(() => {
  const buy = records.value.filter((r) => String(r.direct) === '1').length
  const sell = records.value.filter((r) => String(r.direct) === '0').length
  const scores = records.value
    .map((r) => r.analyzeScore)
    .filter((v): v is number => typeof v === 'number')
  const avg = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : null
  return { buy, sell, avg }
})

// 分析时间统一显示为 yyyy-MM-dd
const fmtDate = (s: string | null | Date | undefined) => {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const fmtNum = (v: number | null | undefined) => (v == null ? '-' : v)

// 方向信息：1 买（红 ▲）/ 0 卖（绿 ▼）/ 其他中性
function dirInfo(v: string | null | undefined) {
  const s = String(v ?? '')
  if (s === '1') return { text: '买', icon: '▲', cls: 'dir-buy' }
  if (s === '0') return { text: '卖', icon: '▼', cls: 'dir-sell' }
  return { text: s || '-', icon: '', cls: 'dir-neutral' }
}
const directLabel = (v: string | null | undefined) => dirInfo(v).text

// 比例条宽度（ratio 视为 0-100）
const ratioWidth = (v: number | null | undefined) => {
  if (typeof v !== 'number') return 0
  return Math.max(0, Math.min(100, v))
}

// 表格行点击展开（点击展开图标本身时跳过，避免双触发）
const tableRef = ref()
function onRowClick(row: StrategyItem, _column: unknown, event: Event) {
  const target = event.target as HTMLElement
  if (target.closest('.el-table__expand-icon')) return
  tableRef.value?.toggleRowExpansion(row)
}

onMounted(initialLoad)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="content">
      <!-- 统计概览：一眼掌握方向分布 -->
      <section class="stats-bar" aria-label="当页统计">
        <div class="stat-card stat-buy">
          <span class="stat-label"><el-icon><Upload /></el-icon>买入信号</span>
          <span class="stat-value tabular-nums">{{ stats.buy }}</span>
          <span class="stat-sub">红色 ▲</span>
        </div>
        <div class="stat-card stat-sell">
          <span class="stat-label"><el-icon><Download /></el-icon>卖出信号</span>
          <span class="stat-value tabular-nums">{{ stats.sell }}</span>
          <span class="stat-sub">绿色 ▼</span>
        </div>
 
        <div class="stat-card stat-date">
          <span class="stat-label">分析时间</span>
          <span class="stat-date-value">{{ activeDateText }}</span>
          <span class="stat-sub">周期：{{ filters.period || '全部' }}</span>
        </div>
      </section>

      <!-- 筛选栏 -->
      <el-card shadow="never" class="filter-card">
        <!-- 移动端折叠开关 -->
        <button class="filter-toggle" type="button" @click="filterExpanded = !filterExpanded">
          <span>筛选条件</span>
          <span class="filter-toggle-state">
            {{ filterExpanded ? '收起' : '展开' }}
            <i class="toggle-arrow" :class="{ open: filterExpanded }">▾</i>
          </span>
        </button>

        <div class="filter-body" :class="{ collapsed: !filterExpanded }">
          <el-form inline class="filters" @submit.prevent="onSearch">
            <el-form-item label="股票代码">
              <el-input
                v-model="filters.stockNumber"
                placeholder="如 002578"
                clearable
                style="width: 140px"
                @keyup.enter="onSearch"
              />
            </el-form-item>
            <el-form-item label="股票名称">
              <el-input
                v-model="filters.stockName"
                placeholder="名称关键词"
                clearable
                style="width: 140px"
                @keyup.enter="onSearch"
              />
            </el-form-item>
            <el-form-item label="方向">
              <el-select v-model="filters.direct" placeholder="全部" clearable style="width: 100px">
                <el-option v-for="d in directs" :key="d" :label="directLabel(d)" :value="d" />
              </el-select>
            </el-form-item>
            <el-form-item label="周期">
              <el-select v-model="filters.period" placeholder="全部" clearable style="width: 110px">
                <el-option v-for="pd in periodOptions" :key="pd" :label="pd" :value="pd" />
              </el-select>
            </el-form-item>
            <el-form-item label="分析时间">
              <el-select
                v-model="filters.dates"
                multiple
                collapse-tags
                filterable
                placeholder="选择日期"
                clearable
                style="width: 260px"
              >
                <el-option v-for="d in dates" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
            <el-form-item class="filter-actions">
              <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
              <el-button :icon="RefreshLeft" @click="onReset">重置</el-button>
            </el-form-item>
          </el-form>
          <div v-if="!canSeeAll" class="role-hint">普通用户：仅展示基础字段，升级 VIP 可查看分析分数</div>
        </div>
      </el-card>

      <!-- ============ PC：表格视图 ============ -->
      <el-card shadow="never" class="table-card table-view">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="records"
          border
          stripe
          row-class-name="clickable-row"
          @sort-change="onSortChange"
          @row-click="onRowClick"
        >
          <el-table-column type="expand" >
            <template #default="{ row }">
              <StrategyDetail :row="row" :can-see-all="canSeeAll" />
            </template>
          </el-table-column>
          <el-table-column prop="stockNumber" label="股票" min-width="150" sortable="custom" fixed="left">
            <template #default="{ row }">
              <div class="stock-cell">
                <span class="stock-name">{{ row.stockName || '-' }}</span>
                <span class="stock-code tabular-nums">{{ row.stockNumber }}</span>
              </div>
            </template>
          </el-table-column>
           <el-table-column v-if="canSeeAll" prop="analyzeScore" label="分析分" width="104" sortable="custom" align="right">
            <template #default="{ row }">
              <span class="score-num tabular-nums">{{ fmtNum(row.analyzeScore) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="direct" label="方向" width="120" sortable="custom" align="center">
            <template #default="{ row }">
              <span class="dir-badge" :class="dirInfo(row.direct).cls">
                <i v-if="dirInfo(row.direct).icon" class="dir-icon">{{ dirInfo(row.direct).icon }}</i>
                {{ dirInfo(row.direct).text }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="开仓价" width="96" sortable="custom" align="right">
            <template #default="{ row }">
              <span class="num tabular-nums">{{ fmtNum(row.price) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="tp" label="止盈" width="86" sortable="custom" align="right">
            <template #default="{ row }">
              <span class="num num-tp tabular-nums">{{ fmtNum(row.tp) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="sl" label="止损" width="86" sortable="custom" align="right">
            <template #default="{ row }">
              <span class="num num-sl tabular-nums">{{ fmtNum(row.sl) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="ratio" label="最终比例" width="130" sortable="custom" align="right">
            <template #default="{ row }">
              <div class="ratio-cell">
                <span class="num tabular-nums">{{ fmtNum(row.ratio) }}</span>
                <span v-if="row.ratio != null" class="ratio-bar">
                  <i :style="{ width: ratioWidth(row.ratio) + '%' }" />
                </span>
              </div>
            </template>
          </el-table-column>
         
          <el-table-column prop="period" label="周期" width="84" sortable="custom" align="center">
            <template #default="{ row }">
              <span class="period-tag">{{ row.period || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="tacticResolveTime" label="分析时间" width="112" sortable="custom" align="center">
            <template #default="{ row }">
              <span class="date-text tabular-nums">{{ fmtDate(row.tacticResolveTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="详情" width="72" align="center" class-name="expand-hint-col">
            <template #default>
              <span class="expand-hint">点击行</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pager">
          <el-pagination
            background
            :layout="isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next'"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            :page-sizes="[20, 50, 100]"
            @current-change="onPageChange"
            @size-change="
              (s: number) => {
                pageSize = s
                page = 1
                fetchData()
              }
            "
          />
        </div>
      </el-card>

      <!-- ============ 移动端：卡片视图 ============ -->
      <div class="card-view" v-loading="loading">
        <p v-if="!loading && !records.length" class="empty-tip">暂无策略数据</p>

        <article
          v-for="(row, idx) in records"
          :key="cardKey(row, idx)"
          class="strategy-card"
          :class="dirInfo(row.direct).cls"
        >
          <div class="card-top">
            <div class="card-stock">
              <span class="card-name">{{ row.stockName || '-' }}</span>
              <span class="card-code tabular-nums">{{ row.stockNumber }}</span>
            </div>
            <span class="dir-badge" :class="dirInfo(row.direct).cls">
              <i v-if="dirInfo(row.direct).icon" class="dir-icon">{{ dirInfo(row.direct).icon }}</i>
              {{ dirInfo(row.direct).text }}
            </span>
          </div>

          <div class="card-metrics">
            <div class="metric">
              <span class="m-label">开仓价</span>
              <span class="m-value tabular-nums">{{ fmtNum(row.price) }}</span>
            </div>
            <div class="metric">
              <span class="m-label">止盈</span>
              <span class="m-value m-tp tabular-nums">{{ fmtNum(row.tp) }}</span>
            </div>
            <div class="metric">
              <span class="m-label">止损</span>
              <span class="m-value m-sl tabular-nums">{{ fmtNum(row.sl) }}</span>
            </div>
            <div class="metric">
              <span class="m-label">比例</span>
              <span class="m-value tabular-nums">{{ fmtNum(row.ratio) }}</span>
            </div>
          </div>

          <div class="card-foot">
            <span class="card-meta">
              <span class="period-tag">{{ row.period || '-' }}</span>
              <span class="tabular-nums">{{ fmtDate(row.tacticResolveTime) }}</span>
            </span>
            <span v-if="canSeeAll" class="card-score tabular-nums">
              评分 <b>{{ fmtNum(row.analyzeScore) }}</b>
            </span>
            <button class="card-detail-btn" type="button" @click="toggleCard(row, idx)">
              {{ isCardExpanded(row, idx) ? '收起' : '详情' }}
            </button>
          </div>

          <div v-if="isCardExpanded(row, idx)" class="card-detail">
            <StrategyDetail :row="row" :can-see-all="canSeeAll" />
          </div>
        </article>

        <div class="pager pager-mobile">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="onPageChange"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--app-bg);
}

.content {
  max-width: 1560px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

/* ============ 统计概览 ============ */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
}
.stat-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--app-text-3);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--app-text-1);
}
.stat-sub {
  font-size: 11px;
  color: var(--app-text-3);
}
.stat-buy .stat-value {
  color: var(--app-up);
}
.stat-sell .stat-value {
  color: var(--app-down);
}
.stat-score .stat-value {
  color: var(--app-gold-strong);
}
.stat-date .stat-date-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-1);
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

/* ============ 筛选栏 ============ */
.filter-card {
  margin-bottom: 14px;
}
.filter-card :deep(.el-card__body) {
  padding: 14px 16px;
}
.filter-toggle {
  display: none;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  padding: 2px 0;
  color: var(--app-text-1);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.filter-toggle-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--app-gold);
}
.toggle-arrow {
  display: inline-block;
  transition: transform 0.2s;
  font-style: normal;
}
.toggle-arrow.open {
  transform: rotate(180deg);
}
.filters {
  margin-bottom: 0;
}
.role-hint {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--app-gold-soft);
  border: 1px solid rgba(230, 172, 0, 0.25);
  color: var(--app-gold);
  font-size: 12px;
}

/* ============ 方向徽章（全局共用样式） ============ */
.dir-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  border: 1px solid transparent;
}
.dir-icon {
  font-style: normal;
  font-size: 10px;
}
.dir-badge.dir-buy {
  color: var(--app-up);
  background: var(--app-up-soft);
  border-color: rgba(240, 86, 86, 0.4);
}
.dir-badge.dir-sell {
  color: var(--app-down);
  background: var(--app-down-soft);
  border-color: rgba(46, 189, 133, 0.4);
}
.dir-badge.dir-neutral {
  color: var(--app-text-2);
  background: var(--app-surface-2);
  border-color: var(--app-border);
}

/* ============ PC 表格 ============ */
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card :deep(.el-table) {
  border-radius: var(--app-radius) var(--app-radius) 0 0;
  --el-table-border-color: var(--app-border-light);
}
.table-card :deep(.el-table .clickable-row) {
  cursor: pointer;
}
.stock-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}
.stock-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-1);
}
.stock-code {
  font-size: 12px;
  color: var(--app-text-3);
}
.num {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-1);
}
.num-tp {
  color: var(--app-up);
}
.num-sl {
  color: var(--app-down);
}
.score-num {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-gold-strong);
}
.ratio-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.ratio-bar {
  display: block;
  width: 84px;
  height: 4px;
  border-radius: 2px;
  background: var(--app-surface-3);
  overflow: hidden;
}
.ratio-bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(230, 172, 0, 0.55), var(--app-gold));
}
.period-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--app-text-2);
  background: var(--app-surface-2);
  border: 1px solid var(--app-border);
}
.date-text {
  font-size: 13px;
  color: var(--app-text-2);
}
.expand-hint {
  font-size: 11px;
  color: var(--app-text-3);
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
}

/* ============ 移动端卡片视图（默认隐藏） ============ */
.card-view {
  display: none;
}
.empty-tip {
  text-align: center;
  color: var(--app-text-3);
  padding: 40px 0;
}
.strategy-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-border);
  border-radius: 12px;
  padding: 14px 14px 12px;
  margin-bottom: 10px;
}
.strategy-card.dir-buy {
  border-left-color: var(--app-up);
}
.strategy-card.dir-sell {
  border-left-color: var(--app-down);
}
.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.card-stock {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-1);
}
.card-code {
  font-size: 12px;
  color: var(--app-text-3);
}
.card-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 4px;
  background: var(--app-bg);
  border-radius: 10px;
  text-align: center;
}
.m-label {
  font-size: 11px;
  color: var(--app-text-3);
}
.m-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text-1);
}
.m-tp {
  color: var(--app-up);
}
.m-sl {
  color: var(--app-down);
}
.card-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.card-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--app-text-3);
}
.card-score {
  margin-left: auto;
  font-size: 12px;
  color: var(--app-text-3);
}
.card-score b {
  font-size: 15px;
  color: var(--app-gold-strong);
}
.card-detail-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-surface-2);
  color: var(--app-gold);
  font-size: 12px;
  cursor: pointer;
}
.card-detail-btn:active {
  background: var(--app-gold-soft);
}
.card-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--app-border);
}
.pager-mobile {
  justify-content: center;
  padding: 8px 0 4px;
}

/* ============ 响应式断点 ============ */
@media (max-width: 768px) {
  .content {
    padding: 14px 12px 32px;
  }
  .table-view {
    display: none;
  }
  .card-view {
    display: block;
  }
  .filter-toggle {
    display: flex;
  }
  .filter-body.collapsed {
    display: none;
  }
  .filter-card :deep(.el-card__body) {
    padding: 12px 14px;
  }
  .filter-body :deep(.el-form-item) {
    width: 100%;
    margin-right: 0;
  }
  .filter-body :deep(.el-input),
  .filter-body :deep(.el-select) {
    width: 100% !important;
  }
  .filter-body :deep(.el-form-item__label) {
    color: var(--app-text-2);
  }
  .filter-actions :deep(.el-button) {
    flex: 1;
  }
  .filter-actions {
    display: flex;
    gap: 10px;
  }
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .stat-card {
    padding: 10px 12px;
  }
  .stat-value {
    font-size: 21px;
  }
}
</style>
