<script setup lang="ts">
import { ElMessage } from 'element-plus'

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

// 筛选条件（周期默认 day）
const filters = reactive({
  stockNumber: '',
  stockName: '',
  direct: '',
  period: 'day',
  dateRange: null as [string, string] | null
})

// 周期下拉选项（确保 day 始终存在）
const periodOptions = computed(() => Array.from(new Set(['day', ...periods.value])))

// 排序（服务端排序）
const sortBy = ref('tacticResolveTime')
const sortOrder = ref<'asc' | 'desc'>('desc')

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
  if (filters.dateRange?.[0]) p.set('tacticResolveTimeFrom', filters.dateRange[0])
  if (filters.dateRange?.[1]) p.set('tacticResolveTimeTo', filters.dateRange[1])
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
    }>(buildQueryUrl())
    records.value = data.records
    total.value = data.total
    if (data.directs?.length) directs.value = data.directs
    if (data.periods?.length) periods.value = data.periods
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '加载策略数据失败')
  } finally {
    loading.value = false
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
  filters.dateRange = null
  onSearch()
}

function onSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!order) {
    sortBy.value = 'tacticResolveTime'
    sortOrder.value = 'desc'
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

// JSON 字段：折叠为单行紧凑文本，单元格内省略展示、悬浮看全文
function compactJson(s: string | null | undefined): string {
  if (!s) return '-'
  try {
    return JSON.stringify(JSON.parse(s))
  } catch {
    return s
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="content">
      <el-card shadow="never">
        <div class="toolbar">
          <span class="title">策略查看</span>
          <el-tag v-if="!canSeeAll" type="info" effect="plain">普通用户：仅展示基础字段</el-tag>
          <el-tag v-else type="warning" effect="plain">可见全部字段</el-tag>
        </div>

        <!-- 筛选栏 -->
        <el-form inline class="filters" @submit.prevent="onSearch">
          <el-form-item label="股票代码">
            <el-input v-model="filters.stockNumber" placeholder="如 002578" clearable style="width: 140px"
              @keyup.enter="onSearch" />
          </el-form-item>
          <el-form-item label="股票名称">
            <el-input v-model="filters.stockName" placeholder="名称关键词" clearable style="width: 140px"
              @keyup.enter="onSearch" />
          </el-form-item>
          <el-form-item label="方向">
            <el-select v-model="filters.direct" placeholder="全部" clearable style="width: 100px">
              <el-option v-for="d in directs" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="周期">
            <el-select v-model="filters.period" placeholder="全部" clearable style="width: 110px">
              <el-option v-for="pd in periodOptions" :key="pd" :label="pd" :value="pd" />
            </el-select>
          </el-form-item>
          <el-form-item label="分析时间">
            <el-date-picker v-model="filters.dateRange" type="daterange" range-separator="至" start-placeholder="开始日期"
              end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 240px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSearch">查询</el-button>
            <el-button @click="onReset">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 数据表：全部字段平铺，非 JSON 字段可点击列头排序 -->
        <el-table v-loading="loading" :data="records" border stripe @sort-change="onSortChange">
          <el-table-column prop="stockNumber" label="股票代码" width="110" sortable="custom" fixed="left" />
          <el-table-column prop="stockName" label="股票名称" min-width="90" sortable="custom" show-overflow-tooltip />
          <el-table-column prop="period" label="周期" width="80" sortable="custom" />
          <el-table-column prop="tacticResolveTime" label="分析时间" width="110" sortable="custom">
            <template #default="{ row }">{{ fmtDate(row.tacticResolveTime) }}</template>
          </el-table-column>
          <el-table-column v-if="canSeeAll" prop="analyzeScore" label="分析分数" width="90" sortable="custom" />
          <el-table-column prop="direct" label="方向" width="66" sortable="custom" />
          <el-table-column prop="price" label="开仓价" width="82" sortable="custom" />
          <el-table-column prop="tp" label="止盈" width="76" sortable="custom" />
          <el-table-column prop="sl" label="止损" width="76" sortable="custom" />
          <el-table-column prop="pl" label="平保" width="76" sortable="custom" />
          <el-table-column prop="ratio" label="最终比例" width="88" sortable="custom" />
          <el-table-column prop="total" label="订单数" width="90" sortable="custom" />
          <el-table-column prop="BSP" label="保守进场价" width="100" sortable="custom" />
          <el-table-column prop="JXP" label="极限进场价" width="100" sortable="custom" />
          <el-table-column label="统计结果(result)" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ compactJson(row.result) }}</template>
          </el-table-column>
          <el-table-column label="统计结果(CalcCha)" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ compactJson(row.CalcCha) }}</template>
          </el-table-column>
          <el-table-column v-if="canSeeAll" label="分数详情(scoreDetail)" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ compactJson(row.scoreDetail) }}</template>
          </el-table-column>
        </el-table>

        <div class="pager">
          <el-pagination background layout="total, sizes, prev, pager, next" :total="total" :page-size="pageSize"
            :current-page="page" :page-sizes="[20, 50, 100]" @current-change="onPageChange"
            @size-change="(s: number) => { pageSize = s; page = 1; fetchData() }" />
        </div>
      </el-card>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
}

.content {
  max-width: 1560px;
  margin: 24px auto;
  padding: 0 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.filters {
  margin-bottom: 8px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
