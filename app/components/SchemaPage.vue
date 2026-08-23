<script setup lang="ts">
import { componentsFor, exampleFor, pretty } from '~/utils/openapi'

const props = defineProps<{
  name: string
}>()

const { spec, operations } = useOpenApiDoc()
const { page } = useDocsState()

const schema = computed(() => spec.value?.components?.schemas?.[props.name] || null)
const rootRef = computed(() => ({ $ref: `#/components/schemas/${props.name}` }))

const example = computed(() => (spec.value ? pretty(exampleFor(spec.value, rootRef.value)) : ''))
const definition = computed(() => (schema.value ? pretty({ [props.name]: schema.value }) : ''))

const usedBy = computed(() => {
  if (!spec.value) return []
  return operations.value.filter((op) => {
    const pool = [op.requestBody?.schema, ...op.responses.map(r => r.schema)].filter(Boolean)
    return Object.prototype.hasOwnProperty.call(componentsFor(spec.value!, pool), props.name)
  })
})
</script>

<template>
  <template v-if="schema">
    <nav class="flex items-center gap-1.5 text-[11.5px] text-dim mb-5" aria-label="Breadcrumb">
      <span>API Reference</span>
      <Icon name="i-lucide-chevron-right" :size="11" />
      <span>Schemas</span>
      <Icon name="i-lucide-chevron-right" :size="11" />
      <span class="text-mut mono">{{ name }}</span>
    </nav>

    <header>
      <div class="flex items-center gap-2.5">
        <span class="w-7 h-7 rounded-md grid place-items-center border border-line bg-elev text-acc">
          <Icon name="i-lucide-braces" :size="14" />
        </span>
        <h1 class="text-[21px] font-semibold tracking-[-.02em] mono">{{ name }}</h1>
      </div>
      <p class="prose-p mt-2.5 max-w-[70ch]">{{ schema.description || 'Object schema.' }}</p>
      <div class="flex flex-wrap gap-1.5 mt-3">
        <span class="chip mono">{{ schema.type || 'object' }}</span>
        <span class="chip mono">{{ Object.keys(schema.properties || {}).length }} properties</span>
        <span class="chip mono">{{ (schema.required || []).length }} required</span>
      </div>
    </header>

    <section class="sec mt-2">
      <h2 class="eyebrow mb-3">Properties</h2>
      <div class="rounded-md border border-line px-3 py-1.5">
        <SchemaNode :doc="spec!" :schema="rootRef" :depth="0" is-root :detailed="true" />
      </div>
    </section>

    <section class="sec">
      <h2 class="eyebrow mb-3">Example</h2>
      <CodeViewer lang="json" label="JSON" :code="example" :max-lines="28" />
    </section>

    <section class="sec">
      <h2 class="eyebrow mb-3">OpenAPI definition</h2>
      <CodeViewer lang="json" label="components.schemas" :code="definition" :max-lines="30" />
    </section>

    <section v-if="usedBy.length" class="sec">
      <h2 class="eyebrow mb-3">Used by</h2>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="op in usedBy" :key="op.id"
          class="flex items-center gap-2 h-7 px-2 rounded-md border border-line bg-elev hover:border-line2 transition-colors"
          @click="page = { type: 'endpoint', id: op.id }"
        >
          <span class="mth" :data-m="op.verb.toUpperCase()">{{ op.verb.toUpperCase() }}</span>
          <span class="mono text-[11.5px] text-mut">{{ op.path }}</span>
        </button>
      </div>
    </section>
  </template>
</template>
