<script setup lang="ts">
import type { OperationGroup } from '~/utils/openapi'

// The sidebar reads top to bottom as three answers to three different
// questions.
//
// "Where does this endpoint live" is the reference tree: every category once,
// every operation under exactly one of them. It is a table of contents, so
// nothing in it repeats.
//
// "What else is this endpoint" is the tag index. A Muzak route inherits its
// router's tag and may add its own, so an operation filed under `admin` can
// also be tagged `audit`; here it appears under both, which is the whole point
// of having put two tags on it.
//
// "What shapes does this API speak" is the schema list.
const { groups, tagIndex, schemaNames } = useOpenApiDoc()
const { page, sidebarQuery, collapsedGroups, collapsedTags, mobileNav } = useDocsState()

/** Narrows a section to the operations matching the filter, dropping empties. */
function filterGroups(all: OperationGroup[]): OperationGroup[] {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return all
  return all
    .map(g => ({
      ...g,
      operations: g.operations.filter(o =>
        o.path.toLowerCase().includes(q)
        || o.summary.toLowerCase().includes(q)
        || o.verb.includes(q)
        || g.tag.toLowerCase().includes(q),
      ),
    }))
    .filter(g => g.operations.length)
}

const filteredGroups = computed(() => filterGroups(groups.value))

// Only the tags that say something the tree does not: a tag carried by every
// operation of one category alone is that category, and listing it again would
// be the duplication this section exists to avoid.
const crossCuttingTags = computed(() =>
  tagIndex.value.filter(tag => tag.operations.some(op => op.category !== tag.tag)),
)
const filteredTags = computed(() => filterGroups(crossCuttingTags.value))

const filteredSchemas = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return schemaNames.value
  return schemaNames.value.filter(n => n.toLowerCase().includes(q))
})

const empty = computed(() =>
  !filteredGroups.value.length && !filteredTags.value.length && !filteredSchemas.value.length,
)

function isCollapsed(tag: string) {
  return !!collapsedGroups.value[tag]
}
function toggleGroup(tag: string) {
  collapsedGroups.value[tag] = !collapsedGroups.value[tag]
}
// The tag accordion starts closed: it is the secondary view, and opening it is
// the reader saying they want the cross-reference.
function isTagCollapsed(tag: string) {
  return collapsedTags.value[tag] !== false
}
function toggleTag(tag: string) {
  collapsedTags.value[tag] = !isTagCollapsed(tag)
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

    <div v-if="filteredTags.length" class="mb-4">
      <p class="eyebrow px-3 mb-1.5">Tags</p>
      <div v-for="tag in filteredTags" :key="`tag:${tag.tag}`" class="mb-1">
        <button
          class="nav-row !py-1"
          :aria-expanded="!isTagCollapsed(tag.tag)"
          :title="tag.description"
          @click="toggleTag(tag.tag)"
        >
          <span class="sn-caret !ml-0" :class="{ open: !isTagCollapsed(tag.tag) }"><Icon name="i-lucide-chevron-right" :size="12" /></span>
          <Icon name="i-lucide-tag" :size="11" class="shrink-0 text-dim" />
          <span class="text-[12.5px] font-medium truncate">{{ tag.tag }}</span>
          <span class="ml-auto text-[10.5px] text-dim tnum">{{ tag.operations.length }}</span>
        </button>
        <div v-show="!isTagCollapsed(tag.tag)" class="mt-0.5">
          <button
            v-for="op in tag.operations" :key="`tag:${tag.tag}:${op.id}`"
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
