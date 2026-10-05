// 全局 401 拦截：接口返回「未登录」时自动跳转登录页
export default defineNuxtPlugin((nuxtApp) => {
  const original = globalThis.$fetch
  if (typeof original !== 'function') return

  const wrappedFetch = async (request: any, options: any) => {
    try {
      return await original(request, options)
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status
      const message = err?.data?.message ?? ''
      if (status === 401 && message === '未登录或登录已失效') {
        try {
          await nuxtApp.runWithContext(async () => {
            const userState = useState<unknown | null>('auth:user', () => null)
            userState.value = null
            await navigateTo('/login', { replace: true })
          })
        } catch {
          // 忽略跳转过程中的异常，保证原始错误继续抛出
        }
      }
      throw err
    }
  }

  ;(globalThis as any).$fetch = wrappedFetch
})
