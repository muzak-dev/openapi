<script setup lang="ts">
const { mobileNav, sidebarQuery } = useDocsState()
</script>

<template>
  <template v-if="mobileNav">
    <div class="overlay lg:hidden" @click="mobileNav = false" />
    <aside class="lg:hidden fixed inset-y-0 left-0 w-[290px] z-[70] bg-app border-r border-line flex flex-col fade-in">
      <div class="h-12 shrink-0 flex items-center justify-between px-3 border-b border-line">
        <span class="text-[13px] font-semibold">Navigation</span>
        <button class="icon-btn" aria-label="Close navigation" @click="mobileNav = false"><Icon name="i-lucide-x" :size="15" /></button>
      </div>
      <div class="p-2.5 border-b border-line">
        <input v-model="sidebarQuery" class="inp !font-sans !text-[12px]" placeholder="Filter endpoints…" aria-label="Filter endpoints">
      </div>
      <NavList />
    </aside>
  </template>
</template>
