import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { btnPrimary, btnSecondary } from '../components/Form'
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, merchantStatus } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { formatDate, formatNumber, formatVnd, hashCode, parseDate, relativeTime } from '../lib/format'
import { useBreadcrumb } from '../lib/layoutContext'
import { contactsPath, merchantPath, ROUTES, subscriptionPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { ActivityLog, Merchant } from '../lib/types'
import { useQuery } from '../lib/useQuery'


type Tab = 'all' | ActivityLog['category']
type DateRange = 'today' | '7days' | '30days' | 'all'

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày qua' },
  { value: '30days', label: '30 ngày qua' },
  { value: 'all', label: 'Tất cả thời gian' },
]

const ACTOR_LABELS: Record<ActivityLog['actor_type'], string> = {
  owner: 'Chủ quán',
  cashier: 'Nhân viên thu ngân',
  system: 'Hệ thống POS / Máy in Bill',
  support: 'CSKH Giaodoan Platform',
  guest: 'Khách / Không xác định',
}

// Icon-box colours per action (written out in full so Tailwind can see them)
const ICON_BOX: Record<ActivityLog['action_type'], string> = {
  pause_orders: 'bg-primary-fixed text-primary-container',
  resume_orders: 'bg-tertiary-fixed text-tertiary',
  update_store: 'bg-surface-container-highest text-on-background',
  update_menu: 'bg-surface-container-high text-primary',
  confirm_order: 'bg-tertiary-fixed text-on-tertiary-container',
  cancel_order: 'bg-error-container text-error',
  create_promo: 'bg-primary-fixed text-primary-container',
  login_failed: 'bg-error-container text-error',
  pos_sync: 'bg-surface-container text-primary-container',
  update_document: 'bg-surface-container-high text-on-background',
}

const STATUS_CHIP: Record<ActivityLog['status'], { cls: string; icon: string }> = {
  success: { cls: 'bg-tertiary-fixed text-on-tertiary-container', icon: 'check_circle' },
  failed: { cls: 'bg-error-container text-error', icon: 'error' },
  warning: { cls: 'bg-primary-fixed text-primary-container', icon: 'warning' },
  cancelled: { cls: 'bg-surface-container-high text-on-surface', icon: 'info' },
}

