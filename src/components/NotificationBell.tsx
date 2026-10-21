import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useDismiss } from '../lib/useDismiss'
import { activityPath, ROUTES, supportPath } from '../lib/links'
import { relativeTime } from '../lib/format'

const SEEN_KEY = 'gd.notif.seenAt'
const OPEN_STATUSES = ['new', 'processing', 'waiting_merchant']
const TICKET_COLS = 'id,code,subject,priority,status,sla_due_at,updated_at,merchant:merchants(name,code)'

interface Item {
  key: string
  to: string
  icon: string
  tone: 'danger' | 'warning' | 'neutral'
  title: string
  sub: string
  at: string
}

interface MerchantRef { name: string; code: string }
type Embedded = MerchantRef | MerchantRef[] | null
const m1 = (m: Embedded): MerchantRef | null => (Array.isArray(m) ? (m[0] ?? null) : m)

async function loadItems(): Promise<Item[]> {
  const nowIso = new Date().toISOString()
  const [acts, tickets, overdue] = await Promise.all([
    supabase.from('activity_logs').select('id,merchant_id,occurred_at,action_label,subtitle,icon,status,merchant:merchants(name,code)').order('occurred_at', { ascending: false }).limit(8),
    supabase.from('support_tickets').select(TICKET_COLS).in('status', OPEN_STATUSES).order('updated_at', { ascending: false }).limit(20),
    // own query: old overdue tickets must not be dropped by the limit of the "latest open" query above
    supabase.from('support_tickets').select(TICKET_COLS).in('status', OPEN_STATUSES).lt('sla_due_at', nowIso).order('sla_due_at', { ascending: true }).limit(20),
  ])
  if (acts.error) throw acts.error
  if (tickets.error) throw tickets.error
  if (overdue.error) throw overdue.error
  const now = Date.now()
  const items: Item[] = []
  const seen = new Set<string>()
  for (const t of [...(overdue.data ?? []), ...(tickets.data ?? [])]) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    const late = t.sla_due_at ? new Date(t.sla_due_at).getTime() < now : false
    const m = m1(t.merchant as Embedded)
    items.push({
      key: `t-${t.id}`,
      to: supportPath(t.id),
      icon: late ? 'alarm' : 'headset_mic',
      tone: late ? 'danger' : t.priority === 'high' ? 'warning' : 'neutral',
      title: `${late ? 'Quá hạn SLA · ' : 'Yêu cầu hỗ trợ · '}#${t.code}`,
      sub: `${m?.name ?? 'Merchant'}${t.subject ? ' — ' + t.subject : ''}`,
      at: late ? (t.sla_due_at as string) : t.updated_at,
    })
  }
  for (const a of acts.data ?? []) {
    const m = m1(a.merchant as Embedded)
    items.push({
      key: `a-${a.id}`,
      to: activityPath(a.merchant_id),
      icon: a.icon || 'history',
      tone: a.status === 'failed' ? 'danger' : a.status === 'warning' ? 'warning' : 'neutral',
      title: a.action_label,
      sub: `${m?.name ?? 'Merchant'}${a.subtitle ? ' — ' + a.subtitle : ''}`,
      at: a.occurred_at,
    })
  }
  // overdue tickets first, then newest first
  items.sort((x, y) => (x.tone === 'danger' && x.key.startsWith('t-') ? 0 : 1) - (y.tone === 'danger' && y.key.startsWith('t-') ? 0 : 1) || +new Date(y.at) - +new Date(x.at))
  return items.slice(0, 8)
}

const TONE = { danger: 'bg-error-container text-error', warning: 'bg-[#FEF3C7] text-[#92400E]', neutral: 'bg-surface-container text-secondary' }

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seenAt, setSeenAt] = useState<number>(() => Number(localStorage.getItem(SEEN_KEY) ?? 0))
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const { pathname } = useLocation()
  useDismiss(ref, open, close)
  useEffect(close, [pathname, close])

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured) {
      setError('Chưa cấu hình Supabase nên chưa có thông báo.')
      return
    }
    loadItems().then((i) => { setItems(i); setError(null) }).catch((e: { message?: string }) => setError(e.message ?? 'Lỗi tải thông báo'))
  }, [])
  useEffect(refresh, [refresh])

  const unseen = useMemo(() => (items ?? []).some((i) => new Date(i.at).getTime() > seenAt), [items, seenAt])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      refresh()
      const now = Date.now()
      localStorage.setItem(SEEN_KEY, String(now))
      // keep the red dot out of the way only after the panel has been opened
      setSeenAt(now)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} title="Thông báo hệ thống" aria-label="Thông báo" aria-expanded={open}
        className="relative rounded-full p-2 text-secondary transition-colors hover:bg-surface-container hover:text-on-surface">
        <Icon name="notifications" className="text-[24px]" />
        {unseen && <span data-testid="notif-dot" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary-container ring-2 ring-surface-container-lowest" />}
      </button>
      {open && (
        <div role="dialog" aria-label="Thông báo"
          className="fixed inset-x-2 top-[4.25rem] z-[60] flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl ring-1 ring-secondary-container/60 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem] sm:max-h-[32rem]">
          <div className="flex items-center justify-between border-b border-surface-container px-4 py-3">
            <h2 className="font-headline-md text-[16px] font-bold text-on-surface">Thông báo</h2>
            <button type="button" onClick={close} className="rounded-lg p-1 text-secondary hover:bg-surface-container sm:hidden" aria-label="Đóng">
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {error && <p className="px-4 py-6 text-center text-[13px] text-error">{error}</p>}
            {!error && items === null && <p className="px-4 py-6 text-center text-[13px] text-secondary">Đang tải...</p>}
            {!error && items?.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-secondary">Chưa có thông báo mới.</p>}
            <ul>
              {items?.map((i) => (
                <li key={i.key}>
                  <Link to={i.to} onClick={close} className="flex items-start gap-3 border-b border-surface-container/60 px-4 py-3 hover:bg-surface-container-low">
                    <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${TONE[i.tone]}`}>
                      <Icon name={i.icon} className="text-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-label-lg text-[14px] font-semibold text-on-surface">{i.title}</span>
                      <span className="block truncate text-[13px] text-secondary">{i.sub}</span>
                      <span className="block text-[12px] text-secondary/80">{relativeTime(i.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link to={ROUTES.overview} onClick={close} className="border-t border-surface-container px-4 py-3 text-center font-label-lg text-[14px] font-bold text-primary hover:bg-surface-container-low">
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  )
}
