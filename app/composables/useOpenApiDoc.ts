import { authOptionsFor, deriveOperations, groupOperations } from '~/utils/openapi'

/** The loaded spec plus everything derived from it: operations, tag groups, schema names, auth options. */
export function useOpenApiDoc() {
  const { spec, pending, error, load, specUrl } = useOpenApiSpec()

  const operations = computed(() => deriveOperations(spec.value))
  const groups = computed(() => groupOperations(spec.value, operations.value))
  const schemaNames = computed(() => Object.keys(spec.value?.components?.schemas || {}).sort())
  const authOptions = computed(() => authOptionsFor(spec.value))

  function opById(id: string) {
    return operations.value.find(o => o.id === id) || null
  }

  return { spec, pending, error, load, specUrl, operations, groups, schemaNames, authOptions, opById }
}
