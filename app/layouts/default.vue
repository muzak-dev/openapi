<script setup lang="ts">
const { spec } = useOpenApiDoc()
const { page } = useDocsState()

useHead({
  title: computed(() => spec.value?.info.title ? `${spec.value.info.title} — Reference` : 'API Reference'),
})

const mainScroll = useTemplateRef<HTMLElement>('mainScroll')
watch(page, () => {
  nextTick(() => { if (mainScroll.value) mainScroll.value.scrollTop = 0 })
}, { deep: true })
</script>

<template>
  <div class="h-svh flex flex-col bg-app text-fg overflow-hidden">
    <TopNav />

    <div class="flex-1 flex min-h-0">
      <Sidebar />

      <main ref="mainScroll" class="flex-1 min-w-0 overflow-y-auto scroll">
        <div class="mx-auto max-w-[820px] px-5 sm:px-8 py-7 pb-24">
          <slot />
        </div>
      </main>

      <aside v-if="page.type === 'endpoint'" class="hidden xl:flex w-[440px] shrink-0 flex-col border-l border-line bg-app">
        <TryItPanel context="desktop" />
      </aside>
    </div>

    <MobileNavDrawer />
    <MobileTrySheet />
    <FloatingTryButton />
    <AuthModal />
    <CommandPalette />
  </div>
</template>
