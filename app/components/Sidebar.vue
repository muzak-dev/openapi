<script setup lang="ts">
import { pretty } from '~/utils/openapi'

const { spec } = useOpenApiDoc()
const { sidebarOpen, sidebarQuery } = useDocsState()
const { copy, copied } = useCopyFeedback()
</script>

<template>
  <aside v-show="sidebarOpen" class="hidden lg:flex w-[272px] shrink-0 flex-col border-r border-line bg-app">
    <div class="p-2.5 pb-2 border-b border-line">
      <div class="relative">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none"><Icon name="i-lucide-search" :size="12" /></span>
        <input
          v-model="sidebarQuery"
          class="inp !pl-[28px] !font-sans !text-[12px]"
          placeholder="Filter endpoints…"
          aria-label="Filter endpoints and schemas"
          @keydown.esc="sidebarQuery = ''"
        >
        <button v-if="sidebarQuery" class="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn !w-5 !h-5" aria-label="Clear filter" @click="sidebarQuery = ''">
          <Icon name="i-lucide-x" :size="11" />
        </button>
      </div>
    </div>

    <NavList />

    <div class="px-3 py-2.5 border-t border-line flex items-center justify-between">
      <span class="text-[11px] text-dim">OpenAPI {{ spec?.openapi }}</span>
      <button class="text-[11px] text-dim hover:text-fg flex items-center gap-1 transition-colors" @click="spec && copy(pretty(spec), 'spec')">
        <Icon :name="copied === 'spec' ? 'i-lucide-check' : 'i-lucide-download'" :size="11" />
        <span>{{ copied === 'spec' ? 'Copied' : 'Copy spec' }}</span>
      </button>
    </div>
  </aside>
</template>
