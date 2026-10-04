export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchMe } = useAuth()
  if (!user.value) {
    const u = await fetchMe()
    if (!u) {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  }
})
