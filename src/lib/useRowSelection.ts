import { useEffect, useMemo, useState } from 'react'

/**
 * Row checkbox selection that can only ever contain rows currently in `visible` (the filtered list):
 * the stored set is pruned whenever `visible` changes, and `selectedRows` is intersected with `visible`
 * on every render, so a bulk action / export can never touch a row hidden by a filter, search or tab.
 */
export function useRowSelection<T extends { id: string }>(visible: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useEffect(() => {
    setSelected((cur) => {
      if (cur.size === 0) return cur
      const ids = new Set(visible.map((r) => r.id))
      const next = new Set([...cur].filter((id) => ids.has(id)))
      return next.size === cur.size ? cur : next
    })
  }, [visible])
  const selectedRows = useMemo(() => visible.filter((r) => selected.has(r.id)), [visible, selected])
  return { selected, setSelected, selectedRows }
}
