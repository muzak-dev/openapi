<script setup lang="ts">
const { page, mobileTry, mobileNav } = useDocsState()
</script>

<template>
  <button
    v-if="page.type === 'endpoint' && !mobileTry && !mobileNav"
    class="xl:hidden fixed right-4 bottom-4 z-50 btn btn-primary !h-11 !px-4 !rounded-full"
    style="box-shadow:var(--shadow-lg)"
    @click="mobileTry = true"
  >
    <Icon name="i-lucide-play" :size="14" />
    <span class="font-semibold">Try it</span>
  </button>
</template>
