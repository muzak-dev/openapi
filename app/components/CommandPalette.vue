<script setup lang="ts">
import { pretty } from '~/utils/openapi'

const { spec, operations, schemaNames } = useOpenApiDoc()
const { page, sidebarOpen, authModal, paletteOpen, paletteQuery, paletteIndex } = useDocsState()
const { copy } = useCopyFeedback()
const colorMode = useColorMode()

const paletteInput = useTemplateRef<HTMLInputElement>('paletteInput')

const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

defineShortcuts({
  meta_k: () => { paletteOpen.value ? (paletteOpen.value = false) : openPalette() },
  '/': () => openPalette(),
})

function fuzzy(needle: string, hay: unknown): number {
  if (!needle) return 1
  const n = needle.toLowerCase()
  const h = String(hay ?? '').toLowerCase()
  const direct = h.indexOf(n)
  if (direct >= 0) return 1000 - direct
  let i = 0
  let score = 0
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) { i++; score++ }
  }
  return i === n.length ? score : 0
}

interface Row {
  group: string
  kind: 'endpoint' | 'schema' | 'action'
  key: string
  title: string
  sub: string
  method?: string
  icon?: string
  score: number
  to?: { type: 'endpoint' | 'schema', id: string }
  run?: () => void
  index: number
}

const results = computed<Row[]>(() => {
  const q = paletteQuery.value.trim()
  const rows: Omit<Row, 'index'>[] = []

  for (const o of operations.value) {
    const sc = Math.max(fuzzy(q, o.path), fuzzy(q, o.summary), fuzzy(q, `${o.verb} ${o.path}`), fuzzy(q, o.tag))
    if (sc) rows.push({ group: 'Endpoints', kind: 'endpoint', key: `e${o.id}`, title: o.path, sub: `${o.summary} · ${o.tag}`, method: o.verb.toUpperCase(), score: sc, to: { type: 'endpoint', id: o.id } })
  }
  for (const n of schemaNames.value) {
    const sc = fuzzy(q, n)
    if (sc) rows.push({ group: 'Schemas', kind: 'schema', key: `s${n}`, title: n, sub: (spec.value?.components?.schemas?.[n]?.description || '').slice(0, 60), icon: 'i-lucide-braces', score: sc, to: { type: 'schema', id: n } })
  }
  const actions = [
    { title: 'Authenticate', run: () => { authModal.value = true }, icon: 'i-lucide-key-round' },
    { title: 'Toggle dark mode', run: () => { colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark' }, icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon' },
    { title: 'Copy OpenAPI document', run: () => { if (spec.value) copy(pretty(spec.value), 'spec') }, icon: 'i-lucide-download' },
    { title: 'Toggle sidebar', run: () => { sidebarOpen.value = !sidebarOpen.value }, icon: 'i-lucide-panel-left' },
  ]
  for (const [i, a] of actions.entries()) {
    const sc = fuzzy(q, a.title)
    if (sc) rows.push({ group: 'Actions', kind: 'action', key: `a${i}`, title: a.title, sub: '', icon: a.icon, score: sc, run: a.run })
  }

  rows.sort((a, b) => b.score - a.score)
  const order: Record<string, number> = { Endpoints: 0, Schemas: 1, Actions: 2 }
  rows.sort((a, b) => order[a.group] - order[b.group])
  return rows.slice(0, 24).map((r, i) => ({ ...r, index: i }))
})

const groups = computed(() => {
  const out: { label: string, items: Row[] }[] = []
  for (const r of results.value) {
    let g = out.find(x => x.label === r.group)
    if (!g) { g = { label: r.group, items: [] }; out.push(g) }
    g.items.push(r)
  }
  return out
})

function openPalette() {
  paletteOpen.value = true
  paletteQuery.value = ''
  paletteIndex.value = 0
  nextTick(() => paletteInput.value?.focus())
}
function moveResult(delta: number) {
  const n = results.value.length
  if (!n) return
  paletteIndex.value = (paletteIndex.value + delta + n) % n
}
function runResult(item?: Row) {
  const target = item || results.value[paletteIndex.value]
  if (!target) return
  if (target.run) { paletteOpen.value = false; target.run() } else if (target.to) { page.value = target.to; paletteOpen.value = false }
}

watch(paletteQuery, () => { paletteIndex.value = 0 })
</script>

<template>
  <template v-if="paletteOpen">
    <div class="overlay" @click="paletteOpen = false" />
    <div
      class="fixed z-[80] left-1/2 top-[10vh] -translate-x-1/2 w-[calc(100%-2rem)] max-w-[560px] pop overflow-hidden fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      <div class="flex items-center gap-2.5 px-3.5 h-[46px] border-b border-line">
        <span class="text-dim"><Icon name="i-lucide-search" :size="15" /></span>
        <input
          ref="paletteInput"
          v-model="paletteQuery"
          class="flex-1 bg-transparent text-[13.5px] text-fg placeholder:text-dim"
          placeholder="Search endpoints, schemas, actions…"
          aria-label="Search query"
          @keydown.down.prevent="moveResult(1)"
          @keydown.up.prevent="moveResult(-1)"
          @keydown.enter.prevent="runResult()"
          @keydown.esc="paletteOpen = false"
        >
        <span class="kbd">esc</span>
      </div>
      <div class="max-h-[52vh] overflow-y-auto scroll py-2">
        <div v-if="!results.length" class="px-4 py-10 text-center">
          <p class="text-[12.5px] text-mut">Nothing matches "{{ paletteQuery }}"</p>
          <p class="text-[11.5px] text-dim mt-1">Try an endpoint path, a schema name, or "auth".</p>
        </div>
        <template v-for="grp in groups" :key="grp.label">
          <p class="eyebrow px-4 pt-2 pb-1">{{ grp.label }}</p>
          <button
            v-for="item in grp.items" :key="item.key"
            class="w-full flex items-center gap-2.5 px-4 py-1.5 text-left"
            :style="item.index === paletteIndex ? 'background:var(--acc-soft)' : ''"
            @mousemove="paletteIndex = item.index"
            @click="runResult(item)"
          >
            <span v-if="item.kind === 'endpoint'" class="mth w-[38px] text-right shrink-0" :data-m="item.method">{{ item.method }}</span>
            <span v-else class="w-[38px] flex justify-end text-dim shrink-0"><Icon :name="item.icon!" :size="13" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate" :class="item.kind === 'action' ? 'text-[12.5px]' : 'mono text-[12px]'">{{ item.title }}</span>
              <span v-if="item.sub" class="block text-[11px] text-dim truncate">{{ item.sub }}</span>
            </span>
            <span v-if="item.index === paletteIndex" class="kbd shrink-0">↵</span>
          </button>
        </template>
      </div>
      <div class="flex items-center gap-3 px-3.5 h-9 border-t border-line bg-elev text-[11px] text-dim">
        <span class="flex items-center gap-1"><span class="kbd">↑</span><span class="kbd">↓</span> navigate</span>
        <span class="flex items-center gap-1"><span class="kbd">↵</span> open</span>
        <span class="flex items-center gap-1 ml-auto"><span class="kbd">{{ modKey }} K</span> toggle</span>
      </div>
    </div>
  </template>
</template>
