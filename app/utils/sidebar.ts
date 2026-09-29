// What the sidebar tree decides that is not markup: which operations a filter
// keeps, and which category groups are open. Kept apart from NavList so that it
// runs under `pnpm test` without a browser.

import type { OperationEntry, OperationGroup } from './openapi.ts'

/**
 * How many categories a document can have before its groups start closed.
 *
 * Up to this many the tree opens whole, as it always has: a handful of groups
 * is a short page and closing them would only hide it. Past it the tree is a
 * list of a hundred headings, and the useful start is one open group - the one
 * the reader is in - with the rest a click away.
 */
export const AUTO_COLLAPSE_ABOVE = 12

/** A filter box's text as the words it has to find, lower-cased. */
export function queryTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Whether an operation answers a filter.
 *
 * Every word must appear somewhere in the method, path, title, summary or
 * category, so "get billing" finds the GETs in Billing and "profile" finds the
 * route titled "Fetch User Profile" whatever its path is. `extra` is text the
 * caller knows about the operation's place in a list - the tag a tag-index
 * group is named for.
 */
export function matchesOperation(op: OperationEntry, tokens: string[], extra = ''): boolean {
  if (!tokens.length) return true
  const haystack = `${op.verb} ${op.path} ${op.title} ${op.summary} ${op.category} ${extra}`.toLowerCase()
  return tokens.every(t => haystack.includes(t))
}

/** Narrows groups to the operations a filter keeps, dropping the ones left empty. */
export function filterGroups(groups: OperationGroup[], query: string): OperationGroup[] {
  const tokens = queryTokens(query)
  if (!tokens.length) return groups
  return groups
    .map(g => ({ ...g, operations: g.operations.filter(o => matchesOperation(o, tokens, g.tag)) }))
    .filter(g => g.operations.length)
}

/** Open and closed as the reader last left each category, by category name. */
export type OpenState = Record<string, boolean>

/**
 * The stored state, or an empty one when what came out of storage is not a
 * record of booleans. It is read back from a place a script or an older build
 * may have written to, so nothing about its shape is assumed.
 */
export function openStateOf(raw: unknown): OpenState {
  // defineProperty rather than assignment: `out['__proto__'] = true` would set
  // the prototype, not record a category with that name.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: OpenState = {}
  for (const [name, open] of Object.entries(raw)) {
    if (typeof open === 'boolean') Object.defineProperty(out, name, { value: open, enumerable: true, writable: true, configurable: true })
  }
  return out
}

/**
 * Whether a category's group is open: what the reader chose if they chose, and
 * otherwise the default for a tree of this size.
 *
 * The lookup is an own-property one because the names are the document's, and
 * a category called "constructor" must not read as open off Object's prototype.
 */
export function isOpen(state: OpenState, category: string, opts: { categories: number, holdsCurrent: boolean }): boolean {
  const chosen = state && typeof state === 'object' && !Array.isArray(state) ?Object.getOwnPropertyDescriptor(state, category)?.value : undefined
  if (typeof chosen === 'boolean') return chosen
  return opts.categories <= AUTO_COLLAPSE_ABOVE || opts.holdsCurrent
}

/** The state with one category set open or closed. */
export function withOpen(state: OpenState, category: string, open: boolean): OpenState {
  return withAll(state, [category], open)
}

/** The state with every one of the categories set open or closed. */
export function withAll(state: OpenState, categories: string[], open: boolean): OpenState {
  const next = openStateOf(state)
  for (const name of categories) {
    Object.defineProperty(next, name, { value: open, enumerable: true, writable: true, configurable: true })
  }
  return next
}

/**
 * What the tooltip on an operation's row says.
 *
 * A row that shows a title has pushed the path out of sight, so the tooltip is
 * where the path is; it also repeats the title, which the row may have had to
 * truncate. A row that shows the path has the summary to add.
 */
export function rowTooltip(op: OperationEntry): string {
  return op.title ? `${op.title}\n${op.verb.toUpperCase()} ${op.path}` : op.summary
}

/**
 * The second line of an operation's row in the command palette.
 *
 * The first line is its label. With a title that is the title, so this line is
 * where the path and the category go; without one the first line is the path,
 * and this is the summary and the tags it always was, with the category added
 * when it is not one of those tags.
 */
export function operationSubtitle(op: OperationEntry): string {
  if (op.title) return `${op.path} · ${op.category}`
  const parts = [op.summary, op.tags.join(', ')]
  if (!op.tags.includes(op.category)) parts.push(op.category)
  return parts.join(' · ')
}

/**
 * How well a needle matches a text, 0 for not at all: a substring scores by how
 * early it starts, and failing that the needle's letters in order still count.
 */
export function fuzzy(needle: string, hay: unknown): number {
  if (!needle) return 1
  const n = needle.toLowerCase()
  const h = String(hay ?? '').toLowerCase()
  const direct = h.indexOf(n)
  if (direct >= 0) return 1000 - direct
  let i = 0
  let score = 0
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) { i++; score++ }
  }
  return i === n.length ? score : 0
}

/**
 * How well an operation answers a command-palette query, 0 for not at all.
 *
 * Each word of the query is looked for on its own among everything that names
 * the operation - its label, path, summary, method, category and tags - and all
 * of them have to be found, in any order: "router 77 post" is the POST in
 * router 77 however the row is written. The worst word sets the score, so a
 * row is only as good a match as its weakest word.
 */
export function operationScore(query: string, op: OperationEntry): number {
  const words = queryTokens(query)
  if (!words.length) return 1
  const fields = [op.label, op.path, op.summary, op.verb, op.category, op.tags.join(' '), `${op.verb} ${op.path}`]
  let worst = Infinity
  for (const word of words) {
    const best = Math.max(...fields.map(f => fuzzy(word, f)))
    if (!best) return 0
    worst = Math.min(worst, best)
  }
  return worst
}
