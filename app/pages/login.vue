<script setup lang="ts">
import { ElMessage } from 'element-plus'

definePageMeta({ middleware: 'guest', layout: 'default' })

const { login, changePassword } = useAuth()
const router = useRouter()
const route = useRoute()

// 阶段：login = 登录；change = 强制改密
const stage = ref<'login' | 'change'>('login')
const loading = ref(false)

// 登录表单
const loginForm = reactive({ phone: '', password: '' })

// 改密表单
const changeToken = ref('')
const changeForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const rules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '新密码长度需为 6-20 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (err?: Error) => void) => {
        if (value !== changeForm.newPassword) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

async function onLogin() {
  loading.value = true
  try {
    const res = await login(loginForm.phone, loginForm.password)
    if (res.needChangePassword) {
      // 进入强制改密
      changeToken.value = res.changePasswordToken
      changeForm.oldPassword = loginForm.password
      changeForm.newPassword = ''
      changeForm.confirmPassword = ''
      stage.value = 'change'
      ElMessage.warning('首次登录，请先修改密码')
    } else {
      ElMessage.success('登录成功')
      router.push((route.query.redirect as string) || '/')
    }
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '登录失败，请重试')
  } finally {
    loading.value = false
  }
}

async function onChangePassword() {
  if (changeForm.newPassword !== changeForm.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    await changePassword(changeToken.value, changeForm.oldPassword, changeForm.newPassword)
    ElMessage.success('密码修改成功，已登录')
    router.push('/')
  } catch (err: any) {
    ElMessage.error(err?.data?.message || '修改密码失败')
  } finally {
    loading.value = false
  }
}

function backToLogin() {
  stage.value = 'login'
  loginForm.password = ''
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <h1 class="brand-title">RIT 股票量化交易平台</h1>
        <p class="brand-sub">登录以进入您的量化工作台</p>
      </div>

      <!-- 登录阶段 -->
      <el-form
        v-if="stage === 'login'"
        :model="loginForm"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="onLogin"
      >
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="loginForm.phone" placeholder="请输入手机号" maxlength="11" clearable />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码（首次登录为手机号后 6 位）"
            show-password
            @keyup.enter="onLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="loading"
          @click="onLogin"
        >
          登 录
        </el-button>
      </el-form>

      <!-- 强制改密阶段 -->
      <el-form
        v-else
        :model="changeForm"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="onChangePassword"
      >
        <el-alert
          title="首次登录需修改密码后才能继续使用"
          type="warning"
          :closable="false"
          show-icon
          class="mb"
        />
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="changeForm.oldPassword"
            type="password"
            placeholder="请输入原密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="changeForm.newPassword"
            type="password"
            placeholder="6-20 位新密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="changeForm.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            show-password
            @keyup.enter="onChangePassword"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="loading"
          @click="onChangePassword"
        >
          修改密码并登录
        </el-button>
        <el-button text class="back-btn" @click="backToLogin">返回登录</el-button>
      </el-form>

      <div class="hint">
        <p>演示账号（默认密码 = 手机号后 6 位，首次登录需改密）：</p>
        <p>超级管理员 13800000000 · 普通用户 13800000001</p>
        <p>VIP 用户 13800000002 · 过期 VIP 13800000003</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
  padding: 24px;
}
.login-card {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.brand {
  text-align: center;
  margin-bottom: 24px;
}
.brand-title {
  font-size: 20px;
  color: #1f2937;
  margin: 0 0 8px;
}
.brand-sub {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}
.submit-btn {
  width: 100%;
  margin-top: 8px;
}
.back-btn {
  width: 100%;
  margin-top: 4px;
}
.mb {
  margin-bottom: 16px;
}
.hint {
  margin-top: 20px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.7;
}
.hint p {
  margin: 2px 0;
}
</style>
