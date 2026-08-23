<script setup lang="ts">
import { generators, LANGUAGES } from '~/utils/codegen'
import { componentsFor, exampleFor, pretty } from '~/utils/openapi'

const props = defineProps<{
  operationId: string
}>()

const { spec, groups, operations, authOptions } = useOpenApiDoc()
const { page, server, lang, bodyView, mobileTry, expandedResponses } = useDocsState()
const { builtUrl, builtHeaders, req } = useTryIt()

const op = computed(() => operations.value.find(o => o.id === props.operationId) || null)

const baseUrl = computed(() => spec.value?.servers?.[server.value]?.url || '')

watch(op, () => { bodyView.value = 'schema' })

function prettyPath(path: string): string {
  const escaped = path.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
  return escaped.replace(/\{(\w+)\}/g, '<span style="color:var(--acc)">{$1}</span>')
}

const idempotent = computed(() => !!op.value && ['get', 'put', 'delete'].includes(op.value.verb))

const securityLabel = computed(() => {
  if (!op.value?.security.length) return 'None'
  return op.value.security.map((id) => {
    const found = authOptions.value.find(o => o.id === id)
    return found ? found.label : id
  }).join(', ')
})

const currentSnippet = computed(() => {
  if (!op.value) return ''
  const gen = generators[lang.value] || generators.curl
  const headers = { ...builtHeaders.value }
  if (!headers.Authorization && !Object.keys(headers).some(k => k.toLowerCase() !== 'content-type' && k !== 'Accept')) {
    headers.Authorization = 'Bearer YOUR_API_KEY'
  }
  try {
    return gen({ method: op.value.verb.toUpperCase(), url: builtUrl.value || `${baseUrl.value}${op.value.path}`, headers, body: op.value.requestBody ? req.value.body : null })
  } catch (e) {
    return `// Unable to render this sample: ${e instanceof Error ? e.message : 'error'}`
  }
})

const primaryResponse = computed(() => {
  if (!op.value) return null
  return op.value.responses.find(r => r.code.charAt(0) === '2') || op.value.responses[0] || null
})

const openapiForEndpoint = computed(() => {
  if (!op.value || !spec.value) return ''
  const item = spec.value.paths?.[op.value.path]
  const operation = item?.[op.value.verb]
  const pool = [op.value.requestBody?.schema, ...op.value.responses.map(r => r.schema)].filter(Boolean)
  return pretty({
    openapi: spec.value.openapi,
    info: spec.value.info,
    servers: baseUrl.value ? [{ url: baseUrl.value }] : spec.value.servers,
    paths: operation ? { [op.value.path]: { [op.value.verb]: operation } } : {},
    components: { schemas: componentsFor(spec.value, pool) },
  })
})

const allResponsesOpen = computed(() => {
  if (!op.value) return false
  return op.value.responses.every(r => !!expandedResponses.value[`${op.value!.id}:${r.code}`])
})
function toggleAllResponses() {
  if (!op.value) return
  const next = !allResponsesOpen.value
  for (const r of op.value.responses) expandedResponses.value[`${op.value.id}:${r.code}`] = next
}

const siblings = computed(() => {
  const flat = groups.value.flatMap(g => g.operations)
  const i = flat.findIndex(o => o.id === props.operationId)
  return { prev: i > 0 ? flat[i - 1] : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null }
})
</script>

