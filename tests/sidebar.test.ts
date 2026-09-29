// What the sidebar tree and the command palette decide: which operations a
// filter keeps, which groups are open, and what a row says. Run with `pnpm test`.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { deriveOperations, groupOperations, type OpenApiDocument } from '../app/utils/openapi.ts'
import {
  AUTO_COLLAPSE_ABOVE, filterGroups, isOpen, matchesOperation, openStateOf, operationScore, operationSubtitle, queryTokens,
  rowTooltip, withAll, withOpen,
} from '../app/utils/sidebar.ts'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/categories.openapi.json', import.meta.url), 'utf8')) as OpenApiDocument
const operations = deriveOperations(fixture)
const groups = groupOperations(fixture, operations)
const idsFor = (query: string) => filterGroups(groups, query).flatMap(g => g.operations.map(o => o.operationId || o.path))

test('a filter matches the title, the category, the path and the method', () => {
  assert.deepEqual(idsFor('fetch user profile'), ['getUser'])
  assert.deepEqual(idsFor('PROFILE'), ['getUser'], 'case does not matter')
  // the category names every operation in it
  assert.equal(filterGroups(groups, 'billing').length, 1)
  assert.equal(filterGroups(groups, 'billing')[0].operations.length, 5)
  assert.deepEqual(idsFor('/v1/reports/sign'), ['signupsReport'])
  assert.deepEqual(idsFor('delete'), ['deleteUser'])
})

test('every word of a filter has to match, wherever it matches', () => {
  assert.deepEqual(idsFor('get billing'), ['listInvoices', 'getInvoice', 'listSubscriptions'])
  assert.deepEqual(idsFor('post refund'), ['refundInvoice'])
  assert.deepEqual(idsFor('accounts nonsense'), [])
})

test('a filter keeps only the groups that still have an operation', () => {
  assert.deepEqual(filterGroups(groups, 'webhook').map(g => g.tag), ['Webhooks'])
  assert.deepEqual(filterGroups(groups, 'zzz'), [])
})

test('a blank filter leaves the groups as they are', () => {
  for (const q of ['', '   ', '\t']) assert.equal(filterGroups(groups, q), groups)
  assert.deepEqual(queryTokens('  Get   BILLING '), ['get', 'billing'])
})

test('the tag index is filtered by its tag name as well as the operations', () => {
  const audit = { tag: 'audit', description: '', operations: [operations.find(o => o.operationId === 'refundInvoice')!] }
  assert.equal(filterGroups([audit], 'audit').length, 1)
  assert.equal(matchesOperation(audit.operations[0], queryTokens('audit'), 'audit'), true)
  assert.equal(matchesOperation(audit.operations[0], queryTokens('audit')), false)
})

test('a category that is a prototype property name filters like any other', () => {
  const doc: OpenApiDocument = { info: { title: 't', version: '1' }, paths: { '/x': { get: { 'x-category': 'constructor', responses: {} } } } }
  const g = groupOperations(doc, deriveOperations(doc))
  assert.equal(filterGroups(g, 'constructor').length, 1)
})

test('a small tree opens whole and a large one only where the reader is', () => {
  assert.equal(isOpen({}, 'Billing', { categories: AUTO_COLLAPSE_ABOVE, holdsCurrent: false }), true)
  assert.equal(isOpen({}, 'Billing', { categories: AUTO_COLLAPSE_ABOVE + 1, holdsCurrent: false }), false)
  assert.equal(isOpen({}, 'Billing', { categories: 100, holdsCurrent: true }), true)
})

test('what the reader chose beats the default, both ways', () => {
  const big = { categories: 100, holdsCurrent: false }
  assert.equal(isOpen({ Billing: true }, 'Billing', big), true)
  assert.equal(isOpen({ Billing: false }, 'Billing', { categories: 3, holdsCurrent: true }), false)
})

test('a category named like an Object property is not open by inheritance', () => {
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(isOpen({}, name, { categories: 100, holdsCurrent: false }), false, name)
  }
  const chosen = withOpen({}, '__proto__', true)
  assert.equal(isOpen(chosen, '__proto__', { categories: 100, holdsCurrent: false }), true)
  assert.equal(isOpen(chosen, 'other', { categories: 100, holdsCurrent: false }), false)
  // and survives the trip through storage
  assert.equal(isOpen(JSON.parse(JSON.stringify(chosen)), '__proto__', { categories: 100, holdsCurrent: false }), true)
})

test('stored state that is not a record of booleans is not trusted', () => {
  const big = { categories: 100, holdsCurrent: false }
  for (const junk of [null, undefined, 3, 'open', true, [true], { Billing: 'yes' }, { Billing: 1 }, { Billing: null }]) {
    assert.equal(isOpen(junk as never, 'Billing', big), false, JSON.stringify(junk))
    assert.equal(isOpen(junk as never, 'Billing', { categories: 2, holdsCurrent: false }), true, JSON.stringify(junk))
  }
  assert.deepEqual(openStateOf({ a: true, b: 'x', c: false }), { a: true, c: false })
  assert.deepEqual(openStateOf([true]), {})
  assert.deepEqual(withOpen(null as never, 'a', true), { a: true })
})

test('opening and closing leave the input alone and touch only what they name', () => {
  const before = { a: true, b: false }
  const after = withOpen(before, 'b', true)
  assert.deepEqual(before, { a: true, b: false })
  assert.deepEqual(after, { a: true, b: true })
  assert.deepEqual(withAll(before, ['a', 'b', 'c'], false), { a: false, b: false, c: false })
})

test('a titled row names the operation and keeps the path in its tooltip', () => {
  const titled = operations.find(o => o.operationId === 'getUser')!
  assert.equal(rowTooltip(titled), 'Fetch User Profile\nGET /v1/users/{id}')
  const plain = operations.find(o => o.operationId === 'getInvoice')!
  assert.equal(rowTooltip(plain), 'Fetch an invoice', 'an untitled row is as it was: the summary')
})

test('a palette row says where a titled endpoint lives, and keeps the old line otherwise', () => {
  const titled = operations.find(o => o.operationId === 'getUser')!
  assert.equal(operationSubtitle(titled), '/v1/users/{id} · Accounts')
  const plain = operations.find(o => o.operationId === 'health')!
  assert.equal(operationSubtitle(plain), 'Liveness probe · ops', 'as before: summary and tags')
  const declared = operations.find(o => o.operationId === 'getInvoice')!
  assert.equal(operationSubtitle(declared), 'Fetch an invoice · billing · Billing')
})

test('the palette finds an operation by any of its names, words in any order', () => {
  const by = (id: string) => operations.find(o => o.operationId === id)!
  const score = (q: string, id: string) => operationScore(q, by(id))
  assert.ok(score('fetch user profile', 'getUser') > 0)
  assert.ok(score('profile fetch', 'getUser') > 0, 'order does not matter')
  assert.ok(score('accounts get', 'getUser') > 0, 'category and method')
  assert.ok(score('refund post billing', 'refundInvoice') > 0)
  assert.ok(score('/v1/users', 'getUser') > 0, 'the path still works when a title replaced it')
  assert.equal(score('refund post webhooks', 'refundInvoice'), 0, 'every word has to be found')
  assert.equal(score('kubernetes', 'getUser'), 0)
  assert.equal(score('', 'getUser'), 1)
  // a plain substring outranks the same letters scattered
  assert.ok(score('profile', 'getUser') > score('prfl', 'getUser'))
})
