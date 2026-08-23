import { exampleFor, paramsOf, pretty, type OpenApiDocument, type OperationEntry } from '~/utils/openapi'

export interface ReqHeader { k: string, v: string }
export interface ReqState {
  path: Record<string, string>
  query: Record<string, string>
  queryOn: Record<string, boolean>
  headers: ReqHeader[]
  body: string
}
export interface ResState {
  status: number
  statusText: string
  ms: number
  size: string
  bodyText: string
  headers: Record<string, string>
}
export interface HistoryEntry {
  opId: string
  method: string
  path: string
  status: number
  ms: number
}

function seed(op: OperationEntry | null, spec: OpenApiDocument | null): ReqState {
  const next: ReqState = { path: {}, query: {}, queryOn: {}, headers: [{ k: 'Accept', v: 'application/json' }], body: '' }
  if (!op) return next
  for (const p of paramsOf(op, 'path')) next.path[p.name] = String(p.schema?.example ?? p.schema?.default ?? '')
  for (const p of paramsOf(op, 'query')) {
    next.query[p.name] = String(p.schema?.example ?? p.schema?.default ?? '')
    next.queryOn[p.name] = p.schema?.example !== undefined || p.name === 'limit'
  }
  if (op.requestBody && spec) next.body = pretty(exampleFor(spec, op.requestBody.schema))
  return next
}

/** Builds and sends a real request for the operation on the current page — shared between the desktop rail and the mobile sheet. */
export function useTryIt() {
  const { spec, opById } = useOpenApiDoc()
  const { page, server } = useDocsState()
  const { applyAuth } = useAuth()

  const req = useState<ReqState>('docs-req', () => ({ path: {}, query: {}, queryOn: {}, headers: [], body: '' }))
  const reqState = useState<'idle' | 'loading' | 'error' | 'done'>('docs-reqState', () => 'idle')
  const reqError = useState('docs-reqError', () => '')
  const res = useState<ResState | null>('docs-res', () => null)
  const tryTab = useState<'request' | 'response' | 'headers'>('docs-tryTab', () => 'request')
  const history = useState<HistoryEntry[]>('docs-history', () => [])

  const ep = computed(() => (page.value.type === 'endpoint' ? opById(page.value.id) : null))
  const baseUrl = computed(() => spec.value?.servers?.[server.value]?.url || '')

  const bodyError = computed(() => {
    if (!ep.value?.requestBody || !req.value.body.trim()) return ''
    try {
      JSON.parse(req.value.body)
      return ''
    } catch (e) {
      return `Body is not valid JSON — ${e instanceof Error ? e.message : 'parse error'}`
    }
  })

  /** Single pass so query-placed API keys land in both the URL and the header set consistently. */
  const built = computed(() => {
    const op = ep.value
    const headers: Record<string, string> = {}
    if (!op || !baseUrl.value) return { url: '', headers, urlObj: null as URL | null }
    const path = op.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(req.value.path[k] || `{${k}}`))
    let urlObj: URL
    try {
      urlObj = new URL(baseUrl.value.replace(/\/$/, '') + path)
    } catch {
      return { url: '', headers, urlObj: null as URL | null }
    }
    for (const p of paramsOf(op, 'query')) {
      const v = req.value.query[p.name]
      if (req.value.queryOn[p.name] && v !== '' && v !== undefined) urlObj.searchParams.set(p.name, v)
    }
    applyAuth(headers, urlObj)
    for (const h of req.value.headers) if (h.k) headers[h.k] = h.v
    if (op.requestBody) headers['Content-Type'] = op.requestBody.contentType
    return { url: urlObj.toString(), headers, urlObj }
  })

  const builtUrl = computed(() => built.value.url)
  const builtHeaders = computed(() => built.value.headers)

  async function send() {
    const op = ep.value
    if (!op || reqState.value === 'loading') return
    tryTab.value = 'response'

    if (bodyError.value) {
      reqState.value = 'error'
      reqError.value = bodyError.value
      return
    }
    const missing = paramsOf(op, 'path').filter(p => !String(req.value.path[p.name] || '').trim())
    if (missing.length) {
      reqState.value = 'error'
      reqError.value = `Fill in the required path parameter: ${missing.map(p => p.name).join(', ')}.`
      return
    }
    if (!built.value.urlObj) {
      reqState.value = 'error'
      reqError.value = 'No server is configured for this document.'
      return
    }

    reqState.value = 'loading'
    res.value = null
    const started = performance.now()
    try {
      const init: RequestInit = { method: op.verb.toUpperCase(), headers: built.value.headers }
      if (op.requestBody && req.value.body.trim()) init.body = req.value.body
      const response = await fetch(built.value.url, init)
      const elapsed = Math.round(performance.now() - started)
      const bodyText = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => { headers[k] = v })
      const bytes = new Blob([bodyText]).size
      // Reformat for display/copy so a minified error body doesn't render as
      // one long horizontally-scrolling line; `bytes` above still reflects
      // what actually came over the wire.
      let displayBody = bodyText
      try { displayBody = pretty(JSON.parse(bodyText)) } catch { /* not JSON — show as-is */ }
      res.value = {
        status: response.status,
        statusText: response.statusText,
        ms: elapsed,
        size: bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`,
        bodyText: displayBody || `// ${response.status} ${response.statusText || 'No Content'}`,
        headers,
      }
      reqState.value = 'done'
      history.value.unshift({
        opId: op.id,
        method: op.verb.toUpperCase(),
        path: built.value.url.replace(baseUrl.value, ''),
        status: response.status,
        ms: elapsed,
      })
      if (history.value.length > 8) history.value.pop()
    } catch (e) {
      reqState.value = 'error'
      reqError.value = e instanceof Error
        ? `${e.message} — the server may not allow cross-origin requests from this page (CORS), or it isn't reachable.`
        : 'Request failed.'
    }
  }

  function addHeader() { req.value.headers.push({ k: '', v: '' }) }
  function resetRequest() { req.value = seed(ep.value, spec.value) }
  function resetBody() {
    if (ep.value?.requestBody && spec.value) req.value.body = pretty(exampleFor(spec.value, ep.value.requestBody.schema))
  }
  function formatBody() {
    try { req.value.body = pretty(JSON.parse(req.value.body)) } catch { /* leave as-is — bodyError already surfaces the parse error */ }
  }

  watch(page, (p) => {
    req.value = seed(p.type === 'endpoint' ? opById(p.id) : null, spec.value)
    res.value = null
    reqState.value = 'idle'
    reqError.value = ''
    tryTab.value = 'request'
  }, { deep: true, immediate: true })

  return {
    req, reqState, reqError, res, tryTab, history,
    ep, baseUrl, builtUrl, builtHeaders, bodyError,
    send, addHeader, resetRequest, resetBody, formatBody,
    params: (where: 'path' | 'query' | 'header' | 'cookie') => paramsOf(ep.value, where),
  }
}
