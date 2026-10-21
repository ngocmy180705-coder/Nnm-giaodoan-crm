import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * `?new=1` convention: links like /merchants?new=1 (Tổng quan quick actions) must open the page's create modal.
 * Call once in a list page:  useNewParam(() => setAdding(true))
 * `onNew` runs on mount when the param is present, then the param is removed (replace, so Back does not reopen it).
 * `onNew` must be idempotent (setOpen(true)); React StrictMode may call it twice in dev.
 */
export function useNewParam(onNew: () => void) {
  const [params, setParams] = useSearchParams()
  const isNew = params.get('new') === '1'
  useEffect(() => {
    if (!isNew) return
    onNew()
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew])
}
