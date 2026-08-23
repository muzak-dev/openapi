<script setup lang="ts">
const { groups, schemaNames } = useOpenApiDoc()
const { page, sidebarQuery, collapsedGroups, mobileNav } = useDocsState()

const filteredGroups = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map(g => ({ ...g, operations: g.operations.filter(o => o.path.toLowerCase().includes(q) || o.summary.toLowerCase().includes(q) || o.verb.includes(q) || g.tag.toLowerCase().includes(q)) }))
    .filter(g => g.operations.length)
})

const filteredSchemas = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return schemaNames.value
  return schemaNames.value.filter(n => n.toLowerCase().includes(q))
})

const empty = computed(() => !filteredGroups.value.length && !filteredSchemas.value.length)

function isCollapsed(tag: string) {
  return !!collapsedGroups.value[tag]
}
function toggleGroup(tag: string) {
  collapsedGroups.value[tag] = !collapsedGroups.value[tag]
}
function goTo(target: { type: 'endpoint' | 'schema', id: string }) {
  page.value = target
  mobileNav.value = false
}
</script>

<template>
  <nav class="flex-1 overflow-y-auto scroll px-2 py-3" aria-label="Documentation">
    <div v-if="empty" class="px-3 py-8 text-center">
      <p class="text-[12.5px] text-mut">No matches for "{{ sidebarQuery }}"</p>
      <button class="btn mt-3 mx-auto" @click="sidebarQuery = ''">Clear filter</button>
    </div>

    <div v-if="filteredGroups.length" class="mb-4">
      <p class="eyebrow px-3 mb-1.5">API reference</p>
      <div v-for="grp in filteredGroups" :key="grp.tag" class="mb-1">
        <button class="nav-row !py-1" :aria-expanded="!isCollapsed(grp.tag)" @click="toggleGroup(grp.tag)">
          <span class="sn-caret !ml-0" :class="{ open: !isCollapsed(grp.tag) }"><Icon name="i-lucide-chevron-right" :size="12" /></span>
          <span class="text-[12.5px] font-medium truncate">{{ grp.tag }}</span>
          <span class="ml-auto text-[10.5px] text-dim tnum">{{ grp.operations.length }}</span>
        </button>
        <div v-show="!isCollapsed(grp.tag)" class="mt-0.5">
          <button
            v-for="op in grp.operations" :key="op.id"
            class="nav-row !pl-[26px]"
            :class="{ active: page.type === 'endpoint' && page.id === op.id }"
            :title="op.summary"
            @click="goTo({ type: 'endpoint', id: op.id })"
          >
            <span class="mth w-[38px] text-right shrink-0" :data-m="op.verb.toUpperCase()">{{ op.verb.toUpperCase() }}</span>
            <span class="mono text-[11.5px] truncate nav-path text-mut">{{ op.path }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="filteredSchemas.length" class="mb-4">
      <p class="eyebrow px-3 mb-1.5">Schemas</p>
      <button
        v-for="name in filteredSchemas" :key="name"
        class="nav-row"
        :class="{ active: page.type === 'schema' && page.id === name }"
        @click="goTo({ type: 'schema', id: name })"
      >
        <Icon name="i-lucide-braces" :size="12" />
        <span class="mono text-[11.5px] truncate nav-path">{{ name }}</span>
      </button>
    </div>
  </nav>
</template>
