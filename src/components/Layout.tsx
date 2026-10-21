import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon from './Icon'
import NotificationBell from './NotificationBell'
import { LanguageMenu, UserMenu } from './HeaderMenus'
import { LayoutContext, type Crumb, type CrumbInput } from '../lib/layoutContext'
import { ROUTES } from '../lib/links'
import { useScrollLock } from '../lib/useScrollLock'
import { useSettings } from '../lib/settings'

const NAV = [
  { to: '/merchants', icon: 'store', label: 'Hồ sơ Merchant' },
  { to: '/onboarding', icon: 'timeline', label: 'Tiến độ onboard' },
  { to: '/support', icon: 'headset_mic', label: 'Yêu cầu hỗ trợ' },
  { to: '/subscriptions', icon: 'calendar_today', label: 'Thời hạn & gia hạn' },
  { to: '/contacts', icon: 'phone_callback', label: 'Lịch sử liên hệ' },
  { to: '/churn', icon: 'warning', label: 'Nguy cơ rời bỏ' },
  { to: '/faq', icon: 'help', label: 'FAQ' },
  { to: '/promotions', icon: 'local_offer', label: 'CTKM' },
]

/** First-segment -> default header trail (after "Tổng quan"), taken from each design's header. */
const SECTIONS: Record<string, { crumbs: string[]; list: string }> = {
  merchants: { crumbs: ['Merchant CRM'], list: 'Hồ sơ Merchant' },
  onboarding: { crumbs: ['Tiến độ Onboarding'], list: 'Tiến độ Onboarding' },
  support: { crumbs: ['Yêu cầu hỗ trợ'], list: 'Yêu cầu hỗ trợ' },
  subscriptions: { crumbs: ['Thời hạn & gia hạn', 'Gói dịch vụ'], list: 'Thời hạn & gia hạn' },
  contacts: { crumbs: ['Lịch sử liên hệ'], list: 'Lịch sử liên hệ' },
  churn: { crumbs: ['Nguy cơ rời bỏ'], list: 'Nguy cơ rời bỏ' },
  faq: { crumbs: ['FAQ - Quản Lý Đối Tác Giaodoan'], list: 'FAQ' },
  promotions: { crumbs: ['CTKM - Quản Lý Đối Tác Giaodoan'], list: 'CTKM' },
  settings: { crumbs: ['Cài đặt'], list: 'Cài đặt' },
  help: { crumbs: ['Trợ giúp'], list: 'Trợ giúp' },
}

function segmentsOf(pathname: string) {
  return pathname.split('/').filter(Boolean)
}

/** Default trail: section list page links to itself's URL; detail pages get [list(link), 'Chi tiết']. */
function defaultCrumbs(pathname: string): CrumbInput[] {
  const seg = segmentsOf(pathname)
  const sec = SECTIONS[seg[0]]
  if (!sec) return [{ label: 'Không tìm thấy trang' }]
  if (seg.length === 1) return sec.crumbs.map((label, i, a) => (i < a.length - 1 ? { label, to: `/${seg[0]}` } : { label }))
  return [{ label: sec.list, to: `/${seg[0]}` }, { label: 'Chi tiết' }]
}

/**
 * Plain-string crumbs are linked to the URL prefix that matches their position:
 * /support/123 with ['Yêu cầu hỗ trợ','Chi tiết …'] -> crumb 0 links to /support.
 * /subscriptions/ID/invoice with 3 crumbs -> crumb 1 links to /subscriptions/ID. The last crumb never links.
 */
export function normalizeCrumbs(pathname: string, input: CrumbInput[]): Crumb[] {
  const seg = segmentsOf(pathname)
  return input.map((c, i) => {
    if (typeof c !== 'string') return i === input.length - 1 ? { label: c.label } : c
    if (i === input.length - 1 || i >= seg.length) return { label: c }
    return { label: c, to: '/' + seg.slice(0, i + 1).join('/') }
  })
}

const navBase = 'group flex items-center gap-space-md px-space-md transition-all rounded-lg'
const navActive = 'bg-primary-container text-on-primary font-label-lg shadow-[0_4px_12px_rgba(255,91,0,0.25)]'
const navIdle = 'text-secondary-fixed-dim hover:bg-surface-variant/10 hover:text-inverse-on-surface'
const navCls = (py: string) => ({ isActive }: { isActive: boolean }) => `${navBase} ${py} ${isActive ? navActive : navIdle}`

