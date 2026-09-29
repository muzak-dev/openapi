<script setup lang="ts">
import { pretty } from '~/utils/openapi'

const { spec } = useOpenApiDoc()
const { sidebarOpen, sidebarQuery } = useDocsState()
const { copy, copied } = useCopyFeedback()
</script>

<template>
  <aside v-show="sidebarOpen" class="hidden lg:flex w-[272px] shrink-0 flex-col border-r border-line bg-app">
    <div class="p-2.5 pb-2 border-b border-line">
      <UInput
        v-model="sidebarQuery"
        icon="i-lucide-search"
        size="md"
        variant="outline"
        placeholder="Filter by title, category, path…"
        aria-label="Filter endpoints and schemas"
        :ui="{ root: 'w-full' }"
        @keydown.esc="sidebarQuery = ''"
      >
        <template v-if="sidebarQuery" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-lucide-circle-x"
            aria-label="Clear filter"
            @click="sidebarQuery = ''"
          />
        </template>
      </UInput>
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
