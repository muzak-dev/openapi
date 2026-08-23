<script setup lang="ts">
const { spec } = useOpenApiDoc()
const { server, sidebarOpen, mobileNav, authModal, paletteOpen } = useDocsState()
const { authed } = useAuth()
const colorMode = useColorMode()

const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <header class="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line bg-app z-40">
    <button class="icon-btn lg:hidden" aria-label="Open navigation" @click="mobileNav = true">
      <Icon name="i-lucide-menu" :size="16" />
    </button>

    <button
      class="icon-btn hidden lg:inline-flex"
      :aria-label="sidebarOpen ? 'Hide sidebar' : 'Show sidebar'"
      :title="sidebarOpen ? 'Hide sidebar' : 'Show sidebar'"
      @click="sidebarOpen = !sidebarOpen"
    >
      <Icon name="i-lucide-panel-left" :size="15" />
    </button>

    <div class="flex items-center gap-2 pr-1 rounded-md">
      <span
        class="w-[22px] h-[22px] rounded-[6px] grid place-items-center text-[11px] font-bold text-white shrink-0"
        style="background:linear-gradient(145deg, var(--acc), color-mix(in srgb, var(--acc) 62%, #000));"
      >{{ (spec?.info.title || '?').charAt(0).toUpperCase() }}</span>
      <span class="text-[13.5px] font-semibold tracking-[-.01em] truncate max-w-[220px]">{{ spec?.info.title || 'API Reference' }}</span>
      <span v-if="spec?.info.version" class="chip mono hidden md:inline-block">v{{ spec.info.version }}</span>
    </div>

    <div v-if="spec?.servers?.length" class="hidden md:flex items-center gap-1.5 pl-1">
      <div class="relative">
        <select v-model.number="server" class="inp !h-[26px] !text-[11px] !pl-2 !pr-6 !bg-elev !font-sans" aria-label="Environment">
          <option v-for="(sv, i) in spec.servers" :key="i" :value="i">{{ sv.description || sv.url }}</option>
        </select>
        <span class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-dim"><Icon name="i-lucide-chevron-down" :size="11" /></span>
      </div>
    </div>

    <div class="flex-1 flex justify-center px-1 min-w-0">
      <button
        class="w-full max-w-[420px] h-[30px] flex items-center gap-2 px-2.5 rounded-md border border-line bg-elev text-dim hover:border-line2 hover:text-mut transition-colors"
        aria-label="Search documentation"
        @click="paletteOpen = true"
      >
        <Icon name="i-lucide-search" :size="13" />
        <span class="text-[12px] truncate">Search documentation<span class="hidden sm:inline">…</span></span>
        <span class="ml-auto kbd hidden sm:inline">{{ modKey }} K</span>
      </button>
    </div>

    <div class="flex items-center gap-0.5 pl-1 border-l border-line ml-1">
      <button
        class="icon-btn"
        :aria-label="`Switch to ${colorMode.value === 'dark' ? 'light' : 'dark'} theme`"
        :title="`Switch to ${colorMode.value === 'dark' ? 'light' : 'dark'} theme`"
        @click="toggleTheme"
      >
        <Icon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" :size="15" />
      </button>
      <button
        class="icon-btn ml-0.5"
        :aria-label="authed ? 'Manage authentication' : 'Authenticate'"
        :title="authed ? 'Authenticated' : 'Not authenticated'"
        @click="authModal = true"
      >
        <span
          class="w-[22px] h-[22px] rounded-full grid place-items-center border"
          :style="authed ? 'background:var(--acc-soft);border-color:var(--acc-line);color:var(--acc)' : 'background:var(--elev);border-color:var(--border);color:var(--fg-3)'"
        >
          <Icon name="i-lucide-key-round" :size="11" />
        </span>
      </button>
    </div>
  </header>
</template>
