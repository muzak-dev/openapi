<script setup lang="ts">
import type { OperationGroup } from '~/utils/openapi'
import { filterGroups, isOpen, queryTokens, withAll, withOpen } from '~/utils/sidebar'

// The sidebar reads top to bottom as three answers to three different
// questions.
//
// "Where does this endpoint live" is the reference tree: every category once,
// every operation under exactly one of them. It is a table of contents, so
// nothing in it repeats. A category is a router's, and a service may have a
// hundred of them, so the groups fold: each remembers whether the reader left it
// open, and a tree too long to read whole starts with only the group the reader
// is in.
//
// "What else is this endpoint" is the tag index. A Muzak route inherits its
// router's tag and may add its own, so an operation filed under `admin` can
// also be tagged `audit`; here it appears under both, which is the whole point
// of having put two tags on it.
//
// "What shapes does this API speak" is the schema list.
const { groups, tagIndex, schemaNames } = useOpenApiDoc()
const { page, sidebarQuery, openCategories, collapsedTags, mobileNav } = useDocsState()

const navEl = useTemplateRef<HTMLElement>('navEl')

const filtering = computed(() => queryTokens(sidebarQuery.value).length > 0)
const filteredGroups = computed(() => filterGroups(groups.value, sidebarQuery.value))

// Only the tags that say something the tree does not: a tag carried by every
// operation of one category alone is that category, and listing it again would
// be the duplication this section exists to avoid. A category is often the
// tag written as a title ("Billing" for `billing`), which is the same thing.
const crossCuttingTags = computed(() =>
  tagIndex.value.filter(tag => tag.operations.some(op => op.category.toLowerCase() !== tag.tag.toLowerCase())),
)
const filteredTags = computed(() => filterGroups(crossCuttingTags.value, sidebarQuery.value))

const filteredSchemas = computed(() => {
  const q = sidebarQuery.value.trim().toLowerCase()
  if (!q) return schemaNames.value
  return schemaNames.value.filter(n => n.toLowerCase().includes(q))
})

const empty = computed(() =>
  !filteredGroups.value.length && !filteredTags.value.length && !filteredSchemas.value.length,
)

// While a filter is typed, every group with a match is open, whatever the
// reader left it as, so the matches are on screen and not behind a fold. A
// group they close meanwhile stays closed until the filter changes; what they
// left the tree as is not touched, and is what comes back when the filter goes.
const closedWhileFiltering = ref(new Set<string>())
watch(sidebarQuery, () => { closedWhileFiltering.value = new Set() })

/** Whether the open endpoint is one of a group's, which is what marks it. */
function holdsCurrent(group: OperationGroup) {
  return page.value.type === 'endpoint' && group.operations.some(op => op.id === page.value.id)
}
function categoryOpen(group: OperationGroup) {
  if (filtering.value) return !closedWhileFiltering.value.has(group.tag)
  return isOpen(openCategories.value, group.tag, { categories: groups.value.length, holdsCurrent: holdsCurrent(group) })
}
function setCategoryOpen(name: string, open: boolean) {
  if (filtering.value) {
    const next = new Set(closedWhileFiltering.value)
    if (open) next.delete(name); else next.add(name)
    closedWhileFiltering.value = next
  } else {
    openCategories.value = withOpen(openCategories.value, name, open)
  }
}
function toggleCategory(group: OperationGroup) {
  setCategoryOpen(group.tag, !categoryOpen(group))
}

const everyOpen = computed(() => filteredGroups.value.every(categoryOpen))
/** Opens or closes every group on show, which under a filter is only the ones it left. */
function setEveryCategory(open: boolean) {
  const names = filteredGroups.value.map(g => g.tag)
  if (filtering.value) {
    closedWhileFiltering.value = open ? new Set() : new Set(names)
  } else {
    openCategories.value = withAll(openCategories.value, groups.value.map(g => g.tag), open)
  }
}

// Landing on an endpoint by any route but the tree - the palette, previous and
// next, a stored page - must not leave it inside a closed group, so the group
// is opened and the row scrolled to.
watch([() => page.value, groups], async () => {
  if (page.value.type !== 'endpoint') return
  const holder = groups.value.find(holdsCurrent)
  if (holder && !categoryOpen(holder) && !filtering.value) setCategoryOpen(holder.tag, true)
  await nextTick()
  navEl.value?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
}, { immediate: true })

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

