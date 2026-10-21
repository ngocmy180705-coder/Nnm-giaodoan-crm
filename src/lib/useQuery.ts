import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react'
import { isSupabaseConfigured } from './supabase'

type Result<T> = { data: T | null; error: { message: string } | null }

export interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-run the fetcher (keeps showing the old data while loading). */
  reload: () => void
  /** Local override, handy for optimistic updates after a mutation. */
  setData: Dispatch<SetStateAction<T | null>>
}

/**
 * Tiny data hook for Supabase reads:
 *   const { data, loading, error, reload } = useQuery<Merchant[]>(
 *     () => supabase.from('merchants').select('*').order('code', { ascending: false }), [])
 * `deps` re-runs the fetch (like useEffect deps); `reload()` re-runs it on demand.
 */
export function useQuery<T>(fetcher: () => PromiseLike<Result<T>>, deps: DependencyList = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const lastTick = useRef(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // deps changed (not a plain reload) -> drop the previous entity's data
    if (tick === lastTick.current) setData(null)
    lastTick.current = tick
    if (!isSupabaseConfigured) {
      setData(null)
      setError('Chưa cấu hình VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (xem .env.example).')
      setLoading(false)
      return
    }
    Promise.resolve(fetcher())
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setError(res.error.message)
          setData(null)
        } else setData(res.data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setData(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload, setData }
}
