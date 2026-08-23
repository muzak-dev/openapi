/** Auth state plus how to apply it to a request, driven by the spec's own declared security schemes (not an assumed bearer/apiKey/basic/oauth set). */
export function useAuth() {
  const { authOptions } = useOpenApiDoc()
  const { auth } = useDocsState()

  const activeScheme = computed(() =>
    authOptions.value.find(o => o.id === auth.value.schemeId) || authOptions.value[0] || null,
  )

  watch(authOptions, (opts) => {
    if (!opts.length) return
    if (!opts.some(o => o.id === auth.value.schemeId)) auth.value.schemeId = opts[0].id
  }, { immediate: true })

  const authed = computed(() => {
    const s = activeScheme.value
    if (!s) return false
    if (s.scheme.type === 'http' && s.scheme.scheme === 'basic') return !!auth.value.user
    return !!auth.value.token
  })

  const authLabel = computed(() => activeScheme.value?.label || 'No security scheme declared')

  const maskedToken = computed(() => {
    const s = activeScheme.value
    if (s?.scheme.type === 'http' && s.scheme.scheme === 'basic') {
      return auth.value.user ? `${auth.value.user}:••••` : 'not set'
    }
    const t = auth.value.token
    if (!t) return 'not set'
    return t.length > 12 ? `${t.slice(0, 7)}••••••${t.slice(-3)}` : '••••••••'
  })

  /** Mutates `headers` and, for a query-placed API key, `url`'s search params. */
  function applyAuth(headers: Record<string, string>, url: URL) {
    const s = activeScheme.value
    if (!s) return
    const { scheme } = s
    if (scheme.type === 'http' && scheme.scheme === 'bearer' && auth.value.token) {
      headers.Authorization = `Bearer ${auth.value.token}`
    } else if (scheme.type === 'http' && scheme.scheme === 'basic' && auth.value.user) {
      headers.Authorization = `Basic ${btoa(`${auth.value.user}:${auth.value.pass}`)}`
    } else if (scheme.type === 'apiKey' && auth.value.token) {
      if (scheme.in === 'query') url.searchParams.set(scheme.name || 'api_key', auth.value.token)
      else headers[scheme.name || 'X-API-Key'] = auth.value.token
    } else if (scheme.type === 'oauth2' && auth.value.token) {
      headers.Authorization = `Bearer ${auth.value.token}`
    }
  }

  function clearAuth() {
    auth.value.token = ''
    auth.value.user = ''
    auth.value.pass = ''
  }

  return { authOptions, activeScheme, auth, authed, authLabel, maskedToken, applyAuth, clearAuth }
}
