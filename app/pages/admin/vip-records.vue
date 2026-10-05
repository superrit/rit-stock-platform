<script setup lang="ts">
import { ElMessage } from 'element-plus'

definePageMeta({ middleware: 'admin', layout: 'default' })

interface VipRecord {
  id: number
  operator_phone: string
  target_phone: string
  duration: string
  months: number
  operated_at: string
}

const loading = ref(false)
const records = ref<VipRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const formatTime = (s: string) => (s ? new Date(s).toLocaleString('zh-CN') : '-')

async function fetchData() {
  loading.value = true
  try {
    const data = await $fetch<{ records: VipRecord[]; total: number }>(
      `/api/vip-records?page=${page.value}&pageSize=${pageSize.value}`
    )
    records.value = data.records
    total.value = data.total
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '加载 VIP 操作记录失败')
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  fetchData()
}

onMounted(fetchData)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="content">
      <el-card shadow="never" class="panel-card">
        <div class="toolbar">
          <div class="toolbar-title">
            <span class="title">VIP 续期操作记录</span>
            <span class="subtitle">共 {{ total }} 条</span>
          </div>
        </div>

        <el-table v-loading="loading" :data="records" border stripe>
          <el-table-column label="操作时间" width="180">
            <template #default="{ row }">{{ formatTime(row.operated_at) }}</template>
          </el-table-column>
          <el-table-column prop="duration" label="延长类型" width="120" />
          <el-table-column prop="operator_phone" label="操作人手机号" width="140" />
          <el-table-column prop="target_phone" label="被修改人手机号" width="140" />
        </el-table>

        <div class="pager">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="onPageChange"
          />
        </div>
      </el-card>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--app-bg);
}
.content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}
.panel-card {
  border-radius: var(--app-radius);
}
.panel-card :deep(.el-card__body) {
  padding: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-1);
}
.subtitle {
  font-size: 12px;
  color: var(--app-text-3);
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
@media (max-width: 768px) {
  .content {
    padding: 14px 10px 32px;
  }
  .panel-card :deep(.el-card__body) {
    padding: 12px 10px;
  }
  .pager {
    justify-content: center;
  }
}
</style>
