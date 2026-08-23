/**
 * A useState-backed ref that mirrors itself into Web Storage, client-side only.
 *
 * Defaults to `localStorage` for ordinary UI state. Pass `sessionStorage` for
 * anything sensitive (credentials, tokens): it still survives a page reload
 * within the tab, but it is cleared when the tab or browser closes rather than
 * sitting on disk indefinitely in plaintext, readable by any future XSS or by
 * anyone with later access to the browser profile.
 */
export function usePersisted<T>(key: string, fallback: T, backend: () => Storage = () => localStorage) {
  const storageKey = `muzak-docs.${key}`
  const state = useState<T>(`persist-${key}`, () => {
    if (import.meta.client) {
      try {
        const raw = backend().getItem(storageKey)
        if (raw !== null) return JSON.parse(raw) as T
      } catch { /* corrupt/unavailable storage — fall through to default */ }
    }
    return fallback
  })

  watch(state, (value) => {
    if (!import.meta.client) return
    try { backend().setItem(storageKey, JSON.stringify(value)) } catch { /* storage unavailable */ }
  }, { deep: true })

  return state
}
