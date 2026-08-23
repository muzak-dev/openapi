// Schema resolution, example/type derivation, and Pydantic generation for an
// arbitrary real OpenAPI 3.x document — no hardcoded/mock data anywhere here.

export type HttpVerb = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'
export const HTTP_VERBS: HttpVerb[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

export interface JSONSchema {
  $ref?: string
  type?: string | string[]
  format?: string
  description?: string
  title?: string
  default?: unknown
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  anyOf?: JSONSchema[]
  oneOf?: JSONSchema[]
  allOf?: JSONSchema[]
  enum?: unknown[]
  examples?: unknown[]
  example?: unknown
  nullable?: boolean
  additionalProperties?: boolean | JSONSchema
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
  [key: string]: unknown
}

export interface OpenApiParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required?: boolean
  description?: string
  schema?: JSONSchema
}

export interface OpenApiMediaType {
  schema?: JSONSchema
}

export interface OpenApiResponse {
  description?: string
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  deprecated?: boolean
  tags?: string[]
  security?: Record<string, string[]>[]
  parameters?: OpenApiParameter[]
  requestBody?: {
    required?: boolean
    content?: Record<string, OpenApiMediaType>
  }
  responses?: Record<string, OpenApiResponse>
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  scheme?: string
  in?: 'header' | 'query' | 'cookie'
  name?: string
  bearerFormat?: string
  description?: string
}

export interface OpenApiDocument {
  openapi?: string
  info: {
    title: string
    version: string
    description?: string
  }
  paths?: Record<string, Partial<Record<HttpVerb, OpenApiOperation>>>
  components?: {
    schemas?: Record<string, JSONSchema>
    securitySchemes?: Record<string, SecurityScheme>
  }
  tags?: { name: string, description?: string }[]
  servers?: { url: string, description?: string }[]
  security?: Record<string, string[]>[]
}

export function refName(schema?: JSONSchema): string | null {
  if (schema && typeof schema.$ref === 'string') return schema.$ref.split('/').pop() ?? null
  return null
}

/**
 * Resolves a schema, following ref-to-ref chains, and merges any sibling
 * keys declared alongside a `$ref` (e.g. a property-level `description` or
 * `nullable` override) onto the resolved target — matching how a reader
 * expects `{ $ref: '#/…/Geo', nullable: true }` to behave.
 */
export function resolve(doc: OpenApiDocument, schema?: JSONSchema): { schema: JSONSchema, name: string | null } {
  let node = schema
  let name: string | null = null
  let guard = 0
  while (node?.$ref && guard++ < 20) {
    name = refName(node)
    const target = name ? doc.components?.schemas?.[name] : undefined
    const local = { ...node }
    delete local.$ref
    node = { ...(target || {}), ...local }
  }
  return { schema: node || {}, name }
}

function isNullVariant(s: JSONSchema): boolean {
  return s.type === 'null'
}

export function typeLabel(doc: OpenApiDocument, schema?: JSONSchema): string {
  if (!schema) return 'any'
  if (schema.$ref) return refName(schema) || 'object'
  const variants = schema.anyOf || schema.oneOf
  if (Array.isArray(variants) && variants.length) {
    const nonNull = variants.filter(v => !isNullVariant(v))
    const hasNull = nonNull.length !== variants.length || schema.nullable
    const labels = nonNull.map(v => typeLabel(doc, v))
    const joined = labels.length ? labels.join(' | ') : 'any'
    return hasNull ? joined + ' | null' : joined
  }
  if (schema.type === 'array') return typeLabel(doc, schema.items) + '[]'
  if (schema.format === 'date-time') return 'datetime'
  if (schema.format === 'email') return 'email'
  if (schema.format === 'uri' || schema.format === 'url') return 'url'
  if (schema.type === 'integer') return 'integer'
  if (schema.type === 'number') return 'number'
  const t = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type
  return t || 'object'
}

const PY_TYPE: Record<string, string> = { string: 'str', integer: 'int', number: 'float', boolean: 'bool' }

/** `string`/`integer`/… -> `str`/`int`/…, falling back to the JS type of the first enum value. */
export function enumTypeLabel(schema: JSONSchema): string {
  const t = Array.isArray(schema.type) ? schema.type[0] : schema.type
  if (t && PY_TYPE[t]) return PY_TYPE[t]
  const sample = schema.enum?.[0]
  if (typeof sample === 'number') return Number.isInteger(sample) ? 'int' : 'float'
  if (typeof sample === 'boolean') return 'bool'
  return 'str'
}

