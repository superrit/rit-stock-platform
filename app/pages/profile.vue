<script setup lang="ts">
import { User } from '@element-plus/icons-vue'

definePageMeta({ middleware: 'auth', layout: 'default' })

const { user, fetchMe } = useAuth()

onMounted(async () => {
  if (!user.value) await fetchMe()
})

const roleLabel = computed(() => (user.value ? roleLabels[user.value.role] : ''))

const maskedPhone = computed(() => {
  const p = user.value?.phone
  if (!p || p.length < 7) return p || ''
  return `${p.slice(0, 3)}****${p.slice(-4)}`
})

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

// VIP 剩余进度（以 365 天为满刻度做可视化）
const vipProgress = computed(() => {
  const days = user.value?.vipRemainingDays
  if (!user.value?.isVip || days == null) return 0
  return Math.max(2, Math.min(100, Math.round((days / 365) * 100)))
})

// 提示文案：按身份区分
const vipNote = computed(() => {
  if (user.value?.isVip) return 'VIP 有效期内可查看分析分数等增强字段'
  if (user.value?.role === 'super_admin') return '超级管理员可查看分析分数等增强字段'
  return '当前为普通用户，仅可查看策略基础字段；升级 VIP 后可查看分析分数'
})
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="content">
      <div class="profile-card">
        <!-- 头部：头像 + 身份 -->
        <div class="profile-head">
          <span class="avatar-ring">
            <span class="avatar">
              <el-icon :size="26"><User /></el-icon>
            </span>
          </span>
          <div class="head-meta">
            <span class="phone tabular-nums">{{ maskedPhone }}</span>
            <span class="role-badge" :class="`role-${user?.role}`">
              {{ roleLabel || '-' }}
            </span>
          </div>
        </div>

        <!-- 信息列表 -->
        <dl class="info-list">
          <div class="info-row">
            <dt>VIP 状态</dt>
            <dd>
              <template v-if="user?.isVip">
                <span class="vip-text">VIP 生效中 · {{ vipRemainText }}</span>
              </template>
              <template v-else>
                <span class="muted">{{ vipRemainText }}</span>
              </template>
            </dd>
          </div>
          <div v-if="user?.isVip" class="info-row info-row-progress">
            <dt>有效期</dt>
            <dd class="progress-cell">
              <span class="vip-date tabular-nums">{{ vipExpireText }}</span>
              <span class="vip-progress">
                <i :style="{ width: vipProgress + '%' }" />
              </span>
            </dd>
          </div>
          <div v-if="user?.isVip" class="vip-note">{{ vipNote }}</div>
          <div v-else class="vip-note">{{ vipNote }}</div>
        </dl>
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
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 16px 40px;
}

.profile-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 32px 28px 26px;
  box-shadow: var(--app-shadow);
  position: relative;
  overflow: hidden;
}
/* 顶部金线 */
.profile-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--app-gold), transparent);
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--app-border-light);
  margin-bottom: 8px;
}
.avatar-ring {
  display: inline-flex;
  padding: 3px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffd75e, var(--app-gold) 60%, #8a6800);
}
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--app-surface);
  color: var(--app-gold);
}
.head-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.phone {
  font-size: 20px;
  font-weight: 700;
  color: var(--app-text-1);
}
.role-badge {
  align-self: flex-start;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--app-border);
  color: var(--app-text-2);
  background: var(--app-surface-2);
}
.role-badge.role-super_admin {
  color: #f37878;
  border-color: rgba(240, 86, 86, 0.4);
  background: var(--app-up-soft);
}
.role-badge.role-vip {
  color: var(--app-gold);
  border-color: rgba(230, 172, 0, 0.4);
  background: var(--app-gold-soft);
}

.info-list {
  margin: 0;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 2px;
  border-bottom: 1px solid var(--app-border-light);
}
.info-row dt {
  font-size: 14px;
  color: var(--app-text-3);
  flex-shrink: 0;
}
.info-row dd {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-1);
}
.vip-text {
  color: var(--app-gold-strong);
  font-weight: 600;
}
.muted {
  color: var(--app-text-3);
}
.progress-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
}
.vip-date {
  font-size: 13px;
  color: var(--app-text-2);
}
.vip-progress {
  display: block;
  width: 160px;
  height: 5px;
  border-radius: 3px;
  background: var(--app-surface-3);
  overflow: hidden;
}
.vip-progress i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(230, 172, 0, 0.5), var(--app-gold));
}
.vip-note {
  padding: 12px 12px 2px;
  font-size: 12px;
  color: var(--app-text-3);
  line-height: 1.6;
}

@media (max-width: 480px) {
  .profile-card {
    padding: 26px 18px 20px;
  }
  .phone {
    font-size: 18px;
  }
}
</style>
