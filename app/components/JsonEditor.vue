<script setup lang="ts">
import { tags } from '@lezer/highlight'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { linter } from '@codemirror/lint'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, keymap } from '@codemirror/view'

const props = withDefaults(defineProps<{
  modelValue: string
  ariaLabel?: string
}>(), {
  ariaLabel: 'JSON editor',
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const host = useTemplateRef<HTMLElement>('host')
let view: EditorView | null = null

// Reuses the app's own --c-* token colors so the editor matches the
// read-only highlighted previews elsewhere in this panel.
const highlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--c-key)' },
  { tag: tags.string, color: 'var(--c-str)' },
  { tag: tags.number, color: 'var(--c-num)' },
  { tag: [tags.bool, tags.null], color: 'var(--c-kw)' },
  { tag: [tags.separator, tags.punctuation, tags.squareBracket, tags.brace], color: 'var(--c-pun)' },
])

// Colors are all CSS custom properties, so this repaints for free when the
// app's `.dark` class toggles — no separate dark theme needed.
const theme = EditorView.theme({
  '&': {
    fontSize: '11px',
    color: 'var(--fg)',
    backgroundColor: 'var(--sunken)',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    height: '178px',
    minHeight: '96px',
    resize: 'vertical',
    overflow: 'hidden',
    boxSizing: 'border-box',
    transition: 'border-color .13s ease, box-shadow .13s ease',
  },
  '&:hover': { borderColor: 'var(--border-2)' },
  '&.cm-focused': {
    outline: 'none',
    borderColor: 'var(--acc-line)',
    boxShadow: '0 0 0 3px var(--acc-soft)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-content': { padding: '8px', caretColor: 'var(--fg)' },
  '.cm-line': { padding: '0' },
  // drawSelection() draws its own cursor instead of the native caret and
  // defaults its border color to black — invisible on a dark background.
  '.cm-cursor, .cm-cursor-primary, .cm-dropCursor': {
    borderLeftColor: 'var(--fg)',
    borderLeftWidth: '1.5px',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--fg) 5%, transparent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--acc-soft) !important',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    borderRadius: '2px',
    color: 'inherit !important',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--acc-soft)' },
  '.cm-nonmatchingBracket': { backgroundColor: 'var(--err-soft)' },
  '.cm-tooltip': {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    background: 'var(--elev)',
    color: 'var(--fg)',
  },
  '.cm-tooltip-lint': { padding: '4px 6px' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--err)' },
  '.cm-placeholder': { color: 'var(--fg-3)' },
})

function extensions(): Extension[] {
  return [
    json(),
    linter(jsonParseLinter()),
    history(),
    closeBrackets(),
    bracketMatching(),
    indentOnInput(),
    indentUnit.of('  '),
    drawSelection(),
    highlightActiveLine(),
    syntaxHighlighting(highlightStyle),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': props.ariaLabel, spellcheck: 'false' }),
    keymap.of([
      { key: 'Mod-Enter', preventDefault: true, run: () => { emit('submit'); return true } },
      ...closeBracketsKeymap,
      ...historyKeymap,
      indentWithTab,
      ...defaultKeymap,
    ]),
    theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
  ]
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: extensions() }),
    parent: host.value,
  })
})

// External writes (Reset, Format, switching endpoints) land here; skip the
// dispatch when the change originated from our own updateListener above.
watch(() => props.modelValue, (value) => {
  if (!view || value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" />
</template>
