import { resolveSpecUrl, specResponseTrusted } from '~/utils/origin'
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
 *
 * Checking the address is not enough on its own, because a same-origin
 * address can redirect: the response is checked for where it finally came
 * from as well.
 */
export function useOpenApiSpec() {
  const config = useRuntimeConfig()
  const route = useRoute()
  const pageOrigin = useRequestURL().origin

  const specUrl = computed(() => resolveSpecUrl(route.query.spec, config.public.specUrl, pageOrigin))

  /**
   * The document's URL, resolved against the page's own origin.
   *
   * The path is resolved here rather than handed to `$fetch` as-is because
   * Nuxt gives `$fetch` the application's baseURL, and the dashboard is
   * mounted under one: served at /docs, a plain `/openapi.json` would be
   * requested as /docs/openapi.json. The document sits at an absolute path on
   * this origin, so that is what is asked for.
   */
  const specRequestUrl = computed(() => new URL(specUrl.value, pageOrigin).toString())

  const spec = useState<OpenApiDocument | null>('openapi-spec', () => null)
  const pending = useState('openapi-spec-pending', () => true)
  const error = useState<string | null>('openapi-spec-error', () => null)

  async function load() {
    pending.value = true
    error.value = null
    try {
      const response = await $fetch.raw(specRequestUrl.value, {
        headers: { Accept: 'application/json' },
      })
      if (!specResponseTrusted(response, pageOrigin)) {
        throw new Error('the OpenAPI document was redirected to another origin, so it was not loaded')
      }
      const result = response._data
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
