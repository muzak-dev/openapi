// How an operation's category and title are read out of the document, and how
// the reference tree is grouped and ordered from them. Run with `pnpm test`.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  categoryOf, categoryOrder, deriveOperations, deriveTagIndex, groupOperations, textOf,
  type OpenApiDocument, type OpenApiOperation,
} from '../app/utils/openapi.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/categories.openapi.json', import.meta.url), 'utf8')) as OpenApiDocument

/** A document of one GET operation per entry, at /p0, /p1, ... in the order given. */
function docOf(...ops: Partial<OpenApiOperation>[]): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {}
  ops.forEach((op, i) => { paths![`/p${i}`] = { get: { responses: {}, ...op } as OpenApiOperation } })
  return { info: { title: 't', version: '1' }, paths }
}
const derive = (...ops: Partial<OpenApiOperation>[]) => deriveOperations(docOf(...ops))

test('x-category is the category, trimmed, ahead of the first tag', () => {
  const [op] = derive({ 'x-category': '  Billing ', tags: ['invoices', 'audit'] })
  assert.equal(op.category, 'Billing')
  assert.equal(op.categoryDeclared, true)
  // tags are untouched: they are still every label the route carries
  assert.deepEqual(op.tags, ['invoices', 'audit'])
})

test('without x-category the first tag is the category, as it was', () => {
  const [op] = derive({ tags: ['invoices', 'audit'] })
  assert.equal(op.category, 'invoices')
  assert.equal(op.categoryDeclared, false)
})

test('without either the category is default', () => {
  for (const o of [{}, { tags: [] }, { tags: [''] }, { tags: ['   '] }]) {
    const [op] = derive(o)
    assert.equal(op.category, 'default', JSON.stringify(o))
  }
})

test('an empty or blank x-category falls back to the first tag', () => {
  for (const blank of ['', ' ', '\t\n ']) {
    const [op] = derive({ 'x-category': blank, tags: ['billing'] })
    assert.equal(op.category, 'billing', JSON.stringify(blank))
    assert.equal(op.categoryDeclared, false)
  }
  assert.equal(derive({ 'x-category': '' })[0].category, 'default')
})

test('x-title labels the operation, trimmed, and the path is the label without one', () => {
  const [titled, plain] = derive({ 'x-title': '  Fetch User Profile ' }, {})
  assert.equal(titled.title, 'Fetch User Profile')
  assert.equal(titled.label, 'Fetch User Profile')
  assert.equal(titled.path, '/p0', 'the path is kept for the tooltip')
  assert.equal(plain.title, '')
  assert.equal(plain.label, '/p1')
})

test('a blank x-title is no title', () => {
  for (const blank of ['', '   ', '\n']) {
    const [op] = derive({ 'x-title': blank })
    assert.equal(op.title, '', JSON.stringify(blank))
    assert.equal(op.label, '/p0')
  }
})

test('an extension that is not a string is ignored, never coerced', () => {
  const bad: unknown[] = [42, 0, true, false, null, {}, { toString: () => 'x' }, ['Billing'], [], 1n as unknown]
  for (const value of bad) {
    // 1n cannot be JSON, but a caller can hand the derivation any value
    const [op] = derive({ 'x-category': value, 'x-title': value, tags: ['billing'] })
    assert.equal(op.category, 'billing', String(typeof value))
    assert.equal(op.categoryDeclared, false)
    assert.equal(op.title, '')
    assert.equal(op.label, '/p0')
  }
})

test('textOf reads only strings', () => {
  assert.equal(textOf(' a '), 'a')
  assert.equal(textOf(''), '')
  for (const v of [undefined, null, 1, true, {}, [], () => 'x']) assert.equal(textOf(v), '')
})

test('a category is text: markup and lookalike names pass through untouched', () => {
  // Rendering is Vue interpolation, which escapes; the derivation must not
  // rewrite or interpret the value either.
  const html = '<img src=x onerror=alert(1)>'
  const [op] = derive({ 'x-category': html, 'x-title': '<b>Bold</b> & co' })
  assert.equal(op.category, html)
  assert.equal(op.title, '<b>Bold</b> & co')
  const names = ['__proto__', 'constructor', 'toString', 'hasOwnProperty']
  const groups = groupOperations(null, derive(...names.map(n => ({ 'x-category': n }))))
  assert.deepEqual(groups.map(g => g.tag).sort(), [...names].sort())
  assert.ok(groups.every(g => g.operations.length === 1))
})

