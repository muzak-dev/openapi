import type { OpenApiDocument } from '~/utils/openapi'

/**
 * Fetches and holds the OpenAPI document. The URL defaults to the
 * conventional same-origin `/openapi.json` (the Go framework's default
 * `OpenAPIPath`) and can be overridden per-deployment with a `?spec=` query
 * string param, so this build doesn't need to know its host's routing.
 *
 * The override is restricted to the page's own origin. Without that check, a
 * link like `?spec=https://attacker.example/evil.json` would make this page —
 * served from the real, trusted domain — load and render a document the
 * attacker fully controls, including its `servers[].url`. Since the Try It
 * panel sends its request to whatever server the loaded document names and
 * `useAuth` auto-attaches any credential the visitor previously saved for
 * this origin, an unrestricted override turns one clicked link into silent
 * exfiltration of that visitor's real API key to the attacker's server.
 */
export function useOpenApiSpec() {
  const config = useRuntimeConfig()
  const route = useRoute()
  const pageOrigin = useRequestURL().origin

  const specUrl = computed(() => {
    const fromQuery = route.query.spec
    return typeof fromQuery === 'string' && fromQuery.length > 0 && isSameOrigin(fromQuery, pageOrigin)
      ? fromQuery
      : config.public.specUrl
  })

  const spec = useState<OpenApiDocument | null>('openapi-spec', () => null)
  const pending = useState('openapi-spec-pending', () => true)
  const error = useState<string | null>('openapi-spec-error', () => null)

  async function load() {
    pending.value = true
    error.value = null
    try {
      const result = await $fetch(specUrl.value, {
        headers: { Accept: 'application/json' },
      })
      if (!isOpenApiDocument(result)) {
        throw new Error('the response was not a valid OpenAPI document')
      }
      spec.value = result
    } catch (err) {
      spec.value = null
      error.value = errorMessage(err)
    } finally {
      pending.value = false
    }
  }

  return { spec, pending, error, specUrl, load }
}

/** Reports whether `value` — relative or absolute — resolves to the same origin as `pageOrigin`. This is the only form of `?spec=` override trusted; a cross-origin value falls back to the configured default instead. */
function isSameOrigin(value: string, pageOrigin: string): boolean {
  try {
    return new URL(value, pageOrigin).origin === pageOrigin
  } catch {
    return false
  }
}

/** Guards against a non-JSON fallback response (an HTML error page, an SPA shell) silently masquerading as success. */
function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  return !!value
    && typeof value === 'object'
    && typeof (value as OpenApiDocument).info?.title === 'string'
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const withStatus = err as { statusMessage?: string, statusCode?: number, message?: string }
    if (withStatus.statusCode) {
      return `the OpenAPI document responded with ${withStatus.statusCode}${withStatus.statusMessage ? ` ${withStatus.statusMessage}` : ''}`
    }
    if (withStatus.message) return withStatus.message
  }
  return 'the OpenAPI document could not be loaded'
}
