export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  modules: ['@nuxt/ui', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],

  app: {
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
      specUrl: '/openapi.json',
    },
  },

  // @nuxt/fonts self-hosts Inter and JetBrains Mono at build time (it detects
  // the font-family declarations in main.css) — same look as the reference
  // design's Google Fonts link, but with zero runtime external requests.
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 450, 500, 600, 700] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500, 600] },
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