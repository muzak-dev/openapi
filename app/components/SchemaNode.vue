<script setup lang="ts">
import { constraints, enumTypeLabel, resolve, typeLabel, type JSONSchema, type OpenApiDocument } from '~/utils/openapi'

const props = withDefaults(defineProps<{
  doc: OpenApiDocument
  name?: string | null
  schema: JSONSchema
  depth?: number
  required?: boolean
  detailed?: boolean
  isRoot?: boolean
}>(), {
  name: null,
  depth: 0,
  required: false,
  detailed: false,
  isRoot: false,
})

const resolved = computed(() => resolve(props.doc, props.schema))
const sch = computed(() => resolved.value.schema)

/** For arrays, children come from the item schema. */
const container = computed(() => {
  const s = sch.value
  if (s.type === 'array') return resolve(props.doc, s.items || {}).schema
  return s
})

const children = computed(() => {
  const c = container.value
  if (!c?.properties) return []
  const req = c.required || []
  return Object.entries(c.properties).map(([key, value]) => ({ key, value, required: req.includes(key) }))
})

const expandable = computed(() => children.value.length > 0)
// Root and its immediate children start open; deeper levels start collapsed,
// so the top-level shape is visible without every nested object being asked for.
const open = ref(props.isRoot || props.depth <= 1)
const detail = ref(false)

const label = computed(() => typeLabel(props.doc, props.schema.$ref ? props.schema : sch.value))
const isRef = computed(() => !!props.schema.$ref || (sch.value.type === 'array' && !!sch.value.items?.$ref))
const desc = computed(() => props.schema.description || sch.value.description || '')
// Same chips ParamsSection shows for path/query params — surfacing them here
// too means a flat, many-field body can be scanned without clicking every row.
const chips = computed(() => {
  if (expandable.value) return []
  const out = constraints(sch.value)
  const ex = sch.value.example
  if (ex !== undefined && typeof ex !== 'object') out.push(`example: ${ex}`)
  return out
})

const detailRows = computed(() => {
  const s = sch.value
  const rows: [string, string][] = []
  rows.push(['Type', label.value])
  if (s.format) rows.push(['Format', s.format])
  rows.push(['Required', props.required ? 'yes' : 'no'])
  if (s.nullable) rows.push(['Nullable', 'yes'])
  if (s.default !== undefined) rows.push(['Default', JSON.stringify(s.default)])
  if (s.enum) rows.push([`Enum[${enumTypeLabel(s)}]`, s.enum.join(' | ')])
  if (s.pattern) rows.push(['Pattern', s.pattern])
  if (s.minimum !== undefined || s.maximum !== undefined) rows.push(['Range', `${s.minimum ?? '−∞'} … ${s.maximum ?? '∞'}`])
  if (s.minLength !== undefined || s.maxLength !== undefined) rows.push(['Length', `${s.minLength ?? 0} … ${s.maxLength ?? '∞'}`])
  if (s.example !== undefined && typeof s.example !== 'object') rows.push(['Example', JSON.stringify(s.example)])
  return rows
})

function onRow() {
  if (expandable.value) open.value = !open.value
  else detail.value = !detail.value
}
</script>

<template>
  <div>
    <button
      v-if="!isRoot"
      type="button"
      class="sn-row can"
      :aria-expanded="expandable ? String(open) : undefined"
      :aria-label="`${name}: ${label}`"
      @click="onRow"
    >
      <span v-if="expandable" class="sn-caret" :class="{ open }"><Icon name="i-lucide-chevron-right" :size="12" /></span>
      <span v-else class="sn-caret" />
      <span class="sn-name">{{ name }}</span>
      <span class="sn-type" :class="{ ref: isRef }">{{ label }}</span>
      <span v-if="required" class="chip chip-req">required</span>
      <span v-else class="chip">optional</span>
      <span v-if="sch.nullable" class="chip">nullable</span>
      <span v-if="!detailed && desc" class="sn-desc">{{ desc }}</span>
    </button>
    <p v-if="!isRoot && detailed && desc" class="text-[12px] text-mut leading-relaxed pl-[22px] pr-2 -mt-1 mb-1">{{ desc }}</p>
    <div v-if="!isRoot && detailed && chips.length" class="flex flex-wrap gap-1.5 pl-[22px] pr-2 -mt-0.5 mb-1.5">
      <span v-for="c in chips" :key="c" class="chip">{{ c }}</span>
    </div>
    <div v-if="!isRoot && detail" class="sn-detail fade-in">
      <dl>
        <template v-for="row in detailRows" :key="row[0]">
          <dt>{{ row[0] }}</dt><dd>{{ row[1] }}</dd>
        </template>
      </dl>
    </div>
    <div v-if="expandable && (isRoot || open)" :class="isRoot ? '' : 'sn-children'">
      <SchemaNode
        v-for="c in children"
        :key="c.key"
        :doc="doc"
        :name="c.key"
        :schema="c.value"
        :depth="depth + 1"
        :required="c.required"
        :detailed="detailed"
      />
    </div>
  </div>
</template>
