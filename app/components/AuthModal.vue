<script setup lang="ts">
const { authModal } = useDocsState()
const { authOptions, activeScheme, auth, clearAuth } = useAuth()

function selectScheme(id: string) {
  auth.value.schemeId = id
  const scheme = authOptions.value.find(o => o.id === id)?.scheme
  if (scheme?.type === 'apiKey' && !auth.value.apiKeyName) auth.value.apiKeyName = scheme.name || ''
}

function saveAuth() {
  authModal.value = false
}
</script>

<template>
  <template v-if="authModal">
    <div class="overlay" @click="authModal = false" />
    <div
      class="fixed z-[80] left-1/2 top-[18vh] -translate-x-1/2 w-[calc(100%-2rem)] max-w-[420px] pop fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Authenticate"
    >
      <div class="flex items-center gap-2.5 px-4 h-12 border-b border-line">
        <span class="text-acc"><Icon name="i-lucide-key-round" :size="15" /></span>
        <h2 class="text-[13.5px] font-semibold">Authenticate</h2>
        <button class="icon-btn ml-auto" aria-label="Close" @click="authModal = false"><Icon name="i-lucide-x" :size="15" /></button>
      </div>

      <div class="p-4 space-y-3.5">
        <p v-if="!authOptions.length" class="text-[12.5px] text-mut">
          This document doesn't declare any <code class="icode">securitySchemes</code>.
        </p>

        <template v-else>
          <div>
            <label class="eyebrow block mb-1.5">Scheme</label>
            <div class="grid grid-cols-1 gap-1.5">
              <button
                v-for="opt in authOptions" :key="opt.id"
                class="btn !h-8 !justify-start"
                :class="auth.schemeId === opt.id ? '!border-acc !text-fg' : ''"
                :style="auth.schemeId === opt.id ? 'background:var(--acc-soft);border-color:var(--acc-line)' : ''"
                @click="selectScheme(opt.id)"
              >
                <Icon name="i-lucide-key-round" :size="12" />{{ opt.label }}
              </button>
            </div>
          </div>

          <template v-if="activeScheme?.scheme.type === 'http' && activeScheme.scheme.scheme === 'bearer'">
            <div>
              <label class="eyebrow block mb-1.5">Bearer token</label>
              <input v-model="auth.token" class="inp" type="password" placeholder="sk_live_…" autocomplete="off">
              <p class="text-[11.5px] text-dim mt-1.5">Sent as <code class="icode">Authorization: Bearer …</code></p>
            </div>
          </template>
          <template v-else-if="activeScheme?.scheme.type === 'apiKey'" >
            <div class="space-y-2.5">
              <div>
                <label class="eyebrow block mb-1.5">{{ activeScheme.scheme.in === 'query' ? 'Query parameter' : 'Header' }} name</label>
                <input v-model="auth.apiKeyName" class="inp" :placeholder="activeScheme.scheme.name || 'X-API-Key'">
              </div>
              <div>
                <label class="eyebrow block mb-1.5">Key</label>
                <input v-model="auth.token" class="inp" type="password" placeholder="Paste your API key" autocomplete="off">
              </div>
            </div>
          </template>
          <template v-else-if="activeScheme?.scheme.type === 'http' && activeScheme.scheme.scheme === 'basic'">
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="eyebrow block mb-1.5">Username</label>
                <input v-model="auth.user" class="inp" autocomplete="off">
              </div>
              <div>
                <label class="eyebrow block mb-1.5">Password</label>
                <input v-model="auth.pass" class="inp" type="password" autocomplete="off">
              </div>
            </div>
          </template>
          <template v-else>
            <div class="space-y-2.5">
              <div>
                <label class="eyebrow block mb-1.5">Access token</label>
                <input v-model="auth.token" class="inp" type="password" placeholder="Paste an access token" autocomplete="off">
              </div>
            </div>
          </template>

          <div class="flex items-center gap-2 pt-1">
            <button class="btn btn-primary flex-1" @click="saveAuth">Save credentials</button>
            <button class="btn" @click="clearAuth">Clear</button>
          </div>
          <p class="text-[11px] text-dim leading-relaxed">
            Kept in this browser tab only (<code class="icode">sessionStorage</code>, cleared when it closes) and sent only to
            the server you select above — this page makes real requests, so use a key you're comfortable pasting here.
          </p>
        </template>
      </div>
    </div>
  </template>
</template>
