<script setup lang="ts">
import { ElMessage } from 'element-plus'

const { user, logout } = useAuth()
const route = useRoute()

const roleLabel = computed(() => (user.value ? roleLabels[user.value.role] : ''))

async function onLogout() {
  await logout()
  ElMessage.success('已退出登录')
}
</script>

<template>
  <header class="app-header">
    <NuxtLink to="/" class="logo">股票量化交易平台</NuxtLink>

    <nav class="nav">
      <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">首页</NuxtLink>
      <NuxtLink to="/profile" class="nav-link" :class="{ active: route.path === '/profile' }">个人中心</NuxtLink>
      <NuxtLink
        v-if="user?.role === 'super_admin'"
        to="/admin/users"
        class="nav-link"
        :class="{ active: route.path.startsWith('/admin/users') }"
      >
        用户管理
      </NuxtLink>
    </nav>

    <div class="right">
      <span class="user-info">{{ user?.phone }}<span v-if="roleLabel"> · {{ roleLabel }}</span></span>
      <el-button type="danger" plain size="small" @click="onLogout">退出登录</el-button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 24px;
}
.logo {
  font-size: 16px;
  font-weight: 600;
  color: #1e3a8a;
  text-decoration: none;
  white-space: nowrap;
}
.nav {
  display: flex;
  gap: 8px;
  flex: 1;
}
.nav-link {
  padding: 6px 14px;
  border-radius: 6px;
  color: #374151;
  text-decoration: none;
  font-size: 14px;
}
.nav-link:hover {
  background: #f3f4f6;
}
.nav-link.active {
  color: #1e3a8a;
  background: #eff6ff;
  font-weight: 600;
}
.right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-info {
  font-size: 13px;
  color: #6b7280;
}
</style>
