export interface PageRef {
  type: 'endpoint' | 'schema'
  id: string
}

export interface AuthState {
  schemeId: string
  token: string
  apiKeyName: string
  user: string
  pass: string
}

/** UI/navigation state shared across the whole docs app — the equivalent of the original's single `store` object. */
export function useDocsState() {
  return {
    page: usePersisted<PageRef>('page', { type: 'endpoint', id: '' }),
    server: usePersisted('server', 0),
    sidebarOpen: usePersisted('sidebarOpen', true),
    // Open or closed, per category, only where the reader chose: a category
    // with no entry follows the default for a tree of its size (see
    // AUTO_COLLAPSE_ABOVE), so this stays as small as the choices made.
    openCategories: usePersisted<Record<string, boolean>>('openCategories', {}),
    // The tag accordion is the secondary view, so it starts closed: an entry
    // is open only where this says false. Reversed from openCategories, whose
    // groups open by default when the tree is small enough to read whole.
    collapsedTags: usePersisted<Record<string, boolean>>('collapsedTags', {}),
    lang: usePersisted('lang', 'curl'),
    // Credentials go in sessionStorage, not localStorage: they still survive a
    // reload while the tab is open, but they don't sit on disk in plaintext
    // after the browser closes, where any later XSS or anyone with access to
    // the profile could read them back out indefinitely.
    auth: usePersisted<AuthState>('auth', { schemeId: '', token: '', apiKeyName: '', user: '', pass: '' }, () => sessionStorage),

    sidebarQuery: useState('docs-sidebarQuery', () => ''),
    mobileNav: useState('docs-mobileNav', () => false),
    mobileTry: useState('docs-mobileTry', () => false),
    paletteOpen: useState('docs-paletteOpen', () => false),
    paletteQuery: useState('docs-paletteQuery', () => ''),
    paletteIndex: useState('docs-paletteIndex', () => 0),
    authModal: useState('docs-authModal', () => false),
    copied: useState('docs-copied', () => ''),
    tryPulse: useState('docs-tryPulse', () => false),
    expandedResponses: useState<Record<string, boolean>>('docs-expandedResponses', () => ({})),
    responseTabs: useState<Record<string, string>>('docs-responseTabs', () => ({})),
    bodyView: useState<'schema' | 'example'>('docs-bodyView', () => 'schema'),
  }
}

let copyTimer: ReturnType<typeof setTimeout> | null = null

/** Copies text and flashes a "copied" key in shared state for ~1.3s, matching the original's inline copy affordance. */
export function useCopyFeedback() {
  const { copied } = useDocsState()
  const { copy: copyToClipboard } = useClipboard()

  async function copy(text: string, key: string) {
    await copyToClipboard(text)
    copied.value = key
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = '' }, 1300)
  }

  return { copy, copied }
}
