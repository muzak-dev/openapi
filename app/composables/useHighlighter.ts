import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Shiki, loaded a grammar at a time.
//
// Importing `codeToHtml` from `shiki` pulls the full bundle: every language
// and every theme Shiki ships becomes a chunk in the build, which cost 11 MB
// of the 12 MB output and made the dashboard far too heavy to embed in the
// framework binary. The core engine plus the grammars this page can actually
// ask for is a few hundred kilobytes.
//
// The languages are exactly the snippet generators in `utils/codegen.ts`, plus
// JSON for bodies and responses. Adding a generator means adding its grammar
// here; anything unknown falls back to plain text rather than reaching for a
// chunk that was never built.
//
// The JavaScript regex engine is used in place of the default Oniguruma one so
// that no WebAssembly binary is fetched at run time, which keeps the page
// working under a `connect-src 'self'` policy and offline.

// Same Shiki theme pair Nuxt UI's own ProsePre uses by default.
const LIGHT_THEME = 'material-theme-lighter'
const DARK_THEME = 'material-theme-palenight'

const LANG_MAP: Record<string, string> = {
  curl: 'bash',
  json: 'json',
  python: 'python',
  httpx: 'python',
  go: 'go',
  csharp: 'csharp',
  dotnet: 'csharp',
  java: 'java',
  php: 'php',
  rust: 'rust',
  code: 'text',
}

// Every grammar the map above can resolve to. Each is a dynamic import, so a
// language is fetched the first time a snippet needs it and never otherwise.
//
// The set matches the snippet generators exactly. Ruby, JavaScript and
// TypeScript were dropped from both: Ruby's grammar embeds Haml, ERB, HTML,
// CSS and SQL and came to 1.3 MB on its own, and the two JavaScript grammars
// another 350 KB, in a page that ships inside every binary that serves it.
const GRAMMARS: Record<string, () => Promise<unknown>> = {
  bash: () => import('@shikijs/langs/bash'),
  json: () => import('@shikijs/langs/json'),
  python: () => import('@shikijs/langs/python'),
  go: () => import('@shikijs/langs/go'),
  csharp: () => import('@shikijs/langs/csharp'),
  java: () => import('@shikijs/langs/java'),
  php: () => import('@shikijs/langs/php'),
  rust: () => import('@shikijs/langs/rust'),
}

type Highlighter = Awaited<ReturnType<typeof createHighlighterCore>>

let corePromise: Promise<Highlighter> | null = null
const loaded = new Set<string>()

/** The one highlighter instance, created on first use and reused after. */
function core(): Promise<Highlighter> {
  corePromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/material-theme-lighter'), import('@shikijs/themes/material-theme-palenight')],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })
  return corePromise
}

/** Loads one grammar into the highlighter, once, and reports its name. */
async function grammarFor(highlighter: Highlighter, lang: string): Promise<string> {
  const load = GRAMMARS[lang]
  if (!load) {
    return 'text'
  }
  if (!loaded.has(lang)) {
    await highlighter.loadLanguage((await load()) as never)
    loaded.add(lang)
  }
  return lang
}

function escHtml(str: unknown): string {
  return String(str ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

function fallbackHtml(code: string): string {
  return `<pre class="shiki-fallback mono"><code>${escHtml(code)}</code></pre>`
}

/** Highlights code with Shiki (dual light/dark theme, CSS-variable output) — async, so callers own their own loading state. */
export function useHighlighter() {
  async function highlight(code: string, lang?: string): Promise<string> {
    if (!code) return ''
    try {
      const highlighter = await core()
      const resolved = await grammarFor(highlighter, LANG_MAP[lang || 'code'] || 'text')
      return highlighter.codeToHtml(code, {
        lang: resolved,
        themes: { light: LIGHT_THEME, dark: DARK_THEME },
        defaultColor: false,
      })
    } catch {
      return fallbackHtml(code)
    }
  }

  return { highlight }
}
