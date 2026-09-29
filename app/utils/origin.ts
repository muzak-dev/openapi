// Which origins the dashboard trusts, and what it does with a URL it was given.
// Pure functions, so they can be tested without a browser.
//
// Two things reach out from this page with something worth stealing attached:
// the request for the OpenAPI document, whose contents decide where Try It
// sends the visitor's saved credential, and Try It itself, which sends it.

/** Reports whether `value`, relative or absolute, is an http(s) URL on the same origin as `pageOrigin`. */
export function isSameOrigin(value: string, pageOrigin: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value, pageOrigin)
    // A blob: URL takes the origin of the page that made it, so the origin
    // alone would let one through.
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === pageOrigin
  } catch {
    return false
  }
}

/**
 * The URL the OpenAPI document is fetched from: the `?spec=` override when it
 * names the page's own origin, and the configured default otherwise. A
 * cross-origin override would make this page, served from the real domain,
 * render a document an attacker wrote, and Try It would then send the
 * visitor's saved credential to whatever server that document names.
 */
export function resolveSpecUrl(fromQuery: unknown, fallback: string, pageOrigin: string): string {
  return typeof fromQuery === 'string' && isSameOrigin(fromQuery, pageOrigin) ? fromQuery : fallback
}

/**
 * Reports whether a fetched document may be used. The override is checked
 * before the request is made, but a same-origin address can answer with a
 * redirect, and an open redirect anywhere on the host is enough to make the
 * browser load a document from somewhere else. Where the response finally came
 * from has to be on the page's origin too.
 */
export function specResponseTrusted(response: { redirected: boolean, url: string }, pageOrigin: string): boolean {
  return !response.redirected || isSameOrigin(response.url, pageOrigin)
}

/**
 * The URL a Try It request goes to: the server, then the operation's path.
 *
 * Both come from the document, and a path joined to the server as plain text
 * can change the host: "https://api.example.com" + "@attacker.example/x" is a
 * request to attacker.example, and the credential attached to it goes there
 * too. The path is therefore always joined with a slash between them, and the
 * result is checked to still be on the server's origin. A server that is not
 * http(s), or does not parse, is not one a request can go to. A relative server
 * URL is relative to the page, as OpenAPI defines it.
 */
export function requestUrl(server: string, path: string, pageOrigin: string): URL | null {
  if (!server) return null
  let base: URL
  try {
    base = new URL(server, pageOrigin)
  } catch {
    return null
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null
  try {
    const url = new URL(base.origin + base.pathname.replace(/\/+$/, '') + (path.startsWith('/') ? '' : '/') + path)
    return url.origin === base.origin ? url : null
  } catch {
    return null
  }
}
