import { createContext, useContext, useEffect } from 'react'

/** Header breadcrumb item. `to` makes it a link; the last crumb (current page) is never linked. */
export interface Crumb {
  label: string
  to?: string
}
/** useBreadcrumb accepts plain strings too (backward compatible): they are auto-linked, see Layout.normalizeCrumbs. */
export type CrumbInput = string | Crumb

export interface LayoutContextValue {
  setCrumbs: (crumbs: CrumbInput[] | null) => void
  toast: (message: string) => void
}

export const LayoutContext = createContext<LayoutContextValue>({ setCrumbs: () => {}, toast: () => {} })

/** Show a small green toast (bottom-center on mobile, bottom-right on desktop): const toast = useToast(); toast('Đã cập nhật trạng thái'). */
export const useToast = () => useContext(LayoutContext).toast

/**
 * Override the header breadcrumb for the current page. Pass the trail AFTER "Tổng quan" (which always links to "/"), e.g.
 *   useBreadcrumb(['Thời hạn & gia hạn', `Chi tiết gói #${sub.code}`])
 *   useBreadcrumb([{ label: 'Hồ sơ Merchant', to: '/merchants' }, m.name])
 * Plain-string crumbs are auto-linked to the matching URL prefix (1st crumb -> section list, 2nd -> detail page);
 * the last crumb is the current page and is not a link. Pass null (or never call it) to use the default trail.
 */
export function useBreadcrumb(crumbs: CrumbInput[] | null) {
  const { setCrumbs } = useContext(LayoutContext)
  const key = crumbs ? JSON.stringify(crumbs) : ''
  useEffect(() => {
    setCrumbs(crumbs)
    return () => setCrumbs(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
