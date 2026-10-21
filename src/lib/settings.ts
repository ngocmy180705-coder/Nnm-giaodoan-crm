import { useCallback, useSyncExternalStore } from 'react'

export interface Settings {
  /** Operator name / role shown in the header avatar. */
  name: string
  role: string
  /** Default rows per page for list tables. */
  pageSize: number
  /** Compact table density (applied globally via <html data-density="compact">). */
  compact: boolean
}

export const PAGE_SIZE_OPTIONS = [8, 10, 20, 50] as const
export const DEFAULT_SETTINGS: Settings = { name: 'Nguyễn Văn A', role: 'Quản lý Đối tác', pageSize: 8, compact: false }

const KEY = 'gd.settings'
const listeners = new Set<() => void>()

/** Keeps only known keys with the right type/value; everything else falls back to the default. */
function sanitize(raw: unknown): Settings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : fallback)
  return {
    name: str(src.name, DEFAULT_SETTINGS.name),
    role: str(src.role, DEFAULT_SETTINGS.role),
    pageSize: (PAGE_SIZE_OPTIONS as readonly unknown[]).includes(src.pageSize) ? (src.pageSize as number) : DEFAULT_SETTINGS.pageSize,
    compact: typeof src.compact === 'boolean' ? src.compact : DEFAULT_SETTINGS.compact,
  }
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return sanitize(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_SETTINGS
  }
}

let snapshot = read()

function emit(next: Settings) {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full / blocked: keep in-memory value */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = read()
      cb()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Operator settings persisted in localStorage.
 *   const { settings, update } = useSettings()
 *   const PAGE_SIZE = settings.pageSize          // use instead of a hard-coded page size
 *   update({ compact: true })
 */
export function useSettings() {
  const settings = useSyncExternalStore(subscribe, () => snapshot, () => DEFAULT_SETTINGS)
  const update = useCallback((patch: Partial<Settings>) => emit(sanitize({ ...snapshot, ...patch })), [])
  const reset = useCallback(() => emit({ ...DEFAULT_SETTINGS }), [])
  return { settings, update, reset }
}