export function constraints(schema?: JSONSchema): string[] {
  if (!schema) return []
  const out: string[] = []
  const keys: (keyof JSONSchema)[] = ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'format', 'default']
  for (const k of keys) {
    if (schema[k] !== undefined) out.push(`${k}: ${schema[k]}`)
  }
  if (schema.enum) out.push(`Enum[${enumTypeLabel(schema)}]: ${schema.enum.join(' | ')}`)
  const variants = schema.anyOf || schema.oneOf
  if (schema.nullable || (Array.isArray(variants) && variants.some(isNullVariant))) out.push('nullable')
  return out
}

/** Builds a realistic JSON example from a schema, preferring declared examples/defaults. */
export function exampleFor(doc: OpenApiDocument, schema?: JSONSchema, depth = 0): unknown {
  if (!schema || depth > 8) return null
  const { schema: sch } = resolve(doc, schema)
  if (sch.example !== undefined) return sch.example
  if (Array.isArray(sch.examples) && sch.examples.length) return sch.examples[0]
  const variants = sch.anyOf || sch.oneOf
  if (Array.isArray(variants) && variants.length) {
    const nonNull = variants.find(v => !isNullVariant(v))
    return exampleFor(doc, nonNull || variants[0], depth + 1)
  }
  if (sch.type === 'array') return [exampleFor(doc, sch.items || {}, depth + 1)]
  if (sch.properties) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sch.properties)) out[k] = exampleFor(doc, v, depth + 1)
    return out
  }
  if (sch.default !== undefined) return sch.default
  if (sch.enum) return sch.enum[0]
  switch (sch.type) {
    case 'string': return sch.format === 'date-time' ? '2026-08-21T14:32:05Z' : 'string'
    case 'integer': return 0
    case 'number': return 0
    case 'boolean': return true
    case 'object': return sch.additionalProperties ? { key: 'value' } : {}
    default: return null
  }
}

export const pretty = (v: unknown): string => JSON.stringify(v, null, 2)

/** Collects every named schema a schema (transitively) depends on via $ref. */
export function collectRefs(doc: OpenApiDocument, schema: unknown, acc: Set<string> = new Set()): Set<string> {
  if (!schema || typeof schema !== 'object') return acc
  const s = schema as JSONSchema
  if (s.$ref) {
    const n = refName(s)
    if (n && !acc.has(n)) {
      acc.add(n)
      collectRefs(doc, doc.components?.schemas?.[n], acc)
    }
  }
  for (const v of Object.values(s)) {
    if (v && typeof v === 'object') collectRefs(doc, v, acc)
  }
  return acc
}

export function componentsFor(doc: OpenApiDocument, schemaList: (JSONSchema | undefined | null)[]): Record<string, JSONSchema> {
  const acc = new Set<string>()
  for (const s of schemaList) {
    if (s) collectRefs(doc, s, acc)
  }
  const out: Record<string, JSONSchema> = {}
  for (const n of Array.from(acc).sort()) {
    const target = doc.components?.schemas?.[n]
    if (target) out[n] = target
  }
  return out
}

export interface SchemaField {
  name: string
  type: string
  required: boolean
  description: string
}

export function schemaFields(doc: OpenApiDocument, schema?: JSONSchema): SchemaField[] {
  const { schema: s } = resolve(doc, schema)
  const props = s?.properties
  if (!props || !Object.keys(props).length) return []
  const required = s?.required || []
  return Object.entries(props).map(([name, p]) => ({
    name,
    type: typeLabel(doc, p),
    required: required.includes(name),
    description: p.description || '',
  }))
}

export type StatusTone = 'success' | 'info' | 'warning' | 'error'

export function statusTone(code: string): StatusTone {
  const c = code.charAt(0)
  if (c === '2') return 'success'
  if (c === '3') return 'info'
  if (c === '4') return 'warning'
  return 'error'
}

