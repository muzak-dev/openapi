<script setup lang="ts">
const props = withDefaults(defineProps<{
  code?: string
  lang?: string
  label?: string
  maxLines?: number
  bare?: boolean
}>(), {
  code: '',
  lang: 'code',
  label: '',
  maxLines: 22,
  bare: false,
})

const { copy } = useClipboard()
const { highlight } = useHighlighter()
const expanded = ref(false)
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const lines = computed(() => props.code.split('\n'))
const clamped = computed(() => !expanded.value && lines.value.length > props.maxLines)
const maxH = computed(() => (clamped.value ? `${Math.round(props.maxLines * 20.2) + 20}px` : 'none'))

// Shiki highlighting is async (lazy-loads grammars/themes); render a plain
// fallback until the real tokenized HTML for the current code/lang lands.
const html = ref('')
let seq = 0
watchEffect(async () => {
  const code = props.code
  const lang = props.lang
  const mySeq = ++seq
  const result = await highlight(code, lang)
  if (mySeq === seq) html.value = result
})

function doCopy() {
  copy(props.code)
  copied.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { copied.value = false }, 1300)
}
</script>

<template>
  <div :class="bare ? '' : 'cv'">
    <div v-if="!bare" class="cv-head">
      <span class="mono text-[10.5px] tracking-[.05em] uppercase text-dim">{{ label || lang }}</span>
      <span class="mono text-[10.5px] text-dim ml-auto tnum">{{ lines.length }} lines</span>
      <button
        v-if="lines.length > maxLines"
        class="icon-btn !w-[26px] !h-[26px]"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        :title="expanded ? 'Collapse' : 'Expand'"
        @click="expanded = !expanded"
      >
        <Icon :name="expanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'" :size="12" />
      </button>
      <button
        class="icon-btn !w-[26px] !h-[26px]"
        :aria-label="copied ? 'Copied' : 'Copy code'"
        :title="copied ? 'Copied' : 'Copy'"
        @click="doCopy"
      >
        <Icon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" :size="12" />
      </button>
    </div>
    <div class="relative">
      <div class="cv-body scroll" :style="{ maxHeight: maxH, overflowY: clamped ? 'hidden' : 'auto' }">
        <div v-if="html" class="shiki-wrap mono" v-html="html" />
        <div v-else class="cv-body-plain">
          <pre class="cv-gutter mono">{{ lines.map((_, i) => i + 1).join('\n') }}</pre>
          <pre class="cv-code mono"><code>{{ code }}</code></pre>
        </div>
      </div>
      <div v-if="clamped" class="cv-fade" />
      <button v-if="clamped" class="absolute left-1/2 -translate-x-1/2 bottom-2 btn !h-6 !text-[11px] z-10" @click="expanded = true">
        Show all {{ lines.length }} lines
      </button>
    </div>
  </div>
</template>
