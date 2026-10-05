<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { Menu, User, ArrowRight, SwitchButton } from '@element-plus/icons-vue'

const { user, logout } = useAuth()
const route = useRoute()

const roleLabel = computed(() => (user.value ? roleLabels[user.value.role] : ''))

// 手机号脱敏展示：138****0000
const maskedPhone = computed(() => {
  const p = user.value?.phone
  if (!p || p.length < 7) return p || ''
  return `${p.slice(0, 3)}****${p.slice(-4)}`
})

const navItems = computed(() => {
  const items = [
    { to: '/', label: '策略查看' },
    { to: '/profile', label: '个人中心' }
  ]
  if (user.value?.role === 'super_admin') {
    items.push(
      { to: '/admin/users', label: '用户管理' },
      { to: '/admin/login-records', label: '登录记录' },
      { to: '/admin/vip-records', label: 'VIP 记录' }
    )
  }
  return items
})

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

const drawerVisible = ref(false)

// 切换路由后自动收起抽屉
watch(
  () => route.fullPath,
  () => {
    drawerVisible.value = false
  }
)

async function onLogout() {
  drawerVisible.value = false
  await logout()
  ElMessage.success('已退出登录')
}
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <!-- 移动端：汉堡菜单 -->
      <button class="menu-btn" type="button" aria-label="打开导航菜单" @click="drawerVisible = true">
        <el-icon :size="20"><Menu /></el-icon>
      </button>

      <NuxtLink to="/" class="brand">
        <img src="/logo.png" alt="logo" class="logo-img" />
        <span class="logo-text">股票量化交易平台</span>
      </NuxtLink>

      <!-- 桌面端水平导航 -->
      <nav class="nav-desktop" aria-label="主导航">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: isActive(item.to) }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="right">
        <div v-if="user" class="user-chip">
          <span class="avatar" aria-hidden="true">
            <el-icon :size="15"><User /></el-icon>
          </span>
          <span class="user-meta">
            <span class="user-phone">{{ maskedPhone }}</span>
            <span class="user-role" :class="`role-${user.role}`">{{ roleLabel }}</span>
          </span>
        </div>
        <el-button class="logout-btn" size="small" :icon="SwitchButton" @click="onLogout">
          退出
        </el-button>
      </div>
    </div>
  </header>

  <!-- 移动端抽屉导航 -->
  <el-drawer
    v-model="drawerVisible"
    direction="ltr"
    size="76%"
    :with-header="false"
    class="mobile-nav-drawer"
  >
    <div class="drawer-body">
      <NuxtLink to="/" class="drawer-brand" @click="drawerVisible = false">
        <img src="/logo.png" alt="logo" />
        <span>股票量化交易平台</span>
      </NuxtLink>

      <div v-if="user" class="drawer-user">
        <span class="avatar avatar-lg" aria-hidden="true">
          <el-icon :size="20"><User /></el-icon>
        </span>
        <div class="drawer-user-meta">
          <span class="drawer-phone">{{ maskedPhone }}</span>
          <span class="user-role" :class="`role-${user.role}`">{{ roleLabel }}</span>
        </div>
      </div>

      <nav class="drawer-nav" aria-label="移动端导航">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="drawer-link"
          :class="{ active: isActive(item.to) }"
          @click="drawerVisible = false"
        >
          <span>{{ item.label }}</span>
          <el-icon class="arrow"><ArrowRight /></el-icon>
        </NuxtLink>
      </nav>

      <el-button class="drawer-logout" :icon="SwitchButton" @click="onLogout">退出登录</el-button>
    </div>
  </el-drawer>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(11, 14, 20, 0.86);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--app-border);
}

.header-inner {
  height: 60px;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}

/* 汉堡按钮：仅移动端显示 */
.menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
  color: var(--app-text-2);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s, border-color 0.2s;
}
.menu-btn:hover {
  color: var(--app-gold);
  border-color: var(--app-gold);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.logo-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: 8px;
}
.logo-text {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: linear-gradient(120deg, #ffd75e 0%, var(--app-gold) 55%, #c99400 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 桌面导航 */
.nav-desktop {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-desktop::-webkit-scrollbar {
  display: none;
}
.nav-link {
  padding: 7px 14px;
  border-radius: 8px;
  color: var(--app-text-2);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: color 0.18s, background-color 0.18s, border-color 0.18s;
}
.nav-link:hover {
  color: var(--app-gold);
  background: var(--app-gold-soft);
}
.nav-link.active {
  color: var(--app-gold);
  background: var(--app-gold-soft);
  border-color: rgba(230, 172, 0, 0.35);
  font-weight: 600;
}

/* 右侧用户区 */
.right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-left: auto;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-surface);
}
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f2c94c, var(--app-gold) 70%);
  color: #171205;
  flex-shrink: 0;
}
.avatar-lg {
  width: 44px;
  height: 44px;
}
.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.user-phone {
  font-size: 13px;
  color: var(--app-text-1);
  font-variant-numeric: tabular-nums;
}
.user-role {
  font-size: 11px;
  color: var(--app-text-3);
}
.user-role.role-super_admin {
  color: #f37878;
}
.user-role.role-vip {
  color: var(--app-gold);
}
.logout-btn {
  flex-shrink: 0;
}

/* ---------- 抽屉 ---------- */
.drawer-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 16px;
  box-sizing: border-box;
  gap: 18px;
}
.drawer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  padding: 0 6px;
}
.drawer-brand img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}
.drawer-brand span {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(120deg, #ffd75e, var(--app-gold) 60%, #c99400);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.drawer-user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-surface);
}
.drawer-user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.drawer-phone {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-1);
  font-variant-numeric: tabular-nums;
}
.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
}
.drawer-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  color: var(--app-text-2);
  text-decoration: none;
  font-size: 15px;
  transition: all 0.18s;
}
.drawer-link .arrow {
  opacity: 0;
  transition: opacity 0.18s;
}
.drawer-link:hover,
.drawer-link.active {
  color: var(--app-gold);
  background: var(--app-gold-soft);
  border-color: rgba(230, 172, 0, 0.3);
}
.drawer-link.active {
  font-weight: 600;
}
.drawer-link.active .arrow,
.drawer-link:hover .arrow {
  opacity: 1;
}
.drawer-logout {
  width: 100%;
}

/* ---------- 移动端 ---------- */
@media (max-width: 768px) {
  .menu-btn {
    display: inline-flex;
  }
  .nav-desktop {
    display: none;
  }
  .header-inner {
    padding: 0 12px;
    gap: 10px;
  }
  .logo-text {
    font-size: 15px;
  }
  .user-meta {
    display: none;
  }
  .user-chip {
    padding: 3px;
  }
  .logout-btn {
    padding: 8px 10px;
  }
}
</style>