const pad = (n: number) => String(n).padStart(2, '0')
function timeWithSeconds(value: string) {
  const d = parseDate(value)
  if (!d || isNaN(d.getTime())) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low px-3 py-2.5 font-body-md text-[16px] sm:text-body-md text-on-surface transition-all focus:outline-none focus:ring-2 focus:ring-primary-container/30'

export default function MerchantActivity() {
  const { id } = useParams()
  const PAGE_SIZE = useSettings().settings.pageSize

  const merchantQ = useQuery<Merchant>(() => supabase.from('merchants').select('*').eq('id', id!).single(), [id])
  const planQ = useQuery<{ plan_name: string; plan_tier: string; end_date: string } | null>(
    () => supabase.from('subscriptions').select('plan_name,plan_tier,end_date').eq('merchant_id', id!).eq('is_current', true).maybeSingle(),
    [id],
  )
  const logsQ = useQuery<ActivityLog[]>(
    () => supabase.from('activity_logs').select('*').eq('merchant_id', id!).order('occurred_at', { ascending: false }),
    [id],
  )

  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [actionType, setActionType] = useState('all')
  const [status, setStatus] = useState('all')
  const [actor, setActor] = useState('all')
  const [range, setRange] = useState<DateRange>('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<ActivityLog | null>(null)
  const [spinning, setSpinning] = useState(false)

  const m = merchantQ.data
  useBreadcrumb(m ? [{ label: 'Hồ sơ Merchant', to: ROUTES.merchants }, { label: `${m.name} (${hashCode(m.code)})`, to: merchantPath(m.id) }, 'Lịch sử hoạt động'] : null)

  const logs = useMemo(() => logsQ.data ?? [], [logsQ.data])

  const actionOptions = useMemo(() => {
    const map = new Map<string, string>()
    logs.forEach((l) => map.set(l.action_type, l.action_label))
    return [...map.entries()]
  }, [logs])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    const now = Date.now()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return logs.filter((l) => {
      if (tab !== 'all' && l.category !== tab) return false
      if (actionType !== 'all' && l.action_type !== actionType) return false
      if (status !== 'all' && l.status !== status) return false
      if (actor !== 'all' && l.actor_type !== actor) return false
      const t = new Date(l.occurred_at).getTime()
      if (range === 'today' && t < startOfToday.getTime()) return false
      if (range === '7days' && now - t > 7 * 86400000) return false
      if (range === '30days' && now - t > 30 * 86400000) return false
      if (!needle) return true
      const extra = Object.values(l.extra ?? {}).join(' ')
      return [l.action_label, l.subtitle, l.details, l.actor_name, l.actor_role, l.device, l.ip, extra].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [logs, q, tab, actionType, status, actor, range])

  // KPIs (computed from all fetched rows)
  const total = logs.length
  const ok = logs.filter((l) => l.status === 'success').length
  const bad = logs.filter((l) => l.status === 'failed' || l.status === 'warning').length
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0)
  const last24h = logs.filter((l) => Date.now() - new Date(l.occurred_at).getTime() < 86400000).length
  const topError = useMemo(() => {
    const counts = new Map<string, number>()
    logs.filter((l) => l.status === 'failed' || l.status === 'warning').forEach((l) => counts.set(l.action_label, (counts.get(l.action_label) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k)
  }, [logs])
  const critical = logs.find((l) => l.status === 'failed' || l.status === 'warning' || l.action_type === 'pause_orders') ?? logs[0]

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)
  const reset = () => setPage(1)

  function refresh() {
    setSpinning(true)
    logsQ.reload()
    window.setTimeout(() => setSpinning(false), 700)
  }

  function exportLogs() {
    exportCsv(
      `lich-su-hoat-dong-${m?.code ?? 'merchant'}.csv`,
      [
        { header: 'Thời điểm', value: (l: ActivityLog) => `${formatDate(l.occurred_at)} ${timeWithSeconds(l.occurred_at)}` },
        { header: 'Hành động', value: (l) => l.action_label },
        { header: 'Nhóm', value: (l) => ACTIVITY_CATEGORIES[l.category] },
        { header: 'Chi tiết', value: (l) => l.details },
        { header: 'Trạng thái trước', value: (l) => l.old_value },
        { header: 'Sau thay đổi', value: (l) => l.new_value },
        { header: 'Người thực hiện', value: (l) => [l.actor_name, l.actor_role && `(${l.actor_role})`].filter(Boolean).join(' ') },
        { header: 'Thiết bị', value: (l) => l.device },
        { header: 'IP', value: (l) => l.ip },
        { header: 'Trạng thái', value: (l) => ACTIVITY_STATUSES[l.status] },
      ],
      filtered,
    )
  }

  if (merchantQ.loading && !m) return <Loading />
  if (merchantQ.error || !m) return <div className="px-margin py-space-lg"><ErrorState message={merchantQ.error ?? 'Không tìm thấy merchant.'} onRetry={merchantQ.reload} /></div>

  const meta = merchantStatus(m.status)
  const plan = planQ.data

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'Tất cả nhật ký' },
    { value: 'orders', label: ACTIVITY_CATEGORIES.orders },
    { value: 'config', label: ACTIVITY_CATEGORIES.config },
    { value: 'security', label: ACTIVITY_CATEGORIES.security },
  ]

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      {/* Section 1: merchant identity */}
      <div className="flex flex-col gap-space-md">
        <div>
          <Link to={merchantPath(m.id)} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-surface-container px-space-md py-1.5 font-label-md text-label-md text-on-surface transition-all hover:bg-surface-container-high">
            <Icon name="arrow_back" className="text-[18px]" />
            <span>Quay lại Hồ sơ Merchant</span>
          </Link>
        </div>

        <div className="flex flex-col justify-between gap-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-space-md sm:gap-space-lg">
            <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high shadow-sm sm:h-16 sm:w-16">
              {m.image_url ? (
                <img className="h-full w-full object-cover" alt={m.name} src={m.image_url} />
              ) : (
                <span className="text-[30px]">{m.emoji ?? <Icon name={m.icon ?? 'storefront'} className="text-[30px] text-primary" />}</span>
              )}
              <div className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-surface-container-lowest ${meta.dot}`} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-space-sm">
                <h1 className="min-w-0 break-words font-headline-lg text-[19px] tracking-tight text-on-surface sm:text-headline-lg">
                  <Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">{m.name}</Link>
                </h1>
                <Link to={merchantPath(m.id)} className="rounded-full bg-secondary-container px-2.5 py-0.5 font-mono font-label-sm text-label-sm text-on-secondary-container hover:underline">{hashCode(m.code)}</Link>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${meta.pill}`}>
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  <span>{meta.label}</span>
                </span>
              </div>
              <div className="flex flex-col gap-x-space-lg gap-y-1 font-body-sm text-body-sm text-secondary sm:flex-row sm:flex-wrap sm:items-center">
                <span className="flex items-center gap-1">
                  <Icon name="location_on" className="flex-shrink-0 text-[16px] text-primary" /> <span className="min-w-0">{m.address_full ?? m.address}</span>
                </span>
                {plan && (
                  <Link to={subscriptionPath(m.id)} className="flex items-center gap-1 hover:text-primary hover:underline">
                    <Icon name="workspace_premium" className="text-[16px] text-primary-container" />
                    <span className="font-label-sm text-label-sm text-on-surface">{plan.plan_name}</span> (Hạn dùng: {formatDate(plan.end_date)})
                  </Link>
                )}
                <span className="flex items-center gap-1">
                  <Icon name="storefront" className="text-[16px] text-tertiary" /> {m.branch_type && m.category ? `${m.branch_type} (${m.category})` : (m.branch_type ?? m.category ?? '—')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-space-sm max-sm:[&>*]:flex-1">
            <Link to={contactsPath(m.code)} className={btnSecondary}>
              <Icon name="call" className="text-[18px] text-primary-container" />
              <span>Lịch sử liên hệ</span>
            </Link>
            <button type="button" onClick={refresh} className={btnSecondary}>
              <Icon name="refresh" className={`text-[18px] text-primary-container ${spinning ? 'animate-spin' : ''}`} />
              <span>Làm mới nhật ký</span>
            </button>
            <button type="button" onClick={exportLogs} disabled={filtered.length === 0} className={btnPrimary}>
              <Icon name="download" className="text-[18px]" />
              <span>Xuất file Excel nhật ký</span>
            </button>
          </div>
        </div>
      </div>

      {logsQ.loading && !logsQ.data ? (
        <Loading />
      ) : logsQ.error ? (
        <ErrorState message={logsQ.error} onRetry={logsQ.reload} />
      ) : (
        <>
          {/* Section 2: KPI cards */}
          <div className="grid grid-cols-2 gap-space-md xl:grid-cols-4">
            <div className="relative flex min-w-0 flex-col justify-between gap-space-md overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
              <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-surface-container-high/40" />
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 font-label-md text-label-md uppercase tracking-wider text-secondary">Tổng hoạt động ghi nhận</span>
                <span className="rounded-lg bg-surface-container p-2 text-primary-container"><Icon name="dataset" className="text-[20px]" /></span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-headline-xl text-headline-xl tracking-tight text-on-surface">{formatNumber(total)}</span>
                <span className="font-body-sm text-body-sm text-secondary">Toàn bộ nhật ký</span>
              </div>
              <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-tertiary">
                <Icon name="trending_up" className="text-[16px]" />
                <span>+{last24h} hành động trong 24 giờ qua</span>
              </div>
            </div>

            <div className="relative flex min-w-0 flex-col justify-between gap-space-md overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
              <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-tertiary-fixed/30" />
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 font-label-md text-label-md uppercase tracking-wider text-secondary">Tác vụ thành công</span>
                <span className="rounded-lg bg-tertiary-fixed p-2 text-on-tertiary-container"><Icon name="task_alt" className="text-[20px]" /></span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-headline-xl text-headline-xl tracking-tight text-on-surface">{formatNumber(ok)}</span>
                <span className="rounded-full bg-tertiary-fixed px-2 py-0.5 font-label-sm text-label-sm text-on-tertiary-container">{pct(ok)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                <div className="h-full rounded-full bg-tertiary-container" style={{ width: `${pct(ok)}%` }} />
              </div>
            </div>

            <div className="relative flex min-w-0 flex-col justify-between gap-space-md overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
              <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-error-container/40" />
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 font-label-md text-label-md uppercase tracking-wider text-secondary">Lỗi / Cảnh báo hệ thống</span>
                <span className="rounded-lg bg-error-container p-2 text-error"><Icon name="report_problem" className="text-[20px]" /></span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-headline-xl text-headline-xl tracking-tight text-error">{formatNumber(bad)}</span>
                <span className="rounded-full bg-error-container px-2 py-0.5 font-label-sm text-label-sm text-on-error-container">{pct(bad)}% rủi ro</span>
              </div>
              <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-error">
                <Icon name="priority_high" className="text-[16px]" />
                <span>{topError.length ? `Chủ yếu: ${topError.join(' & ')}` : 'Không có lỗi nào được ghi nhận'}</span>
              </div>
            </div>

            <div className="col-span-2 flex min-w-0 flex-col justify-between gap-space-md rounded-xl border-l-4 border-primary-container bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg xl:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 font-label-md text-label-md uppercase tracking-wider text-secondary">Hành động quan trọng nhất</span>
                <span className="rounded-lg bg-primary-fixed p-2 text-primary-container"><Icon name="notification_important" className="text-[20px]" /></span>
              </div>
              {critical ? (
                <>
                  <div>
                    <h2 className="line-clamp-1 font-headline-md text-headline-md text-on-surface">{critical.action_label}</h2>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Bởi {critical.actor_name ?? '—'}{critical.actor_role ? ` (${critical.actor_role})` : ''} lúc {timeWithSeconds(critical.occurred_at).slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 font-label-sm text-label-sm text-on-primary-fixed">{relativeTime(critical.occurred_at)}</span>
                    <button type="button" onClick={() => setDetail(critical)} className="flex items-center font-label-sm text-label-sm text-primary-container hover:underline">
                      Chi tiết <Icon name="arrow_forward" className="text-[14px]" />
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-secondary">Chưa có hoạt động nào.</p>
              )}
            </div>
          </div>

          {/* Section 3: filters */}
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
            <div className="flex flex-col items-stretch justify-between gap-space-md lg:flex-row lg:items-center">
              <SearchInput className="lg:max-w-xl" value={q} onChange={(v) => { setQ(v); reset() }} placeholder="Tìm theo mã đơn #DH, thao tác, IP, thiết bị, tên nhân sự..." />
              <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg bg-surface-container-low p-1 lg:flex-shrink-0">
                {tabs.map((t) => (
                  <button key={t.value} type="button" onClick={() => { setTab(t.value); reset() }}
                    className={`min-h-[40px] whitespace-nowrap rounded-md px-3.5 py-1.5 font-label-md text-label-md transition-all ${tab === t.value ? 'bg-primary-container text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-space-md pt-space-xs sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect label="Loại hành động">
                <select className={selectCls} value={actionType} onChange={(e) => { setActionType(e.target.value); reset() }}>
                  <option value="all">Tất cả hành động ({actionOptions.length} mục)</option>
                  {actionOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </FilterSelect>
              <FilterSelect label="Trạng thái xử lý">
                <select className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); reset() }}>
                  <option value="all">Tất cả trạng thái</option>
                  <option value="success">Thành công (Success)</option>
                  <option value="failed">Thất bại / Lỗi (Failed)</option>
                  <option value="warning">Cảnh báo (Warning)</option>
                  <option value="cancelled">Đã hủy (Cancelled)</option>
                </select>
              </FilterSelect>
              <FilterSelect label="Đối tượng thực hiện">
                <select className={selectCls} value={actor} onChange={(e) => { setActor(e.target.value); reset() }}>
                  <option value="all">Tất cả đối tượng</option>
                  {(Object.keys(ACTOR_LABELS) as ActivityLog['actor_type'][]).map((a) => <option key={a} value={a}>{ACTOR_LABELS[a]}</option>)}
                </select>
              </FilterSelect>
              <FilterSelect label="Khoảng thời gian" icon="calendar_month">
                <select className={selectCls} value={range} onChange={(e) => { setRange(e.target.value as DateRange); reset() }}>
                  {DATE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </FilterSelect>
            </div>
          </div>

          {/* Section 4: table */}
          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="flex flex-col gap-space-sm bg-surface-container-low px-space-md py-space-md sm:flex-row sm:items-center sm:justify-between sm:px-space-lg">
              <div className="flex flex-wrap items-center gap-space-sm">
                <span className="font-headline-md text-headline-md text-on-surface">Nhật ký chi tiết các sự kiện</span>
                <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface">{formatNumber(filtered.length)} dòng</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-body-sm text-secondary">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-tertiary" /> Thành công</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-error" /> Lỗi / Thất bại</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary-container" /> Cảnh báo</span>
              </div>
            </div>
            <ResponsiveTable minWidth={980}
              cards={pageRows.map((l) => {
                const chip = STATUS_CHIP[l.status]
                return (
                  <MobileCard key={l.id}
                    title={l.action_label}
                    subtitle={`${timeWithSeconds(l.occurred_at)} · ${formatDate(l.occurred_at)} · ${relativeTime(l.occurred_at)}`}
                    badge={
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-label-sm text-label-sm ${chip.cls}`}>
                        <Icon name={chip.icon} className="text-[14px]" />
                        <span>{ACTIVITY_STATUSES[l.status]}</span>
                      </span>
                    }
                    fields={[
                      ['Người thực hiện', `${l.actor_name ?? ACTOR_LABELS[l.actor_type]}${l.actor_role ? ` (${l.actor_role})` : ''}`],
                      ['Thiết bị', l.device ?? '—'],
                    ]}
                    actions={
                      <button type="button" onClick={() => setDetail(l)} className={`${btnSecondary} !min-h-[40px] !py-2 !text-[13px]`}>
                        <Icon name="terminal" className="text-[18px]" /> Chi tiết log
                      </button>
                    }
                  />
                )
              })}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-primary-container text-on-primary">
                    <th scope="col" className="w-48 px-space-md py-3.5 font-label-md text-label-md uppercase tracking-wider">Thời điểm</th>
                    <th scope="col" className="w-64 px-space-md py-3.5 font-label-md text-label-md uppercase tracking-wider">Hành động</th>
                    <th scope="col" className="px-space-md py-3.5 font-label-md text-label-md uppercase tracking-wider">Chi tiết nội dung &amp; Biến động</th>
                    <th scope="col" className="w-64 px-space-md py-3.5 font-label-md text-label-md uppercase tracking-wider">Người thực hiện &amp; Thiết bị</th>
                    <th scope="col" className="w-36 px-space-md py-3.5 text-center font-label-md text-label-md uppercase tracking-wider">Trạng thái</th>
                    <th scope="col" className="w-28 px-space-md py-3.5 text-center font-label-md text-label-md uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-md text-body-md text-on-surface">
                  {pageRows.map((l, i) => {
                    const failed = l.status === 'failed'
                    const chip = STATUS_CHIP[l.status]
                    return (
                      <tr key={l.id} className={`group transition-colors hover:bg-primary-fixed/10 ${failed ? 'bg-error-container/10' : ''}`}>
                        <td className="px-space-md py-3.5 align-top">
                          <div className="flex flex-col">
                            <span className={`font-label-md text-label-md font-semibold ${failed ? 'text-error' : 'text-on-surface'}`}>{timeWithSeconds(l.occurred_at)}</span>
                            <span className="font-body-sm text-body-sm text-secondary">{formatDate(l.occurred_at)}</span>
                            <span className={`mt-0.5 font-label-sm text-label-sm ${failed ? 'text-error' : page === 1 && i === 0 ? 'font-medium text-primary' : 'text-secondary'}`}>{relativeTime(l.occurred_at)}</span>
                          </div>
                        </td>
                        <td className="px-space-md py-3.5 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${ICON_BOX[l.action_type] ?? 'bg-surface-container text-primary-container'}`}>
                              <Icon name={l.icon ?? 'history'} className="text-[20px]" />
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className={`truncate font-label-md text-label-md font-semibold ${failed || l.action_type === 'cancel_order' ? 'text-error' : 'text-on-surface'}`}>{l.action_label}</span>
                              <span className="font-body-sm text-body-sm text-secondary">{l.subtitle}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-3.5 align-top">
                          <div className="flex flex-col gap-1">
                            <p className="font-body-md text-body-md text-on-surface">{l.details}</p>
                            {(l.old_value || l.new_value) && (
                              <div className="flex items-center gap-2 font-body-sm text-body-sm text-secondary">
                                <span>Trạng thái trước: <strong className="text-tertiary">{l.old_value ?? '—'}</strong></span>
                                <span>→</span>
                                <span>Sau thay đổi: <strong className="text-error">{l.new_value ?? '—'}</strong></span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-space-md py-3.5 align-top">
                          <div className="flex flex-col">
                            <span className={`font-label-md text-label-md font-semibold ${failed ? 'text-error' : 'text-on-surface'}`}>
                              {l.actor_name ?? ACTOR_LABELS[l.actor_type]}{l.actor_role ? ` (${l.actor_role})` : ''}
                            </span>
                            <span className="font-body-sm text-body-sm text-secondary">{l.device}</span>
                            <span className={`font-mono font-label-sm text-label-sm ${failed ? 'text-error' : 'text-secondary'}`}>{l.ip}</span>
                          </div>
                        </td>
                        <td className="px-space-md py-3.5 text-center align-top">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-label-sm text-label-sm ${chip.cls}`}>
                            <Icon name={chip.icon} className="text-[14px]" />
                            <span>{ACTIVITY_STATUSES[l.status]}</span>
                          </span>
                        </td>
                        <td className="px-space-md py-3.5 text-center align-top">
                          <button type="button" title="Xem chi tiết log" onClick={() => setDetail(l)}
                            className={`min-h-[40px] min-w-[40px] rounded-lg p-2 text-secondary transition-colors hover:bg-surface-container ${failed ? 'hover:text-error' : 'hover:text-primary'}`}>
                            <Icon name="terminal" className="text-[20px]" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ResponsiveTable>
            {filtered.length === 0 && <EmptyState message="Không có hoạt động nào phù hợp với bộ lọc." />}
            {filtered.length > PAGE_SIZE && <Pagination page={curPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} label="dòng nhật ký" />}
          </div>
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Chi tiết log: ${detail.action_label}` : ''}
        footer={<button type="button" className={btnSecondary} onClick={() => setDetail(null)}>Đóng</button>}>
        {detail && <LogDetail log={detail} />}
      </Modal>
    </div>
  )
}

function FilterSelect({ label, icon = 'expand_more', children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-label-sm text-label-sm text-secondary">{label}</label>
      <div className="relative">
        {children}
        <Icon name={icon} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
      </div>
    </div>
  )
}

function LogDetail({ log }: { log: ActivityLog }) {
  const extra = log.extra ?? {}
  const labels: Record<string, string> = {
    order_code: 'Mã đơn', amount_vnd: 'Giá trị', voucher_code: 'Mã voucher', error_code: 'Mã lỗi', reason: 'Lý do', items: 'Món', payment: 'Thanh toán',
  }
  const rows: [string, string][] = [
    ['Thời điểm', `${timeWithSeconds(log.occurred_at)} - ${formatDate(log.occurred_at)} (${relativeTime(log.occurred_at)})`],
    ['Nhóm', ACTIVITY_CATEGORIES[log.category]],
    ['Trạng thái', ACTIVITY_STATUSES[log.status]],
    ['Người thực hiện', `${log.actor_name ?? ACTOR_LABELS[log.actor_type]}${log.actor_role ? ` (${log.actor_role})` : ''}`],
    ['Thiết bị', log.device ?? '—'],
    ['Địa chỉ IP / Mã thiết bị', log.ip ?? '—'],
    ...(log.old_value || log.new_value ? ([['Biến động', `${log.old_value ?? '—'} → ${log.new_value ?? '—'}`]] as [string, string][]) : []),
    ...Object.entries(extra).map(([k, v]): [string, string] => [labels[k] ?? k, k.endsWith('_vnd') && typeof v === 'number' ? formatVnd(v) : String(v)]),
  ]
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-surface-container-low p-3 font-body-md text-[14px] text-on-surface">{log.details ?? '—'}</p>
      <dl className="grid grid-cols-1 gap-y-0.5 text-[14px] sm:grid-cols-[170px_1fr] sm:gap-x-4 sm:gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="mt-2 font-label-md text-secondary sm:mt-0">{k}</dt>
            <dd className="break-words font-medium text-on-surface">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
