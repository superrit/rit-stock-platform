<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'default' })

const { user, fetchMe } = useAuth()

onMounted(async () => {
  if (!user.value) await fetchMe()
})

const roleLabel = computed(() => (user.value ? roleLabels[user.value.role] : ''))

const vipRemainText = computed(() => {
  if (!user.value) return '-'
  if (user.value.isVip && user.value.vipRemainingDays != null) {
    return `剩余 ${user.value.vipRemainingDays} 天`
  }
  return '非 VIP'
})

const vipExpireText = computed(() => {
  if (!user.value?.vipExpireAt) return '-'
  return new Date(user.value.vipExpireAt).toLocaleString('zh-CN')
})
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="content">
      <el-card class="card" shadow="hover">
        <template #header><span>个人信息</span></template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="手机号">{{ user?.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="身份">
            <el-tag v-if="user" :type="user.role === 'super_admin' ? 'danger' : user.role === 'vip' ? 'warning' : 'info'" effect="dark">
              {{ roleLabel }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="VIP 状态">{{ vipRemainText }}</el-descriptions-item>
          <el-descriptions-item v-if="user?.isVip" label="VIP 到期时间">{{ vipExpireText }}</el-descriptions-item>
        </el-descriptions>
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
  max-width: 720px;
  margin: 24px auto;
  padding: 0 16px;
}
</style>
