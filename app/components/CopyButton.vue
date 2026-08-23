<script setup lang="ts">
const props = withDefaults(defineProps<{
  text: string
  copyKey: string
  iconSize?: number
  label?: string
}>(), {
  iconSize: 12,
  label: 'Copy',
})

const { copy, copied } = useCopyFeedback()
const isCopied = computed(() => copied.value === props.copyKey)
</script>

<template>
  <button
    class="icon-btn"
    :aria-label="isCopied ? 'Copied' : label"
    :title="isCopied ? 'Copied' : label"
    @click="copy(text, copyKey)"
  >
    <Icon :name="isCopied ? 'i-lucide-check' : 'i-lucide-copy'" :size="iconSize" />
  </button>
</template>
