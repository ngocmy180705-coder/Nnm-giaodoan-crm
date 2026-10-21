import { useCallback, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { useDismiss } from '../lib/useDismiss'
import { useSettings } from '../lib/settings'
import { ROUTES } from '../lib/links'
import { useEffect } from 'react'

function useCloseOnRoute(close: () => void) {
  const { pathname } = useLocation()
  useEffect(close, [pathname, close])
}

/** Header language chip. Only Vietnamese exists; English is announced but disabled (no i18n). */
export function LanguageMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  return (
    <div ref={ref} className="relative hidden md:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-1.5 transition-colors hover:bg-surface-container">
        <span className="text-[18px]">🇻🇳</span>
        <span className="font-label-md text-[14px] font-bold text-on-surface">VIE</span>
        <Icon name="expand_more" className="text-[16px] text-secondary" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[60] mt-2 w-56 overflow-hidden rounded-xl bg-surface-container-lowest py-1 shadow-xl ring-1 ring-secondary-container/60">
          <button type="button" role="menuitemradio" aria-checked="true" onClick={close}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left font-label-lg text-[14px] text-on-surface hover:bg-surface-container-low">
            <span>Tiếng Việt</span>
            <Icon name="check" className="text-[18px] text-tertiary" />
          </button>
          <button type="button" role="menuitemradio" aria-checked="false" disabled title="Chưa hỗ trợ"
            className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-4 py-2.5 text-left font-label-lg text-[14px] text-secondary/60">
            <span>English (sắp ra mắt)</span>
          </button>
        </div>
      )}
    </div>
  )
}

/** Header avatar + name; click opens a small menu (Hồ sơ -> /settings, Trợ giúp -> /help). */
export function UserMenu() {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  useCloseOnRoute(close)
  const item = 'flex items-center gap-3 px-4 py-2.5 font-label-lg text-[14px] text-on-surface hover:bg-surface-container-low'
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu tài khoản"
        className="flex items-center gap-space-md rounded-lg p-1 transition-colors hover:bg-surface-container-low">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary shadow-sm ring-2 ring-primary/20">
          <Icon name="person" className="text-[20px] text-on-primary" />
        </span>
        <span className="hidden flex-col text-left md:flex">
          <span className="max-w-[10rem] truncate font-label-lg text-[15px] font-bold leading-tight text-on-surface">{settings.name}</span>
          <span className="max-w-[10rem] truncate font-label-md text-[13px] leading-tight text-secondary">{settings.role}</span>
        </span>
        <Icon name="expand_more" className="hidden text-[16px] text-secondary md:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[60] mt-2 w-60 overflow-hidden rounded-xl bg-surface-container-lowest py-1 shadow-xl ring-1 ring-secondary-container/60">
          <div className="border-b border-surface-container px-4 py-3">
            <div className="truncate font-label-lg text-[15px] font-bold text-on-surface">{settings.name}</div>
            <div className="truncate text-[13px] text-secondary">{settings.role}</div>
          </div>
          <Link to={ROUTES.settings} role="menuitem" onClick={close} className={item}>
            <Icon name="account_circle" className="text-[20px] text-secondary" />
            Hồ sơ &amp; cài đặt
          </Link>
          <Link to={ROUTES.help} role="menuitem" onClick={close} className={item}>
            <Icon name="live_help" className="text-[20px] text-secondary" />
            Trợ giúp
          </Link>
        </div>
      )}
    </div>
  )
}
