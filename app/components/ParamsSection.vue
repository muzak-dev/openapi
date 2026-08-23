<script setup lang="ts">
import { constraints, paramsOf, typeLabel, type OperationEntry } from '~/utils/openapi'

const props = defineProps<{
  kind: 'path' | 'query' | 'header'
  op: OperationEntry
}>()

const { spec } = useOpenApiDoc()

const items = computed(() => paramsOf(props.op, props.kind))
const title = computed(() => ({ path: 'Path parameters', query: 'Query parameters', header: 'Request headers' }[props.kind]))

// Most specs put the description on the parameter itself, but some (this
// fal.ai one included) nest it in the parameter's schema instead.
function describe(p: { description?: string, schema?: { description?: string } }): string {
  return p.description || p.schema?.description || ''
}
</script>

<template>
  <section v-if="items.length" class="sec">
    <h2 class="eyebrow mb-3">{{ title }}</h2>
    <div>
      <div v-for="p in items" :key="p.name" class="param">
        <div class="flex items-baseline gap-2 flex-wrap">
          <code class="mono text-[12.5px] font-medium">{{ p.name }}</code>
          <span class="mono text-[11px] text-dim">{{ typeLabel(spec!, p.schema) }}</span>
          <span v-if="kind === 'path'" class="chip chip-req">required</span>
          <span v-else class="chip" :class="p.required ? 'chip-req' : ''">{{ p.required ? 'required' : 'optional' }}</span>
          <span v-if="kind === 'path' && p.schema?.example !== undefined" class="mono text-[11px] text-dim ml-auto">
            example: <span class="text-mut">{{ p.schema.example }}</span>
          </span>
          <span v-else-if="kind === 'query' && p.schema?.default !== undefined" class="mono text-[11px] text-dim ml-auto">
            default: {{ p.schema.default }}
          </span>
        </div>
        <p v-if="describe(p)" class="text-[12.5px] text-mut mt-1 leading-relaxed">{{ describe(p) }}</p>
        <div v-if="kind !== 'header' && constraints(p.schema).length" class="flex flex-wrap gap-1.5 mt-2">
          <span v-for="c in constraints(p.schema)" :key="c" class="chip">{{ c }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
