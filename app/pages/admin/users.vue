<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAdminUsers, vipDurationOptions } from '~/composables/useAdminUsers'
import type { AdminUser } from '~/composables/useAdminUsers'

definePageMeta({ middleware: 'admin', layout: 'default' })

const { list, create, updateRemark, extendVip, remove } = useAdminUsers()

const loading = ref(false)
const users = ref<AdminUser[]>([])

// 新增用户弹窗
const createVisible = ref(false)
const createForm = reactive({ phone: '', remark: '' })

// 编辑弹窗
const editVisible = ref(false)
const editTarget = ref<AdminUser | null>(null)
const editRemark = ref('')

const roleTagType = (u: AdminUser) =>
  u.effectiveRole === 'super_admin' ? 'danger' : u.effectiveRole === 'vip' ? 'warning' : 'info'

const roleLabel = (u: AdminUser) =>
  u.effectiveRole === 'super_admin' ? '超级管理员' : u.effectiveRole === 'vip' ? 'VIP 用户' : '普通用户'

const vipText = (u: AdminUser) => {
  if (u.isVip) {
    const expire = u.vipExpireAt ? new Date(u.vipExpireAt).toLocaleString('zh-CN') : '-'
    const days = u.vipRemainingDays != null ? `剩余 ${u.vipRemainingDays} 天` : ''
    return `${expire} ${days}`.trim()
  }
  return '非 VIP'
}

const formatTime = (s: string) => (s ? new Date(s).toLocaleString('zh-CN') : '-')

async function refresh() {
  loading.value = true
  try {
    users.value = await list()
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '加载用户列表失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  createForm.phone = ''
  createForm.remark = ''
  createVisible.value = true
}

async function submitCreate() {
  if (!/^1[3-9]\d{9}$/.test(createForm.phone)) {
    ElMessage.error('请输入正确的手机号')
    return
  }
  try {
    await create(createForm.phone, createForm.remark)
    ElMessage.success('用户创建成功（默认密码为手机号后 6 位）')
    createVisible.value = false
    await refresh()
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '创建用户失败')
  }
}

function openEdit(u: AdminUser) {
  editTarget.value = u
  editRemark.value = u.remark ?? ''
  editVisible.value = true
}

async function saveRemark() {
  if (!editTarget.value) return
  try {
    await updateRemark(editTarget.value.id, editRemark.value)
    ElMessage.success('备注已更新')
    editVisible.value = false
    await refresh()
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '更新备注失败')
  }
}

async function onExtendVip(u: AdminUser, label: string, duration: string) {
  try {
    await ElMessageBox.confirm(
      `确认为用户 ${u.phone} 续期 VIP ${label}？`,
      '续期确认',
      { confirmButtonText: '确认续期', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }
  try {
    await extendVip(u.id, duration)
    ElMessage.success(`已为用户 ${u.phone} 续期 ${label} VIP`)
    await refresh()
    if (editVisible.value) {
      const updated = users.value.find((x) => x.id === u.id)
      if (updated) editTarget.value = updated
    }
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '续期失败')
  }
}

async function onDelete(u: AdminUser) {
  try {
    await ElMessageBox.confirm(
      `确认删除用户 ${u.phone}？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' }
    )
  } catch {
    return
  }
  try {
    await remove(u.id)
    ElMessage.success('用户已删除')
    await refresh()
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '删除失败')
  }
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="content">
      <el-card shadow="never">
        <div class="toolbar">
          <span class="title">用户管理</span>
          <el-button type="primary" @click="openCreate">新增用户</el-button>
        </div>

        <el-table v-loading="loading" :data="users" border stripe>
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column label="身份" width="120">
            <template #default="{ row }">
              <el-tag :type="roleTagType(row)" effect="dark">{{ roleLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="140">
            <template #default="{ row }">{{ row.remark || '—' }}</template>
          </el-table-column>
          <el-table-column label="VIP 状态" min-width="200">
            <template #default="{ row }">
              <el-tag v-if="row.isVip" type="success" effect="plain">{{ vipText(row) }}</el-tag>
              <span v-else class="muted">{{ vipText(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.mustChangePassword" type="warning" effect="plain">待改密</el-tag>
              <el-tag v-else type="info" effect="plain">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </main>

    <!-- 新增用户弹窗 -->
    <el-dialog v-model="createVisible" title="新增用户" width="420px">
      <el-form label-position="top">
        <el-form-item label="手机号（必填）" required>
          <el-input v-model="createForm.phone" placeholder="请输入手机号" maxlength="11" clearable />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" placeholder="选填" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑用户" width="480px">
      <template v-if="editTarget">
        <el-descriptions :column="1" border class="mb">
          <el-descriptions-item label="手机号">{{ editTarget.phone }}</el-descriptions-item>
          <el-descriptions-item label="VIP 状态">{{ vipText(editTarget) }}</el-descriptions-item>
        </el-descriptions>

        <el-form label-position="top">
          <el-form-item label="备注">
            <el-input v-model="editRemark" type="textarea" :rows="2" placeholder="备注" maxlength="255" />
          </el-form-item>
        </el-form>

        <div class="vip-actions">
          <span class="vip-label">VIP 有效期续期：</span>
          <el-button
            v-for="opt in vipDurationOptions"
            :key="opt.duration"
            type="warning"
            plain
            size="small"
            @click="onExtendVip(editTarget, opt.label, opt.duration)"
          >
            {{ opt.label }}
          </el-button>
        </div>
      </template>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRemark">保存备注</el-button>
      </template>
    </el-dialog>
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
.muted {
  color: #9ca3af;
  font-size: 13px;
}
.mb {
  margin-bottom: 16px;
}
.vip-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.vip-label {
  font-size: 14px;
  color: #374151;
}
</style>
