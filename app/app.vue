<script setup lang="ts">
const { load } = useOpenApiSpec()

onMounted(() => {
  load()
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