export function operationAnchor(path: string, verb: string): string {
  return `op-${verb}-${path.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

export interface OperationResponse {
  code: string
  name: string | null
  description: string
  schema: JSONSchema | null
}

export interface OperationEntry {
  id: string
  path: string
  verb: HttpVerb
  tag: string
  summary: string
  description: string
  deprecated: boolean
  operationId: string
  parameters: OpenApiParameter[]
  requestBody: { contentType: string, required: boolean, schema: JSONSchema } | null
  responses: OperationResponse[]
  security: string[]
  searchText: string
}

export interface OperationGroup {
  tag: string
  description: string
  operations: OperationEntry[]
}

function firstJsonContent(content?: Record<string, OpenApiMediaType>): { contentType: string, media: OpenApiMediaType } | null {
  if (!content) return null
  const jsonKey = Object.keys(content).find(k => k.includes('json'))
  const key = jsonKey || Object.keys(content)[0]
  if (!key) return null
  return { contentType: key, media: content[key] }
}

/** Flattens every operation in the document into a stable, groupable, searchable list. */
export function deriveOperations(doc?: OpenApiDocument | null): OperationEntry[] {
  if (!doc?.paths) return []
  const out: OperationEntry[] = []
  for (const path of Object.keys(doc.paths).sort()) {
    const item = doc.paths[path]
    for (const verb of HTTP_VERBS) {
      const op = item?.[verb]
      if (!op) continue
      const body = firstJsonContent(op.requestBody?.content)
      const responses: OperationResponse[] = Object.entries(op.responses || {}).map(([code, r]) => {
        const json = firstJsonContent(r.content)
        return {
          code,
          name: json ? refName(json.media.schema) : null,
          description: r.description || '',
          schema: json?.media.schema || null,
        }
      }).sort((a, b) => {
        if (a.code === 'default') return 1
        if (b.code === 'default') return -1
        return Number(a.code) - Number(b.code)
      })
      out.push({
        id: operationAnchor(path, verb),
        path,
        verb,
        tag: op.tags?.[0] || 'default',
        summary: op.summary || `${verb.toUpperCase()} ${path}`,
        description: op.description || '',
        deprecated: !!op.deprecated,
        operationId: op.operationId || '',
        parameters: op.parameters || [],
        requestBody: body ? { contentType: body.contentType, required: !!op.requestBody?.required, schema: body.media.schema || {} } : null,
        responses,
        security: (op.security || doc.security || []).flatMap(s => Object.keys(s)),
        searchText: `${verb} ${path} ${op.summary || ''} ${op.operationId || ''}`.toLowerCase(),
      })
    }
  }
  return out
}

export function groupOperations(doc: OpenApiDocument | null | undefined, operations: OperationEntry[]): OperationGroup[] {
  const order: string[] = []
  const byTag = new Map<string, OperationEntry[]>()
  for (const op of operations) {
    if (!byTag.has(op.tag)) { byTag.set(op.tag, []); order.push(op.tag) }
    byTag.get(op.tag)!.push(op)
  }
  const descriptions = new Map((doc?.tags || []).map(t => [t.name, t.description || '']))
  return order.sort((a, b) => a.localeCompare(b)).map(tag => ({
    tag,
    description: descriptions.get(tag) || '',
    operations: byTag.get(tag) || [],
  }))
}

export function paramsOf(op: OperationEntry | null | undefined, where: OpenApiParameter['in']): OpenApiParameter[] {
  if (!op) return []
  return op.parameters.filter(p => p.in === where)
}

/** Named auth mechanisms actually declared by the document, in place of the assumed bearer/apiKey/basic/oauth set. */
export interface AuthOption {
  id: string
  scheme: SecurityScheme
  label: string
}

export function authOptionsFor(doc: OpenApiDocument | null | undefined): AuthOption[] {
  const schemes = doc?.components?.securitySchemes
  if (!schemes) return []
  return Object.entries(schemes).map(([id, scheme]) => ({
    id,
    scheme,
    label: labelForScheme(scheme),
  }))
}

// Short on purpose — this shows up in tight spots (the metadata strip, the
// scheme picker). The header/query name it actually uses is one click away
// in the auth modal, so it doesn't need to be spelled out here too.
function labelForScheme(scheme: SecurityScheme): string {
  if (scheme.type === 'http' && scheme.scheme === 'bearer') return 'Bearer token'
  if (scheme.type === 'http' && scheme.scheme === 'basic') return 'Basic auth'
  if (scheme.type === 'apiKey') return scheme.in === 'query' ? 'API key (query)' : 'API key'
  if (scheme.type === 'oauth2') return 'OAuth 2.0'
  if (scheme.type === 'openIdConnect') return 'OpenID Connect'
  return scheme.type
}