test('categoryOf tolerates tags that are not an array', () => {
  assert.equal(categoryOf({ tags: 'billing' as unknown as string[] }).category, 'default')
  assert.equal(categoryOf({ tags: [7 as unknown as string] }).category, 'default')
})

test('categories are in the order the document first mentions them', () => {
  // Written B, A, C; the operations list is sorted by path, so this is not
  // the order deriveOperations returns them in.
  const doc: OpenApiDocument = {
    info: { title: 't', version: '1' },
    paths: {
      '/z': { get: { 'x-category': 'B', responses: {} } },
      '/m': { get: { 'x-category': 'A', responses: {} } },
      '/a': { get: { 'x-category': 'C', responses: {} }, post: { 'x-category': 'B', responses: {} } },
    },
  }
  const ops = deriveOperations(doc)
  assert.deepEqual(ops.map(o => o.path), ['/a', '/a', '/m', '/z'])
  assert.deepEqual(groupOperations(doc, ops).map(g => g.tag), ['B', 'A', 'C'])
})

test('each operation is in exactly one category, and many routers can share one', () => {
  const ops = deriveOperations(fixture)
  const groups = groupOperations(fixture, ops)
  assert.equal(groups.reduce((n, g) => n + g.operations.length, 0), ops.length)
  assert.deepEqual(groups.map(g => g.tag), ['Accounts', 'Billing', 'Webhooks', 'Reports', 'ops', 'default'])
  assert.equal(groups.find(g => g.tag === 'Billing')!.operations.length, 5)
})

test('a document with no extensions is grouped by tag, sorted by name, as before', () => {
  const doc = docOf({ tags: ['zeta'] }, { tags: ['alpha', 'zeta'] }, {}, { tags: ['beta'] })
  const ops = deriveOperations(doc)
  assert.ok(ops.every(o => !o.categoryDeclared && o.title === '' && o.label === o.path))
  assert.deepEqual(groupOperations(doc, ops).map(g => g.tag), ['alpha', 'beta', 'default', 'zeta'])
  assert.deepEqual(deriveTagIndex(doc, ops).map(g => g.tag), ['alpha', 'beta', 'default', 'zeta'])
})

test('a document that declares one category keeps the rest in first-seen order too', () => {
  const doc: OpenApiDocument = {
    info: { title: 't', version: '1' },
    paths: {
      '/b': { get: { tags: ['b'], responses: {} } },
      '/a': { get: { 'x-category': 'Z', responses: {} } },
      '/c': { get: { tags: ['a'], responses: {} } },
    },
  }
  assert.deepEqual(groupOperations(doc, deriveOperations(doc)).map(g => g.tag), ['b', 'Z', 'a'])
})

test('the tag index is unchanged by categories: every tag, every operation carrying it', () => {
  const ops = deriveOperations(fixture)
  const index = deriveTagIndex(fixture, ops)
  const admin = index.find(g => g.tag === 'admin')!
  assert.deepEqual(admin.operations.map(o => o.operationId), ['getUser', 'deleteUser'])
  assert.deepEqual(admin.operations.map(o => o.category), ['Accounts', 'Accounts'])
  assert.ok(index.some(g => g.tag === 'audit' && g.description === 'Routes an auditor reads.'))
  // a tag is never a category name unless it says so
  assert.ok(!index.some(g => g.tag === 'Accounts'))
})

test('the fixture titles read as labels and the untitled fall back to the path', () => {
  const ops = deriveOperations(fixture)
  const byId = (id: string) => ops.find(o => o.operationId === id)!
  assert.equal(byId('getUser').label, 'Fetch User Profile')
  assert.equal(byId('getUser').path, '/v1/users/{id}')
  assert.equal(byId('getInvoice').label, '/v1/invoices/{id}')
  assert.equal(byId('health').category, 'ops')
  assert.equal(byId('version').category, 'default')
})

