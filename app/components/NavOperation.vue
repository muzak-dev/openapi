<script setup lang="ts">
import { rowTooltip } from '~/utils/sidebar'
import type { OperationEntry } from '~/utils/openapi'

defineProps<{
  op: OperationEntry
  active: boolean
}>()

defineEmits<{ open: [] }>()
</script>

<template>
  <!--
    One endpoint in the sidebar. Its title, when the document gave it one, names
    the row in place of its path, and the path moves to the tooltip. Both are
    interpolated as text: they are the document's words, never markup.
  -->
  <button
    class="nav-row !pl-[26px]"
    :class="{ active }"
    :title="rowTooltip(op)"
    :aria-current="active ? 'page' : undefined"
    data-nav="op"
    @click="$emit('open')"
  >
    <span class="mth w-[38px] text-right shrink-0" :data-m="op.verb.toUpperCase()">{{ op.verb.toUpperCase() }}</span>
    <span v-if="op.title" class="text-[12px] truncate nav-path text-mut">{{ op.title }}</span>
    <span v-else class="mono text-[11.5px] truncate nav-path text-mut">{{ op.path }}</span>
  </button>
</template>