export default function Layout() {
  const { pathname } = useLocation()
  const { settings } = useSettings()
  const [override, setOverride] = useState<CrumbInput[] | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((message: string) => {
    setToastMsg(message)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastMsg(null), 2600)
  }, [])
  const ctx = useMemo(() => ({ setCrumbs: setOverride, toast }), [toast])

  // drawer: close on route change / Esc, lock body scroll while open
  useEffect(() => setDrawer(false), [pathname])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])
  useScrollLock(drawer)
  // closing the drawer when the viewport grows to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => mq.matches && setDrawer(false)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.density = settings.compact ? 'compact' : 'comfortable'
  }, [settings.compact])

  const crumbs: Crumb[] = [{ label: 'Tổng quan', to: ROUTES.overview }, ...normalizeCrumbs(pathname, override ?? defaultCrumbs(pathname))]
  // the overview page itself: a single non-linked "Tổng quan"
  if (pathname === '/') crumbs.splice(0, crumbs.length, { label: 'Tổng quan' })
  const title = crumbs[crumbs.length - 1].label

  return (
    <LayoutContext.Provider value={ctx}>
      {/* backdrop (mobile drawer) */}
      <div
        className={`fixed inset-0 z-[45] bg-on-background/50 backdrop-blur-[1px] transition-opacity lg:hidden print:hidden ${drawer ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setDrawer(false)}
        aria-hidden="true"
        data-testid="drawer-backdrop"
      />
      <aside
        id="app-sidebar"
        className={`fixed left-0 top-0 z-50 flex h-full w-64 max-w-[85vw] flex-col justify-between bg-inverse-surface shadow-[0_1px_8px_rgba(0,0,0,0.08)] transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 print:hidden ${drawer ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-16 items-center gap-space-md border-b border-inverse-surface/40 px-margin">
            <Link to={ROUTES.overview} className="flex min-w-0 flex-1 items-center gap-space-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container font-headline-md text-headline-md text-on-primary shadow-[0_4px_12px_rgba(255,91,0,0.35)]">G</div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md tracking-tight text-inverse-on-surface">Giaodoan</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed-dim">Merchant CRM</span>
              </div>
            </Link>
            <button type="button" onClick={() => setDrawer(false)} aria-label="Đóng menu" className="rounded-lg p-1.5 text-secondary-fixed-dim hover:bg-surface-variant/10 lg:hidden">
              <Icon name="close" className="text-[22px]" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-space-sm py-space-md">
            <nav className="flex flex-col gap-1">
              <NavLink to={ROUTES.overview} end className={navCls('py-2.5')}>
                <Icon name="dashboard" className="text-[22px]" />
                <span className="font-label-lg text-[15px]">Tổng quan</span>
              </NavLink>
            </nav>
            <div className="px-space-md pb-space-xs pt-space-md">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed-dim/70">Quản lý Merchant</span>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={navCls('py-2.5')}>
                  <Icon name={item.icon} className="text-[22px]" />
                  <span className="font-label-lg text-[15px]">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
        <div className="border-t border-inverse-surface/40 p-space-sm">
          <nav className="flex flex-col gap-1">
            <NavLink to={ROUTES.settings} className={navCls('py-2')}>
              <Icon name="settings" className="text-[20px]" />
              <span className="font-label-md text-[14px]">Cài đặt</span>
            </NavLink>
            <NavLink to={ROUTES.help} className={navCls('py-2')}>
              <Icon name="live_help" className="text-[20px]" />
              <span className="font-label-md text-[14px]">Trợ giúp</span>
            </NavLink>
          </nav>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64 print:pl-0">
        <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between gap-2 bg-surface-container-lowest/90 px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:left-64 print:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Mở menu" aria-controls="app-sidebar" aria-expanded={drawer}
              className="-ml-2 flex-shrink-0 rounded-full p-2 text-on-surface hover:bg-surface-container lg:hidden">
              <Icon name="menu" className="text-[24px]" />
            </button>
            {/* phones: current page title only */}
            <div className="min-w-0 truncate font-headline-md text-[17px] font-bold text-on-surface md:hidden" data-testid="header-title">{title}</div>
            {/* tablet+: full linked breadcrumb */}
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-space-sm font-body-md text-[15px] text-secondary md:flex">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1
                return (
                  <span key={`${c.label}-${i}`} className={`flex items-center gap-space-sm ${last ? 'min-w-0' : 'flex-shrink-0'}`}>
                    {i > 0 && <Icon name="chevron_right" className="text-[18px]" />}
                    {c.to && !last ? (
                      <Link to={c.to} className="max-w-[14rem] truncate transition-colors hover:text-primary hover:underline">{c.label}</Link>
                    ) : (
                      <span aria-current={last ? 'page' : undefined} className={`truncate ${last ? 'font-label-lg text-[15px] font-semibold text-on-surface' : ''}`}>{c.label}</span>
                    )}
                  </span>
                )
              })}
            </nav>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-space-md">
            <div className="hidden items-center gap-2 rounded-full bg-surface-container px-3 py-1.5 font-label-md text-[14px] font-semibold text-on-surface xl:flex" title="Múi giờ hiển thị">
              <Icon name="schedule" className="text-[18px] text-tertiary" />
              <span>GMT+7</span>
            </div>
            <NotificationBell />
            <LanguageMenu />
            <div className="hidden h-6 w-[1px] bg-secondary-container md:block" />
            <UserMenu />
          </div>
        </header>

        <main className="relative min-h-screen w-full min-w-0 bg-background pt-16 print:pt-0">
          <Outlet />
        </main>
      </div>

      {toastMsg && (
        <div
          className="fixed bottom-4 left-1/2 z-[120] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl bg-inverse-surface px-5 py-3 font-label-lg text-[14px] text-inverse-on-surface shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 print:hidden"
          role="status"
        >
          <Icon name="check_circle" className="flex-shrink-0 text-[20px] text-tertiary-fixed-dim" />
          <span className="min-w-0">{toastMsg}</span>
        </div>
      )}
    </LayoutContext.Provider>
  )
}