test('search text carries the title and the category', () => {
  const [op] = derive({ 'x-category': 'Billing', 'x-title': 'Fetch User Profile' })
  assert.ok(op.searchText.includes('fetch user profile'))
  assert.ok(op.searchText.includes('billing'))
})

/** A document whose paths are sorted, as the framework writes them, so the path order says nothing. */
function sortedDoc(extra: Partial<OpenApiDocument>, ...cats: (string | null)[]): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {}
  cats.forEach((c, i) => { paths![`/p${i}`] = { get: { ...(c === null ? { tags: ['t'] } : { 'x-category': c }), responses: {} } as OpenApiOperation } })
  return { info: { title: 't', version: '1' }, paths, ...extra }
}
const order = (doc: OpenApiDocument) => groupOperations(doc, deriveOperations(doc)).map(g => g.tag)

test('x-categories orders the groups, ahead of anything the paths say', () => {
  // p0 is A, p1 is B, p2 is C: first-seen would give A, B, C.
  const doc = sortedDoc({ 'x-categories': ['C', 'A', 'B'] }, 'A', 'B', 'C')
  assert.deepEqual(order(doc), ['C', 'A', 'B'])
})

test('categories not in x-categories follow the listed ones in first-seen order', () => {
  const doc = sortedDoc({ 'x-categories': ['C', 'A'] }, 'Z', 'A', 'Y', 'C', 'Z')
  assert.deepEqual(order(doc), ['C', 'A', 'Z', 'Y'])
  // the tag fallback ("t") is one of the unlisted
  assert.deepEqual(order(sortedDoc({ 'x-categories': ['B'] }, null, 'B')), ['B', 't'])
})

test('a listed category no operation carries makes no empty group', () => {
  assert.deepEqual(order(sortedDoc({ 'x-categories': ['Ghost', 'B', 'A'] }, 'A', 'B')), ['B', 'A'])
})

test('x-categories entries that are not names are ignored, duplicates once', () => {
  const junk = [7, null, {}, ['A'], true, '', '  ', ' B ', 'B', 'A', 'A']
  assert.deepEqual(categoryOrder({ 'x-categories': junk } as unknown as OpenApiDocument), ['B', 'A'])
  assert.deepEqual(order(sortedDoc({ 'x-categories': junk }, 'A', 'B', 'C')), ['B', 'A', 'C'])
})

test('an x-categories that is not an array is no list', () => {
  for (const bad of ['A,B', 5, null, true, { 0: 'B' }, { length: 1, 0: 'B' }]) {
    const doc = sortedDoc({ 'x-categories': bad }, 'A', 'B')
    assert.deepEqual(categoryOrder(doc), [], JSON.stringify(bad))
    assert.deepEqual(order(doc), ['A', 'B'], 'as a document without the list')
  }
  assert.deepEqual(categoryOrder(null), [])
  assert.deepEqual(categoryOrder(undefined), [])
})

test('a document without x-categories is ordered as it was', () => {
  assert.deepEqual(order(sortedDoc({}, 'B', 'A', 'B')), ['B', 'A'], 'declared categories: first-seen')
  assert.deepEqual(order(docOf({ tags: ['b'] }, { tags: ['a'] })), ['a', 'b'], 'tags only: by name')
})

test('x-categories orders a document that names its categories by tag alone', () => {
  const doc = docOf({ tags: ['a'] }, { tags: ['b'] })
  doc['x-categories'] = ['b', 'a']
  assert.deepEqual(order(doc), ['b', 'a'])
})

test('x-categories names that look like prototype members are only names', () => {
  const doc = sortedDoc({ 'x-categories': ['__proto__', 'constructor'] }, 'constructor', '__proto__')
  assert.deepEqual(order(doc), ['__proto__', 'constructor'])
})

test('the fixture lists its categories in registration order', () => {
  assert.deepEqual(categoryOrder(fixture), ['Accounts', 'Billing', 'Webhooks', 'Reports'])
  // sorted paths would put /v1/health, then Billing (/v1/invoices), first
  assert.deepEqual(groupOperations(fixture, deriveOperations(fixture)).map(g => g.tag), ['Accounts', 'Billing', 'Webhooks', 'Reports', 'ops', 'default'])
})
