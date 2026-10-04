export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchMe } = useAuth()
  if (!user.value) {
    await fetchMe()
  }
  if (user.value?.role !== 'super_admin') {
    return navigateTo('/')
  }
})
