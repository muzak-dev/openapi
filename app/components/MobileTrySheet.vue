<script setup lang="ts">
const { mobileTry } = useDocsState()
</script>

<template>
  <template v-if="mobileTry">
    <div class="overlay xl:hidden" @click="mobileTry = false" />
    <div
      class="xl:hidden fixed inset-x-0 bottom-0 top-[64px] sm:top-[15vh] z-[70] bg-app border-t border-line rounded-t-xl overflow-hidden flex flex-col fade-in"
      style="box-shadow:var(--shadow-lg)"
    >
      <div class="pt-2 pb-1 flex justify-center shrink-0"><span class="w-9 h-1 rounded-full bg-line2" /></div>
      <TryItPanel context="sheet" />
    </div>
  </template>
</template>
