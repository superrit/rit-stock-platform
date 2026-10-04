<script setup lang="ts">
import { ElMessage } from 'element-plus'

definePageMeta({ middleware: 'auth', layout: 'default' })

const { user, fetchMe, logout } = useAuth()

// 兜底：确保客户端拿到最新用户信息
onMounted(async () => {
  if (!user.value) {
    await fetchMe()
  }
})

const roleTagType = computed(() => {
  switch (user.value?.role) {
    case 'super_admin':
      return 'danger'
    case 'vip':
      return 'warning'
    default:
      return 'info'
  }
})

const roleLabel = computed(() => {
  if (!user.value) return ''
  return roleLabels[user.value.role]
})

const vipExpireText = computed(() => {
  if (!user.value?.vipExpireAt) return ''
  const d = new Date(user.value.vipExpireAt)
  return d.toLocaleString('zh-CN')
})

async function onLogout() {
  await logout()
  ElMessage.success('已退出登录')
}
</script>

<template>
  <div class="dashboard">
    <header class="topbar">
      <span class="logo">RIT 股票量化交易平台</span>
      <el-button type="danger" plain @click="onLogout">退出登录</el-button>
    </header>

    <main class="content">
      <el-card class="profile" shadow="hover">
        <template #header>
          <span>账户信息</span>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="手机号">
            {{ user?.phone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="身份">
            <el-tag v-if="user" :type="roleTagType" effect="dark">{{ roleLabel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="user?.role === 'vip'" label="VIP 到期时间">
            {{ vipExpireText }}
          </el-descriptions-item>
          <el-descriptions-item label="登录方式">
            手机号 + 密码 · 单设备登录 · 有效期 1 天
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="todo" shadow="never">
        <template #header>
          <span>下一步待办（量化平台骨架）</span>
        </template>
        <ul class="todo-list">
          <li>✅ 用户登录 / 强制改密 / JWT + Redis 单设备会话</li>
          <li>⏳ 行情数据接入（A 股实时行情）</li>
          <li>⏳ 策略回测引擎</li>
          <li>⏳ 账户 / 持仓 / 交易模块</li>
        </ul>
      </el-card>
    </main>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f5f7fa;
}
.topbar {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.logo {
  font-size: 16px;
  font-weight: 600;
  color: #1e3a8a;
}
.content {
  max-width: 720px;
  margin: 24px auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.todo-list {
  margin: 0;
  padding-left: 18px;
  color: #374151;
  line-height: 2;
}
</style>
