<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

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
    <!-- 背景装饰：网格 + 光晕 + 顶部金线 -->
    <div class="bg-grid" aria-hidden="true"></div>
    <div class="bg-glow bg-glow-1" aria-hidden="true"></div>
    <div class="bg-glow bg-glow-2" aria-hidden="true"></div>

    <div class="login-card">
      <div class="brand">
        <img src="/logo.png" alt="logo" class="brand-logo" />
        <h1 class="brand-title">股票量化交易平台</h1>
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
          <el-input
            v-model="loginForm.phone"
            placeholder="请输入手机号"
            maxlength="11"
            clearable
            :prefix-icon="User"
            inputmode="numeric"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码（首次登录为手机号后 6 位）"
            show-password
            :prefix-icon="Lock"
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
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="changeForm.newPassword"
            type="password"
            placeholder="6-20 位新密码"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="changeForm.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            show-password
            :prefix-icon="Lock"
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
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg);
  padding: 24px;
  overflow: hidden;
}

/* 网格底纹（金融图表意象） */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 45%, #000 25%, transparent 78%);
  mask-image: radial-gradient(ellipse 80% 70% at 50% 45%, #000 25%, transparent 78%);
  pointer-events: none;
}

/* 金色光晕 */
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
}
.bg-glow-1 {
  width: 560px;
  height: 560px;
  top: -220px;
  right: -140px;
  background: rgba(230, 172, 0, 0.09);
}
.bg-glow-2 {
  width: 480px;
  height: 480px;
  bottom: -200px;
  left: -160px;
  background: rgba(230, 172, 0, 0.06);
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 410px;
  background: rgba(19, 23, 34, 0.88);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--app-border);
  border-radius: 18px;
  padding: 40px 34px 32px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
}
/* 卡片顶部金色渐变线 */
.login-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--app-gold), transparent);
}

.brand {
  text-align: center;
  margin-bottom: 28px;
}
.brand-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  border-radius: 14px;
  box-shadow: 0 6px 24px rgba(230, 172, 0, 0.25);
  margin-bottom: 14px;
}
.brand-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0 0 8px;
  background: linear-gradient(120deg, #ffd75e 0%, var(--app-gold) 55%, #c99400 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.brand-sub {
  font-size: 13px;
  color: var(--app-text-3);
  margin: 0;
}

.submit-btn {
  width: 100%;
  margin-top: 10px;
  font-weight: 700;
  letter-spacing: 0.35em;
  text-indent: 0.35em;
}
.back-btn {
  width: 100%;
  margin-top: 6px;
  margin-left: 0;
}
.mb {
  margin-bottom: 16px;
}

/* 移动端 */
@media (max-width: 480px) {
  .login-page {
    padding: 16px;
    align-items: flex-start;
    padding-top: 10vh;
  }
  .login-card {
    padding: 32px 22px 24px;
    border-radius: 16px;
  }
  .submit-btn {
    letter-spacing: 0.25em;
    text-indent: 0.25em;
  }
}
</style>