// With a hundred groups open, Tab is a hundred stops long, so the arrow keys
// move between the rows on show as well: up and down through them, Home and End
// to the ends, right and left to open and close the group a heading names, and
// left on an endpoint to climb to its heading. Tab keeps working as before.
function onKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const from = event.target
  if (!(from instanceof HTMLElement) || !from.dataset.nav || !navEl.value) return
  const rows = Array.from(navEl.value.querySelectorAll<HTMLElement>('[data-nav]'))
  const at = rows.indexOf(from)
  const category = from.dataset.category
  let to: HTMLElement | undefined
  switch (event.key) {
    case 'ArrowDown': to = rows[Math.min(at + 1, rows.length - 1)]; break
    case 'ArrowUp': to = rows[Math.max(at - 1, 0)]; break
    case 'Home': to = rows[0]; break
    case 'End': to = rows[rows.length - 1]; break
    case 'ArrowRight':
    case 'ArrowLeft': {
      if (category === undefined) {
        if (event.key === 'ArrowLeft') to = from.closest('[data-group]')?.querySelector<HTMLElement>('[data-nav="group"]') ?? undefined
        break
      }
      setCategoryOpen(category, event.key === 'ArrowRight')
      event.preventDefault()
      return
    }
    default: return
  }
  event.preventDefault()
  to?.focus()
}
</script>

<template>
  <nav ref="navEl" class="flex-1 overflow-y-auto scroll px-2 py-3" aria-label="Documentation" @keydown="onKeydown">
    <div v-if="empty" class="px-3 py-8 text-center">
      <p class="text-[12.5px] text-mut">No matches for "{{ sidebarQuery }}"</p>
      <button class="btn mt-3 mx-auto" @click="sidebarQuery = ''">Clear filter</button>
    </div>

    <div v-if="filteredGroups.length" class="mb-4">
      <div class="flex items-center justify-between px-3 mb-1.5">
        <p class="eyebrow">API reference</p>
        <button
          v-if="filteredGroups.length > 1"
          class="text-[10.5px] text-dim hover:text-fg transition-colors"
          data-nav="toggle-all"
          @click="setEveryCategory(!everyOpen)"
        >
          {{ everyOpen ? 'Collapse all' : 'Expand all' }}
        </button>
      </div>
      <div v-for="grp in filteredGroups" :key="grp.tag" class="mb-1" data-group>
        <button
          class="nav-row !py-1"
          :aria-expanded="categoryOpen(grp)"
          :title="`${grp.tag} · ${grp.operations.length} ${grp.operations.length === 1 ? 'endpoint' : 'endpoints'}`"
          data-nav="group"
          :data-category="grp.tag"
          @click="toggleCategory(grp)"
        >
          <span class="sn-caret !ml-0" :class="{ open: categoryOpen(grp) }"><Icon name="i-lucide-chevron-right" :size="12" /></span>
          <span class="nav-group truncate" :class="{ 'is-active': holdsCurrent(grp) }">{{ grp.tag }}</span>
          <span class="ml-auto text-[10.5px] text-dim tnum">{{ grp.operations.length }}</span>
        </button>
        <div v-if="categoryOpen(grp)" class="mt-0.5" role="group" :aria-label="`${grp.tag} endpoints`">
          <NavOperation
            v-for="op in grp.operations" :key="op.id"
            :op="op"
            :active="page.type === 'endpoint' && page.id === op.id"
            @open="goTo({ type: 'endpoint', id: op.id })"
          />
        </div>
      </div>
    </div>

    <div v-if="filteredTags.length" class="mb-4">
      <p class="eyebrow px-3 mb-1.5">Tags</p>
      <div v-for="tag in filteredTags" :key="`tag:${tag.tag}`" class="mb-1" data-group>
        <button
          class="nav-row !py-1"
          :aria-expanded="!isTagCollapsed(tag.tag)"
          :title="tag.description"
          data-nav="group"
          @click="toggleTag(tag.tag)"
        >
          <span class="sn-caret !ml-0" :class="{ open: !isTagCollapsed(tag.tag) }"><Icon name="i-lucide-chevron-right" :size="12" /></span>
          <Icon name="i-lucide-tag" :size="11" class="shrink-0 text-dim" />
          <span class="nav-group truncate" :class="{ 'is-active': holdsCurrent(tag) }">{{ tag.tag }}</span>
          <span class="ml-auto text-[10.5px] text-dim tnum">{{ tag.operations.length }}</span>
        </button>
        <div v-if="!isTagCollapsed(tag.tag)" class="mt-0.5" role="group" :aria-label="`${tag.tag} tag endpoints`">
          <NavOperation
            v-for="op in tag.operations" :key="`tag:${tag.tag}:${op.id}`"
            :op="op"
            :active="page.type === 'endpoint' && page.id === op.id"
            @open="goTo({ type: 'endpoint', id: op.id })"
          />
        </div>
      </div>
    </div>

    <div v-if="filteredSchemas.length" class="mb-4">
      <p class="eyebrow px-3 mb-1.5">Schemas</p>
      <button
        v-for="name in filteredSchemas" :key="name"
        class="nav-row"
        :class="{ active: page.type === 'schema' && page.id === name }"
        :aria-current="page.type === 'schema' && page.id === name ? 'page' : undefined"
        data-nav="schema"
        @click="goTo({ type: 'schema', id: name })"
      >
        <Icon name="i-lucide-braces" :size="12" />
        <span class="mono text-[11.5px] truncate nav-path">{{ name }}</span>
      </button>
    </div>
  </nav>
</template>