<template>
  <template v-if="op">
    <nav class="flex items-center gap-1.5 text-[11.5px] text-dim mb-5" aria-label="Breadcrumb">
      <span>API Reference</span>
      <Icon name="i-lucide-chevron-right" :size="11" />
      <span>{{ op.tag }}</span>
      <Icon name="i-lucide-chevron-right" :size="11" />
      <span class="text-mut">{{ op.summary }}</span>
    </nav>

    <header>
      <h1 class="text-[22px] font-semibold tracking-[-.02em] leading-tight">{{ op.summary }}</h1>
      <p v-if="op.description" class="prose-p mt-2 max-w-[68ch]">{{ op.description }}</p>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2 min-w-0 flex-1 h-9 pl-2 pr-1 rounded-md border border-line bg-elev">
          <span class="mth-lg" :data-m="op.verb.toUpperCase()">{{ op.verb.toUpperCase() }}</span>
          <code class="mono text-[12.5px] truncate flex-1 min-w-0">
            <span class="text-dim">{{ baseUrl }}</span><span v-html="prettyPath(op.path)" />
          </code>
          <CopyButton class="!w-7 !h-7" :text="baseUrl + op.path" copy-key="url" :icon-size="13" label="Copy URL" />
        </div>
        <button class="btn btn-primary !h-9 xl:hidden" @click="mobileTry = true">
          <Icon name="i-lucide-play" :size="13" /> Try it
        </button>
      </div>

      <dl class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-md overflow-hidden border border-line bg-line">
        <div class="bg-app px-3 py-2.5">
          <dt class="eyebrow">Security</dt>
          <dd class="text-[12px] text-fg mt-0.5 truncate" :title="securityLabel">{{ securityLabel }}</dd>
        </div>
        <div class="bg-app px-3 py-2.5">
          <dt class="eyebrow">Operation ID</dt>
          <dd class="text-[12px] text-fg mt-0.5 mono truncate">{{ op.operationId || '—' }}</dd>
        </div>
        <div class="bg-app px-3 py-2.5">
          <dt class="eyebrow">Idempotent</dt>
          <dd class="text-[12px] text-fg mt-0.5">{{ idempotent ? 'Yes' : 'No' }}</dd>
        </div>
        <div class="bg-app px-3 py-2.5">
          <dt class="eyebrow">Deprecated</dt>
          <dd class="text-[12px] mt-0.5" :style="op.deprecated ? 'color:var(--warn)' : ''">{{ op.deprecated ? 'Yes' : 'No' }}</dd>
        </div>
      </dl>
    </header>

    <ParamsSection kind="path" :op="op" />
    <ParamsSection kind="query" :op="op" />
    <ParamsSection kind="header" :op="op" />

    <section v-if="op.requestBody" class="sec">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h2 class="eyebrow">Request body</h2>
        <div class="flex items-center gap-2">
          <span class="chip mono">{{ op.requestBody.contentType }}</span>
          <div class="flex items-center gap-0.5 p-0.5 rounded-md bg-elev border border-line">
            <button class="stab" :class="{ on: bodyView === 'schema' }" @click="bodyView = 'schema'">Schema</button>
            <button class="stab" :class="{ on: bodyView === 'example' }" @click="bodyView = 'example'">Example</button>
          </div>
        </div>
      </div>
      <div v-if="bodyView === 'schema'" class="rounded-md border border-line px-3 py-1.5">
        <SchemaNode :doc="spec!" :schema="op.requestBody.schema" :depth="0" is-root :detailed="true" />
      </div>
      <CodeViewer v-else lang="json" label="JSON" :code="pretty(exampleFor(spec!, op.requestBody.schema))" />
    </section>

    <section class="sec">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h2 class="eyebrow">Code examples</h2>
        <span class="text-[11px] text-dim hidden sm:inline">Reflects the values in the Try it panel</span>
      </div>
      <div class="cv">
        <div class="border-b border-line bg-elev">
          <div class="flex items-center overflow-x-auto scroll-x no-scrollbar px-1">
            <button v-for="l in LANGUAGES" :key="l.id" class="ltab" :class="{ on: lang === l.id }" @click="lang = l.id">
              <Icon :name="l.icon" :size="14" />
              {{ l.label }}
            </button>
          </div>
        </div>
        <div class="relative">
          <div class="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5">
            <CopyButton class="!w-[26px] !h-[26px] bg-codebg" :text="currentSnippet" copy-key="snippet" :icon-size="13" label="Copy code" />
          </div>
          <CodeViewer :lang="lang" :code="currentSnippet" bare :max-lines="26" />
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h2 class="eyebrow">Responses</h2>
        <button class="text-[11px] text-dim hover:text-fg transition-colors" @click="toggleAllResponses">
          {{ allResponsesOpen ? 'Collapse all' : 'Expand all' }}
        </button>
      </div>
      <div class="space-y-2">
        <ResponseCard v-for="r in op.responses" :key="r.code" :doc="spec!" :page-id="op.id" :response="r" />
      </div>
    </section>

    <section v-if="primaryResponse" class="sec">
      <div class="flex items-baseline justify-between gap-3 mb-1">
        <h2 class="text-[15px] font-semibold tracking-[-.01em]">Sample JSON response</h2>
        <span class="chip mono">JSON</span>
      </div>
      <p class="prose-p mb-3">A complete <code class="icode">{{ primaryResponse.code }}</code> body for this endpoint.</p>
      <CodeViewer lang="json" label="200 OK" :code="primaryResponse.schema ? pretty(exampleFor(spec!, primaryResponse.schema)) : '// no content'" :max-lines="30" />
    </section>

    <section class="sec">
      <div class="flex items-baseline justify-between gap-3 mb-1">
        <h2 class="text-[15px] font-semibold tracking-[-.01em]">OpenAPI schema</h2>
        <span class="chip mono">JSON / OpenAPI</span>
      </div>
      <p class="prose-p mb-3">The path item and every schema it references, with <code class="icode">$ref</code> pointers intact.</p>
      <CodeViewer lang="json" label="openapi.json" :code="openapiForEndpoint" :max-lines="34" />
    </section>

    <nav class="mt-8 pt-6 border-t border-line grid grid-cols-2 gap-3">
      <button v-if="siblings.prev" class="card p-3 text-left hover:border-line2 transition-colors" @click="page = { type: 'endpoint', id: siblings.prev.id }">
        <span class="text-[11px] text-dim">Previous</span>
        <span class="flex items-center gap-2 mt-1">
          <span class="mth" :data-m="siblings.prev.verb.toUpperCase()">{{ siblings.prev.verb.toUpperCase() }}</span>
          <span class="mono text-[12px] truncate">{{ siblings.prev.path }}</span>
        </span>
      </button><span v-else />
      <button v-if="siblings.next" class="card p-3 text-right hover:border-line2 transition-colors" @click="page = { type: 'endpoint', id: siblings.next.id }">
        <span class="text-[11px] text-dim">Next</span>
        <span class="flex items-center justify-end gap-2 mt-1">
          <span class="mth" :data-m="siblings.next.verb.toUpperCase()">{{ siblings.next.verb.toUpperCase() }}</span>
          <span class="mono text-[12px] truncate">{{ siblings.next.path }}</span>
        </span>
      </button>
    </nav>
  </template>
</template>
