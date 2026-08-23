import { codeToHtml } from 'shiki'

// Same Shiki engine and theme pair Nuxt UI's own ProsePre uses by default.
const LIGHT_THEME = 'material-theme-lighter'
const DARK_THEME = 'material-theme-palenight'

const LANG_MAP: Record<string, string> = {
  curl: 'bash',
  json: 'json',
  python: 'python',
  httpx: 'python',
  fetch: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  go: 'go',
  csharp: 'csharp',
  dotnet: 'csharp',
  java: 'java',
  php: 'php',
  ruby: 'ruby',
  rust: 'rust',
  code: 'text',
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
      return await codeToHtml(code, {
        lang: LANG_MAP[lang || 'code'] || 'text',
        themes: { light: LIGHT_THEME, dark: DARK_THEME },
        defaultColor: false,
      })
    } catch {
      return fallbackHtml(code)
    }
  }

  return { highlight }
}
