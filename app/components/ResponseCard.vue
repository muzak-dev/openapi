<script setup lang="ts">
import { componentsFor, exampleFor, pretty, type OpenApiDocument, type OperationResponse } from '~/utils/openapi'

const props = defineProps<{
  doc: OpenApiDocument
  pageId: string
  response: OperationResponse
}>()

const { expandedResponses, responseTabs } = useDocsState()

const key = computed(() => `${props.pageId}:${props.response.code}`)
const isOpen = computed(() => !!expandedResponses.value[key.value])
function toggle() { expandedResponses.value[key.value] = !expandedResponses.value[key.value] }

const activeTab = computed(() => responseTabs.value[key.value] || 'Preview')
function setTab(t: string) { responseTabs.value[key.value] = t }

const openapiSnippet = computed(() => {
  const r = props.response
  return pretty({
    [r.code]: r.schema
      ? { description: r.description, content: { 'application/json': { schema: r.schema } } }
      : { description: r.description },
    ...(r.schema ? { components: { schemas: componentsFor(props.doc, [r.schema]) } } : {}),
  })
})
</script>

<template>
  <div class="card overflow-hidden">
    <button class="w-full flex items-center gap-3 px-3 h-[42px] text-left hover:bg-elev transition-colors" :aria-expanded="isOpen" @click="toggle">
      <span class="st w-[46px] shrink-0" :data-s="String(response.code)[0]">{{ response.code }}</span>
      <code v-if="response.name" class="mono text-[12px] font-medium shrink-0">{{ response.name }}</code>
      <span class="text-[12px] text-dim truncate hidden sm:block">{{ response.description }}</span>
      <span class="sn-caret ml-auto" :class="{ open: isOpen }"><Icon name="i-lucide-chevron-right" :size="13" /></span>
    </button>

    <div v-if="isOpen" class="border-t border-line">
      <div class="flex items-center gap-0.5 px-2.5 py-2 border-b border-line bg-elev">
        <button v-for="t in ['Preview', 'Schema', 'JSON', 'OpenAPI']" :key="t" class="stab" :class="{ on: activeTab === t }" @click="setTab(t)">{{ t }}</button>
      </div>
      <div class="p-3">
        <p class="text-[12.5px] text-mut mb-2 sm:hidden">{{ response.description }}</p>

        <template v-if="activeTab === 'Preview'">
          <div v-if="response.schema" class="px-1">
            <SchemaNode :doc="doc" :schema="response.schema" :depth="0" is-root :detailed="false" />
          </div>
          <p v-else class="text-[12.5px] text-dim mono">No response body.</p>
        </template>

        <template v-else-if="activeTab === 'Schema'">
          <div v-if="response.schema" class="px-1">
            <SchemaNode :doc="doc" :schema="response.schema" :depth="0" is-root :detailed="true" />
          </div>
          <p v-else class="text-[12.5px] text-dim mono">No response body.</p>
        </template>

        <CodeViewer v-else-if="activeTab === 'JSON'" lang="json" label="JSON" :code="response.schema ? pretty(exampleFor(doc, response.schema)) : '// no content'" />

        <CodeViewer v-else lang="json" label="OpenAPI 3.0.3" :code="openapiSnippet" :max-lines="30" />
      </div>
    </div>
  </div>
</template>
