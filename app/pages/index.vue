<script setup lang="ts">
const { pending, error, operations, schemaNames, opById } = useOpenApiDoc()
const { page } = useDocsState()

// Land on the first operation (or schema, if the doc has none) once the spec
// loads, unless a persisted page selection from a previous visit still resolves.
watch([operations, schemaNames], () => {
  if (!operations.value.length && !schemaNames.value.length) return
  const validEndpoint = page.value.type === 'endpoint' && !!opById(page.value.id)
  const validSchema = page.value.type === 'schema' && schemaNames.value.includes(page.value.id)
  if (validEndpoint || validSchema) return
  if (operations.value.length) page.value = { type: 'endpoint', id: operations.value[0].id }
  else page.value = { type: 'schema', id: schemaNames.value[0] }
}, { immediate: true })
</script>

<template>
  <div v-if="pending" class="py-24 text-center text-mut text-[13px]">Loading…</div>
  <div v-else-if="error" class="card p-5 text-center">
    <p class="text-[13px] font-medium" style="color:var(--err)">Could not load the OpenAPI document</p>
    <p class="text-[12px] text-mut mt-1">{{ error }}</p>
  </div>
  <template v-else>
    <EndpointPage v-if="page.type === 'endpoint'" :operation-id="page.id" />
    <SchemaPage v-else-if="page.type === 'schema'" :name="page.id" />
  </template>
</template>
