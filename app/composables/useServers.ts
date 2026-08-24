import type { OpenApiServer } from '~/utils/openapi'

/**
 * The servers the loaded document offers, and the one currently selected.
 *
 * A document that declares no `servers` is not a document with nowhere to send
 * a request: OpenAPI says an absent server list means the document\'s own
 * origin, and a Muzak service takes that literally - it serves its document
 * beside the API it describes, and declares servers only when the API is
 * reached somewhere else. Without this fallback the request console has no
 * base URL and every "Send request" does nothing, which is what a service
 * that never set AppOptions.Servers would see.
 */
export function useServers() {
  const { spec } = useOpenApiSpec()
  const { server } = useDocsState()
  const pageOrigin = useRequestURL().origin

  const servers = computed<OpenApiServer[]>(() => {
    const declared = spec.value?.servers
    if (declared?.length) {
      return declared
    }
    return [{ url: pageOrigin, description: 'This service' }]
  })

  const baseUrl = computed(() => {
    const chosen = servers.value[server.value] ?? servers.value[0]
    return chosen?.url ?? ''
  })

  return { servers, baseUrl }
}
