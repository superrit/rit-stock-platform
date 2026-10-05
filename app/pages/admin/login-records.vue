<script setup lang="ts">
import { ElMessage } from 'element-plus'

definePageMeta({ middleware: 'admin', layout: 'default' })

interface LoginRecord {
  id: number
  phone: string
  ip: string | null
  device: string | null
  login_at: string
}

const loading = ref(false)
const records = ref<LoginRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const formatTime = (s: string) => (s ? new Date(s).toLocaleString('zh-CN') : '-')

async function fetchData() {
  loading.value = true
  try {
    const data = await $fetch<{ records: LoginRecord[]; total: number }>(
      `/api/login-records?page=${page.value}&pageSize=${pageSize.value}`
    )
    records.value = data.records
    total.value = data.total
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '加载登录记录失败')
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
      <el-card shadow="never">
        <div class="toolbar">
          <span class="title">登录记录（保留 6 个月）</span>
        </div>

        <el-table v-loading="loading" :data="records" border stripe>
          <el-table-column prop="phone" label="手机号" width="140" />
          <el-table-column prop="ip" label="IP" width="150">
            <template #default="{ row }">{{ row.ip || '-' }}</template>
          </el-table-column>
          <el-table-column label="设备" min-width="220">
            <template #default="{ row }">{{ row.device || '-' }}</template>
          </el-table-column>
          <el-table-column label="登录时间" width="180">
            <template #default="{ row }">{{ formatTime(row.login_at) }}</template>
          </el-table-column>
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
  background: #f5f7fa;
}
.content {
  max-width: 1080px;
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
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
