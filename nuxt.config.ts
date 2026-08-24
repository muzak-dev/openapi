export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@nuxt/ui', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],

  app: {
    // The dashboard is served from wherever the host application mounts it,
    // which is AppOptions.DocsPath in a Muzak service and is not known when
    // this is built. Every absolute asset URL is therefore written under a
    // placeholder base, and the framework rewrites it to the real path when
    // the application starts. Only the HTML shells and one stylesheet carry
    // absolute URLs - the JavaScript chunks import each other relatively - so
    // the rewrite is a handful of substitutions, not a pass over the bundle.
    baseURL: '/__muzak_docs__/',
    head: {
      meta: [
        { name: 'referrer', content: 'same-origin' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // Same-origin path the OpenAPI document is fetched from. Overridable
      // per-deployment without a rebuild via a `spec` query string param.
      //
      // The default is a placeholder rather than /openapi.json: the framework
      // rewrites it to the host application's configured OpenAPIPath when the
      // application starts, the same way it rewrites app.baseURL above. A
      // build served outside a Muzak binary should pass ?spec= or override
      // NUXT_PUBLIC_SPEC_URL.
      specUrl: '/__muzak_spec__',
    },
  },

  // @nuxt/fonts self-hosts Inter and JetBrains Mono at build time (it detects
  // the font-family declarations in main.css) — same look as the reference
  // design's Google Fonts link, but with zero runtime external requests.
  // Only the Latin subsets are kept. The full download is every subset Google
  // publishes - Cyrillic, Greek, Vietnamese - which trebled the font weight of
  // a page that ships inside every Muzak binary.
  fonts: {
    defaults: { subsets: ['latin', 'latin-ext'] },
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500] },
    ],
  },

  icon: {
    // Bundle every icon referenced in source into the client build at
    // compile time so the deployed page makes zero runtime requests to
    // the Iconify API — required under a `connect-src 'self'` CSP.
    clientBundle: {
      scan: true,
      sizeLimitKb: 512,
    },
  },
})