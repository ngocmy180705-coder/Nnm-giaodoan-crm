import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Field, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { insertContactLogs } from '../lib/contactLog'
import { CONTACT_CHANNELS, CONTACT_PURPOSES, CONTACT_STATUSES } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { formatDate, formatDateTime, formatDuration, formatNumber, formatTime, hashCode, initials, relativeTime } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { activityPath, merchantPath, subscriptionPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { ContactLog, ContactStatus, Merchant, Staff } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'

type MerchantLite = Pick<Merchant, 'id' | 'code' | 'name' | 'emoji' | 'icon' | 'phone'>
type StaffLite = Pick<Staff, 'id' | 'full_name' | 'role_label' | 'ext'>
type ContactRow = ContactLog & { merchant: MerchantLite | null; staff: StaffLite | null }
type Pill = 'all' | ContactStatus | 'callback'
type DateRange = '7' | '30' | '90' | 'all'

const CHANNEL_ICON: Record<ContactLog['channel'], string> = { voip: 'call', zalo: 'chat', visit: 'storefront', meet: 'videocam', note: 'edit_note' }
const CHANNEL_SHORT: Record<ContactLog['channel'], string> = { voip: 'VoIP In-app', zalo: 'Zalo OA', visit: 'Gặp trực tiếp', meet: 'Google Meet', note: 'Ghi chú' }

const STATUS_CLS: Record<ContactStatus, { chip: string; item: string; dot: string }> = {
  success: { chip: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', item: 'text-emerald-700 hover:bg-emerald-50', dot: 'bg-emerald-500' },
  no_answer: { chip: 'bg-amber-50 text-amber-700 hover:bg-amber-100', item: 'text-amber-700 hover:bg-amber-50', dot: 'bg-amber-500' },
  hung_up: { chip: 'bg-rose-50 text-rose-700 hover:bg-rose-100', item: 'text-rose-700 hover:bg-rose-50', dot: 'bg-rose-500' },
  pending: { chip: 'bg-sky-50 text-sky-700 hover:bg-sky-100', item: 'text-sky-700 hover:bg-sky-50', dot: 'bg-sky-500' },
}
const STATUS_ORDER: ContactStatus[] = ['success', 'no_answer', 'hung_up', 'pending']

const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low py-2.5 pl-space-md pr-8 font-label-md text-[16px] sm:text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30'

const endOfToday = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export default function Contacts() {
  const toast = useToast()
  const PAGE_SIZE = useSettings().settings.pageSize
  const [params] = useSearchParams()

  const logsQ = useQuery<ContactRow[]>(
    () =>
      supabase
        .from('contact_logs')
        .select('*, merchant:merchants(id,code,name,emoji,icon,phone), staff:staff(id,full_name,role_label,ext)')
        .order('occurred_at', { ascending: false }),
    [],
  )
  const staffQ = useQuery<Staff[]>(() => supabase.from('staff').select('*').order('code'), [])
  const merchantsQ = useQuery<MerchantLite[]>(() => supabase.from('merchants').select('id,code,name,emoji,icon,phone').order('code', { ascending: false }), [])

  const [q, setQ] = useState(params.get('q') ?? '')
  const urlQ = params.get('q')
  useEffect(() => {
    if (urlQ !== null) {
      setQ(urlQ)
      setPage(1)
    }
  }, [urlQ])

  const [pill, setPill] = useState<Pill>('all')
  const [staffId, setStaffId] = useState('')
  const [channel, setChannel] = useState('')
  const [purpose, setPurpose] = useState('')
  // arriving with ?q= (from a merchant profile) shows the merchant's whole history, so counts match the profile
  const [range, setRange] = useState<DateRange>(params.get('q') ? 'all' : '30')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  useNewParam(() => setAdding(true))
  const [viewing, setViewing] = useState<ContactRow | null>(null)

  const logs = useMemo(() => logsQ.data ?? [], [logsQ.data])
  const staff = staffQ.data ?? []

  /** All filters except the status pill — pill counts are computed from this. */
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    const now = Date.now()
    return logs.filter((l) => {
      if (staffId && l.staff_id !== staffId) return false
      if (channel && l.channel !== channel) return false
      if (purpose && l.purpose !== purpose) return false
      if (range !== 'all' && now - new Date(l.occurred_at).getTime() > Number(range) * 86400000) return false
      if (!needle) return true
      return [l.code, l.contact_person, l.content, l.purpose, l.merchant?.name, l.merchant?.code, l.merchant?.phone, l.staff?.full_name, l.actor_name].some((v) =>
        (v ?? '').toLowerCase().includes(needle),
      )
    })
  }, [logs, q, staffId, channel, purpose, range])

  const isCallbackToday = (l: ContactRow) => l.needs_callback && (!l.callback_at || new Date(l.callback_at).getTime() <= endOfToday())
  const counts = {
    all: base.length,
    success: base.filter((l) => l.status === 'success').length,
    no_answer: base.filter((l) => l.status === 'no_answer').length,
    hung_up: base.filter((l) => l.status === 'hung_up').length,
    pending: base.filter((l) => l.status === 'pending').length,
    callback: base.filter(isCallbackToday).length,
  }
  const filtered = useMemo(
    () => base.filter((l) => (pill === 'all' ? true : pill === 'callback' ? isCallbackToday(l) : l.status === pill)),
    [base, pill], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)
  const reset = () => setPage(1)

  // trend: last 7 days vs the 7 days before
  const trend = useMemo(() => {
    const now = Date.now()
    const cur = logs.filter((l) => now - new Date(l.occurred_at).getTime() <= 7 * 86400000).length
    const prev = logs.filter((l) => {
      const age = now - new Date(l.occurred_at).getTime()
      return age > 7 * 86400000 && age <= 14 * 86400000
    }).length
    return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
  }, [logs])

  /** The merchant the search box points at, when it is exactly a merchant code (e.g. ?q=MC-3926). */
  const qMerchant = useMemo(() => {
    const needle = q.trim().replace(/^#/, '').toLowerCase()
    return needle ? (merchantsQ.data ?? []).find((m) => m.code.toLowerCase() === needle) ?? null : null
  }, [q, merchantsQ.data])

  // Rates are over contacts actually attempted; 'pending' reminders (not sent yet) are excluded.
  const attempted = counts.all - counts.pending
  const rate = (n: number) => (attempted ? Math.round((n / attempted) * 1000) / 10 : 0)

  async function changeStatus(row: ContactRow, next: ContactStatus) {
    if (row.status === next) return
    const prev = row.status
    logsQ.setData((cur) => (cur ?? []).map((x) => (x.id === row.id ? { ...x, status: next } : x)))
    const { error } = await supabase.from('contact_logs').update({ status: next }).eq('id', row.id)
    if (error) {
      logsQ.setData((cur) => (cur ?? []).map((x) => (x.id === row.id ? { ...x, status: prev } : x)))
      toast(`Không cập nhật được trạng thái: ${error.message}`)
    } else {
      toast(`Đã cập nhật ${hashCode(row.code)} → ${CONTACT_STATUSES[next].label}`)
    }
  }

  function exportList() {
    exportCsv(
      'lich-su-lien-he.csv',
      [
        { header: 'Mã', value: (l: ContactRow) => l.code },
        { header: 'Kênh', value: (l) => l.channel_label ?? CONTACT_CHANNELS[l.channel] },
        { header: 'Nhân sự thực hiện', value: (l) => l.staff?.full_name ?? l.actor_name },
        { header: 'Mã Merchant', value: (l) => l.merchant?.code },
        { header: 'Merchant', value: (l) => l.merchant?.name },
        { header: 'Người liên hệ', value: (l) => l.contact_person },
        { header: 'Mục đích', value: (l) => l.purpose },
        { header: 'Nội dung', value: (l) => l.content },
        { header: 'Thẻ', value: (l) => l.tags.join('; ') },
        { header: 'Thời điểm', value: (l) => formatDateTime(l.occurred_at) },
        { header: 'Thời lượng', value: (l) => formatDuration(l.duration_seconds) },
        { header: 'Trạng thái', value: (l) => CONTACT_STATUSES[l.status].label },
        { header: 'Cần gọi lại', value: (l) => (l.needs_callback ? `Có (${formatDate(l.callback_at)})` : 'Không') },
      ],
      filtered,
    )
  }

  const pills: { value: Pill; label: string; cls: (on: boolean) => string }[] = [
    { value: 'all', label: `Tất cả (${formatNumber(counts.all)})`, cls: (on) => (on ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'bg-surface-container font-medium text-secondary hover:bg-surface-container-high hover:text-on-surface') },
    { value: 'success', label: `Thành công (${formatNumber(counts.success)})`, cls: (on) => (on ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'bg-surface-container font-medium text-secondary hover:bg-surface-container-high hover:text-on-surface') },
    { value: 'no_answer', label: `Không bắt máy (${formatNumber(counts.no_answer)})`, cls: (on) => (on ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'bg-surface-container font-medium text-secondary hover:bg-surface-container-high hover:text-on-surface') },
    { value: 'hung_up', label: `Cúp máy ngang (${formatNumber(counts.hung_up)})`, cls: (on) => (on ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'bg-surface-container font-medium text-secondary hover:bg-surface-container-high hover:text-on-surface') },
    { value: 'pending', label: `Chờ gửi (${formatNumber(counts.pending)})`, cls: (on) => (on ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'bg-surface-container font-medium text-secondary hover:bg-surface-container-high hover:text-on-surface') },
    { value: 'callback', label: `⚡ Cần gọi lại hôm nay (${formatNumber(counts.callback)})`, cls: (on) => (on ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'bg-amber-50 font-semibold text-amber-700 hover:bg-amber-100') },
  ]

  const statusSelect = (l: ContactRow) => (
    <select value={l.status} onChange={(e) => changeStatus(l, e.target.value as ContactStatus)} aria-label={`Trạng thái ${hashCode(l.code)}`}
      className={`min-h-[36px] cursor-pointer rounded-full border-0 px-3 py-1.5 font-label-md text-[13px] font-bold shadow-sm focus:outline-none ${STATUS_CLS[l.status].chip}`}>
      {STATUS_ORDER.map((s) => <option key={s} value={s}>{CONTACT_STATUSES[s].label}</option>)}
    </select>
  )

  const merchantLink = (l: ContactRow) =>
    l.merchant ? (
      <Link to={merchantPath(l.merchant.id)} onClick={(e) => e.stopPropagation()} className="-my-2 inline-block py-2 hover:text-primary hover:underline">{l.merchant.name}</Link>
    ) : (
      <span className="text-secondary">—</span>
    )

  const rowActions = (l: ContactRow) => (
    <>
      {l.has_recording && (
        <button type="button" disabled title="Bản ghi âm chưa được đồng bộ về CRM" aria-label="Nghe ghi âm (chưa khả dụng)"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-primary opacity-40">
          <Icon name="play_circle" className="text-[18px]" />
        </button>
      )}
      {l.merchant?.phone && (
        <a href={`tel:${l.merchant.phone.replace(/\s/g, '')}`} title={`Gọi lại ${l.merchant.phone}`} aria-label="Gọi lại"
          className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg p-2 text-tertiary transition-colors hover:bg-tertiary-fixed">
          <Icon name="call" className="text-[18px]" /><span className="text-[13px] font-semibold md:hidden">Gọi lại</span>
        </a>
      )}
      <button type="button" title="Xem chi tiết & ghi chú" aria-label="Xem chi tiết phiếu" onClick={() => setViewing(l)}
        className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg p-2 text-secondary transition-colors hover:bg-surface-container">
        <Icon name="visibility" className="text-[18px]" /><span className="text-[13px] font-semibold md:hidden">Chi tiết</span>
      </button>
    </>
  )

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        title="Lịch Sử Liên Hệ Đối Tác"
        subtitle="Nhật ký cuộc gọi, chăm sóc khách hàng và hỗ trợ đối tác Merchant của đội ngũ quản trị vận hành Giaodoan."
        actions={
          <>
            <button type="button" onClick={exportList} disabled={filtered.length === 0} className={btnSecondary}>
              <Icon name="file_download" className="text-[20px] text-tertiary" />
              <span>Xuất file Excel</span>
            </button>
            <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>
              <Icon name="add_call" className="text-[20px]" />
              <span>Ghi nhận cuộc gọi mới</span>
            </button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-space-md lg:grid-cols-4">
        <div className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-primary-container/10 transition-transform duration-300 group-hover:scale-125" />
          <div className="relative z-10 mb-space-sm flex items-center justify-between gap-2">
            <span className="min-w-0 font-label-md text-label-md uppercase tracking-wider text-secondary">Tổng lượt liên hệ</span>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary-container"><Icon name="phone_in_talk" className="text-[20px]" /></div>
          </div>
          <div className="relative z-10 flex flex-wrap items-baseline gap-x-space-md">
            <span className="font-headline-xl text-headline-xl font-bold text-on-surface">{formatNumber(counts.all)}</span>
            {trend !== null && (
              <div className={`inline-flex items-center font-label-md text-label-md font-semibold ${trend >= 0 ? 'text-tertiary' : 'text-error'}`}>
                <Icon name={trend >= 0 ? 'trending_up' : 'trending_down'} className="text-[16px]" />
                <span className="ml-0.5">{trend >= 0 ? '+' : ''}{trend}%</span>
              </div>
            )}
          </div>
          <span className="relative z-10 mt-space-xs font-body-sm text-body-sm text-secondary-fixed-variant">So với 7 ngày trước đó</span>
        </div>

        <StatKpi tint="bg-tertiary/10" iconBox="bg-tertiary-fixed/30 text-tertiary" icon="check_circle" label="Thành công" value={counts.success}
          badge={<span className="rounded-full bg-tertiary-fixed px-space-sm py-0.5 font-label-sm text-label-sm font-bold text-on-tertiary-container">{rate(counts.success)}% Tỷ lệ</span>}
          bar="bg-tertiary" pct={rate(counts.success)} />
        <StatKpi tint="bg-secondary-container/50" iconBox="bg-surface-container-high text-secondary" icon="phone_missed" label="Không bắt máy" value={counts.no_answer}
          badge={<span className="rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-label-sm font-bold text-on-secondary-container">{rate(counts.no_answer)}% Tỷ lệ</span>}
          bar="bg-secondary" pct={rate(counts.no_answer)} />
        <StatKpi tint="bg-error-container/40" iconBox="bg-error-container text-error" icon="phone_disabled" label="Cúp máy ngang" value={counts.hung_up}
          badge={<span className="rounded-full bg-error-container px-space-sm py-0.5 font-label-sm text-label-sm font-bold text-on-error-container">{rate(counts.hung_up)}% Rủi ro</span>}
          bar="bg-error" pct={rate(counts.hung_up)} />
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
        <div className="mb-space-md flex flex-col items-stretch justify-between gap-space-md lg:flex-row lg:items-center">
          <SearchInput className="lg:max-w-2xl" value={q} onChange={(v) => { setQ(v); reset() }} placeholder="Tìm theo tên Merchant, SĐT, Người liên hệ, mã cuộc gọi..." />
          <div className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0">
            {pills.map((p) => (
              <button key={p.value} type="button" onClick={() => { setPill(p.value); reset() }}
                className={`min-h-[40px] whitespace-nowrap rounded-lg px-space-md py-2 font-label-md text-label-md transition-colors ${p.cls(pill === p.value)}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-space-md pt-space-sm sm:grid-cols-2 lg:grid-cols-4">
          <FilterBox label="Nhân sự thực hiện">
            <select className={selectCls} value={staffId} onChange={(e) => { setStaffId(e.target.value); reset() }}>
              <option value="">Tất cả nhân sự ({staff.length})</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.role_label ? ` - ${s.role_label}` : ''}</option>)}
            </select>
          </FilterBox>
          <FilterBox label="Loại liên hệ">
            <select className={selectCls} value={channel} onChange={(e) => { setChannel(e.target.value); reset() }}>
              <option value="">Tất cả phương thức</option>
              {(Object.keys(CONTACT_CHANNELS) as ContactLog['channel'][]).map((c) => <option key={c} value={c}>{CONTACT_CHANNELS[c]}</option>)}
            </select>
          </FilterBox>
          <FilterBox label="Mục đích cuộc gọi">
            <select className={selectCls} value={purpose} onChange={(e) => { setPurpose(e.target.value); reset() }}>
              <option value="">Tất cả mục đích</option>
              {CONTACT_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FilterBox>
          <FilterBox label="Khoảng thời gian" icon="calendar_month">
            <select className={selectCls} value={range} onChange={(e) => { setRange(e.target.value as DateRange); reset() }}>
              <option value="7">7 ngày gần nhất</option>
              <option value="30">30 ngày gần nhất</option>
              <option value="90">90 ngày gần nhất</option>
              <option value="all">Tất cả thời gian</option>
            </select>
          </FilterBox>
        </div>
      </div>

      {/* Merchant context when the search matches exactly one merchant (e.g. arriving from a merchant profile) */}
      {qMerchant && (
        <div className="flex flex-col gap-space-sm rounded-xl bg-primary-fixed px-space-md py-space-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 text-[14px] text-on-surface">
            Đang xem lịch sử liên hệ của <Link to={merchantPath(qMerchant.id)} className="font-bold text-primary hover:underline">{qMerchant.name}</Link> ({hashCode(qMerchant.code)})
          </span>
          <div className="flex flex-wrap gap-space-sm text-[13px] font-semibold">
            <Link to={merchantPath(qMerchant.id)} className="inline-flex min-h-[40px] items-center rounded-lg bg-surface-container-lowest px-3 text-primary hover:underline">Hồ sơ</Link>
            <Link to={activityPath(qMerchant.id)} className="inline-flex min-h-[40px] items-center rounded-lg bg-surface-container-lowest px-3 text-primary hover:underline">Hoạt động</Link>
            <Link to={subscriptionPath(qMerchant.id)} className="inline-flex min-h-[40px] items-center rounded-lg bg-surface-container-lowest px-3 text-primary hover:underline">Gói dịch vụ</Link>
            <button type="button" onClick={() => { setQ(''); reset() }} className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-secondary hover:underline">Xóa lọc</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        {logsQ.loading && !logsQ.data ? (
          <Loading />
        ) : logsQ.error ? (
          <div className="p-6"><ErrorState message={logsQ.error} onRetry={logsQ.reload} /></div>
        ) : (
          <>
            <ResponsiveTable minWidth={1040}
              cards={pageRows.map((l) => (
                <MobileCard key={l.id}
                  title={merchantLink(l)}
                  subtitle={<>{hashCode(l.code)} · {l.channel_label ?? CHANNEL_SHORT[l.channel]}{l.contact_person ? ` · ${l.contact_person}` : ''}</>}
                  fields={[
                    ['Nhân sự', l.staff?.full_name ?? l.actor_name ?? '—'],
                    ['Thời điểm', `${formatTime(l.occurred_at)} - ${formatDate(l.occurred_at)}`],
                    ['Mục đích', l.purpose ?? '—'],
                    ['Thời lượng', l.duration_seconds > 0 ? formatDuration(l.duration_seconds) : relativeTime(l.occurred_at)],
                  ]}
                  actions={
                    <>
                      <p className="w-full text-[13px] leading-relaxed text-on-surface">{l.content}</p>
                      <span className="w-full">{statusSelect(l)}</span>
                      {(l.tags.length > 0 || l.needs_callback) && (
                        <div className="flex w-full flex-wrap gap-1">
                          {l.tags.map((t) => <span key={t} className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-secondary">{t}</span>)}
                          {l.needs_callback && <span className="rounded bg-amber-50 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-amber-700">Cần gọi lại{l.callback_at ? ` ${formatDate(l.callback_at).slice(0, 5)}` : ''}</span>}
                        </div>
                      )}
                      {rowActions(l)}
                    </>
                  }
                />
              ))}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-primary-container text-on-primary">
                    {['Mã & Kênh', 'Người Liên Hệ (Giaodoan)', 'Merchant Đối Tác', 'Nội Dung Cuộc Trao Đổi', 'Thời Điểm & Lượng', 'Trạng Thái (Chọn nhanh)', 'Hành Động'].map((h, i, a) => (
                      <th key={h} scope="col" className={`px-2.5 py-3.5 font-label-md text-label-md font-semibold uppercase tracking-wide ${i === a.length - 1 ? 'text-center' : ''} ${i === 1 ? 'min-w-[150px]' : ''} ${i === 2 ? 'min-w-[180px]' : ''} ${i === 3 ? 'min-w-[170px]' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-md text-body-md text-on-surface">
                  {pageRows.map((l, idx) => {
                    const who = l.staff?.full_name ?? l.actor_name ?? '—'
                    return (
                      <tr key={l.id} className={`group transition-colors hover:bg-primary-fixed/20 ${idx % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                        <td className="whitespace-nowrap px-2.5 py-3.5 align-top">
                          <div className="flex items-center gap-space-xs">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container text-primary-container"><Icon name={CHANNEL_ICON[l.channel]} className="text-[16px]" /></div>
                            <div>
                              <button type="button" onClick={() => setViewing(l)} className="font-label-md text-label-md font-bold text-on-surface transition-colors hover:text-primary-container hover:underline">{hashCode(l.code)}</button>
                              <div className="font-label-sm text-label-sm text-secondary">{l.channel_label ?? CHANNEL_SHORT[l.channel]}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-3.5 align-top">
                          <div className="flex items-center gap-space-sm">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container font-label-md text-label-md font-bold text-primary">{l.staff ? initials(l.staff.full_name) : <Icon name="smart_toy" className="text-[18px]" />}</div>
                            <div>
                              <div className="font-label-md text-label-md font-semibold text-on-surface">{who}</div>
                              <div className="font-body-sm text-body-sm text-secondary">{l.staff ? `${l.staff.role_label ?? ''}${l.staff.ext ? ` • Máy lẻ ${l.staff.ext}` : ''}` : 'Tự động'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-3.5 align-top">
                          {l.merchant ? (
                            <div className="flex items-center gap-space-sm text-left">
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-high font-headline-md font-bold text-primary">
                                {l.merchant.emoji ?? <Icon name={l.merchant.icon ?? 'storefront'} className="text-[18px]" />}
                              </div>
                              <div>
                                <div className="font-label-md text-label-md font-bold text-on-surface">{merchantLink(l)}</div>
                                <div className="flex items-center gap-1 font-body-sm text-body-sm text-secondary">
                                  <Link to={merchantPath(l.merchant.id)} className="font-label-sm text-label-sm font-semibold text-primary-container hover:underline">{hashCode(l.merchant.code)}</Link>
                                  {l.contact_person && <span>• {l.contact_person}</span>}
                                </div>
                              </div>
                            </div>
                          ) : <span className="text-secondary">—</span>}
                        </td>
                        <td className="px-2.5 py-3.5 align-top">
                          <p className="max-w-[11rem] font-body-md text-body-md leading-relaxed text-on-surface">{l.content}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-space-xs">
                            {l.tags.map((t) => <span key={t} className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-secondary">{t}</span>)}
                            {l.needs_callback && (
                              <span className="rounded bg-amber-50 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-amber-700">
                                Cần gọi lại{l.callback_at ? ` ${formatDate(l.callback_at).slice(0, 5)}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-3.5 align-top">
                          <div className="font-label-md text-label-md font-semibold text-on-surface">{formatTime(l.occurred_at)} - {formatDate(l.occurred_at)}</div>
                          <div className="flex items-center gap-1 font-body-sm text-body-sm text-secondary">
                            <Icon name="timer" className="text-[14px]" />
                            <span>{l.duration_seconds > 0 ? `${formatDuration(l.duration_seconds)}s (${relativeTime(l.occurred_at)})` : relativeTime(l.occurred_at)}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-3.5 align-top">{statusSelect(l)}</td>
                        <td className="whitespace-nowrap px-2.5 py-3.5 text-center align-top">
                          <div className="flex items-center justify-center gap-1">{rowActions(l)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ResponsiveTable>
            {filtered.length === 0 && <EmptyState message="Không tìm thấy lượt liên hệ nào phù hợp." />}
            <Pagination page={curPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} label="lượt liên hệ" />
          </>
        )}
      </div>

      {/* Helper card */}
      <div className="flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md sm:p-space-lg">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container"><Icon name="lightbulb" className="text-[20px]" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="font-label-lg text-label-lg font-bold text-on-surface">Mẹo quản lý cuộc gọi đối tác F&amp;B</h3>
          <p className="mt-0.5 font-body-md text-body-md text-secondary">
            Đối tác nhà hàng/quán cafe thường bận rộn cao điểm trong 2 khung giờ: <strong className="text-on-surface">11:30 - 13:30</strong> và <strong className="text-on-surface">18:00 - 20:30</strong>.
            Để tỷ lệ bắt máy đạt trên 85%, đội ngũ nên ưu tiên liên hệ vào đầu giờ sáng hoặc giờ chiều muộn.
          </p>
        </div>
      </div>

      <AddContactModal
        open={adding}
        onClose={() => setAdding(false)}
        merchants={merchantsQ.data ?? []}
        staff={staff}
        defaultMerchantId={qMerchant?.id ?? ''}
        onCreated={(code) => { setAdding(false); toast(`Đã ghi nhận cuộc gọi ${hashCode(code)}`); setPage(1); logsQ.reload() }}
      />

      {viewing && (
        <DetailModal
          key={viewing.id}
          row={viewing}
          onClose={() => setViewing(null)}
          onSaved={() => { setViewing(null); toast('Đã lưu ghi chú'); logsQ.reload() }}
        />
      )}
    </div>
  )
}

function StatKpi({ tint, iconBox, icon, label, value, badge, bar, pct }: {
  tint: string; iconBox: string; icon: string; label: string; value: number; badge: React.ReactNode; bar: string; pct: number
}) {
  return (
    <div className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
      <div className={`absolute -right-3 -top-3 h-16 w-16 rounded-full transition-transform duration-300 group-hover:scale-125 ${tint}`} />
      <div className="relative z-10 mb-space-sm flex items-center justify-between gap-2">
        <span className="min-w-0 font-label-md text-label-md uppercase tracking-wider text-secondary">{label}</span>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconBox}`}><Icon name={icon} className="text-[20px]" /></div>
      </div>
      <div className="relative z-10 flex flex-wrap items-baseline gap-x-space-md gap-y-1">
        <span className="font-headline-xl text-headline-xl font-bold text-on-surface">{formatNumber(value)}</span>
        {badge}
      </div>
      <div className="relative z-10 mt-space-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FilterBox({ label, icon = 'expand_more', children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <label className="mb-1 block font-label-sm text-label-sm font-semibold uppercase text-secondary">{label}</label>
      <div className="relative">
        {children}
        <Icon name={icon} className="pointer-events-none absolute right-2.5 top-2.5 text-[18px] text-secondary" />
      </div>
    </div>
  )
}

function DetailModal({ row, onClose, onSaved }: { row: ContactRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [content, setContent] = useState(row.content)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('contact_logs').update({ content: content.trim() }).eq('id', row.id)
    setSaving(false)
    if (error) return toast(`Không lưu được: ${error.message}`)
    onSaved()
  }

  return (
    <Modal open title={`Phiếu liên hệ ${hashCode(row.code)}`} onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Đóng</button>
          <button type="button" className={btnPrimary} onClick={save} disabled={saving || !content.trim()}>
            <Icon name="save" className="text-[20px]" />{saving ? 'Đang lưu...' : 'Lưu ghi chú'}
          </button>
        </>
      }>
      <div className="flex flex-col gap-4 text-[14px]">
        <dl className="grid grid-cols-1 gap-y-0.5 sm:grid-cols-[150px_1fr] sm:gap-x-4 sm:gap-y-2 [&>dt]:mt-2 sm:[&>dt]:mt-0 [&>dd]:break-words">
          <dt className="font-label-md text-secondary">Merchant</dt><dd className="font-medium">{row.merchant ? <><Link to={merchantPath(row.merchant.id)} className="text-primary hover:underline">{row.merchant.name}</Link> ({hashCode(row.merchant.code)})</> : '—'}</dd>
          <dt className="font-label-md text-secondary">Người liên hệ</dt><dd className="font-medium">{row.contact_person ?? '—'}</dd>
          <dt className="font-label-md text-secondary">Nhân sự thực hiện</dt><dd className="font-medium">{row.staff?.full_name ?? row.actor_name ?? '—'}</dd>
          <dt className="font-label-md text-secondary">Kênh</dt><dd className="font-medium">{CONTACT_CHANNELS[row.channel]}</dd>
          <dt className="font-label-md text-secondary">Mục đích</dt><dd className="font-medium">{row.purpose ?? '—'}</dd>
          <dt className="font-label-md text-secondary">Thời điểm</dt><dd className="font-medium">{formatDateTime(row.occurred_at)} ({relativeTime(row.occurred_at)})</dd>
          <dt className="font-label-md text-secondary">Thời lượng</dt><dd className="font-medium">{formatDuration(row.duration_seconds)}</dd>
          <dt className="font-label-md text-secondary">Trạng thái</dt><dd className="font-medium">{CONTACT_STATUSES[row.status].label}</dd>
          {row.needs_callback && <><dt className="font-label-md text-secondary">Hẹn gọi lại</dt><dd className="font-medium text-amber-700">{formatDateTime(row.callback_at)}</dd></>}
        </dl>
        <Field label="Nội dung cuộc trao đổi / Ghi chú">
          <textarea rows={5} className={inputCls} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function AddContactModal({ open, onClose, merchants, staff, defaultMerchantId, onCreated }: {
  open: boolean; onClose: () => void; merchants: MerchantLite[]; staff: Staff[]; defaultMerchantId: string; onCreated: (code: string) => void
}) {
  const empty = {
    merchant_id: '', staff_id: '', channel: 'voip' as ContactLog['channel'], contact_person: '', purpose: CONTACT_PURPOSES[0] as string,
    content: '', tags: '', status: 'success' as ContactStatus, minutes: '', needs_callback: false, callback_at: '',
  }
  const { settings } = useSettings()
  const [f, setF] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setF((cur) => ({ ...cur, [k]: v }))
  // opened while looking at one merchant's history: preselect it
  useEffect(() => {
    if (open && defaultMerchantId) setF((cur) => (cur.merchant_id ? cur : { ...cur, merchant_id: defaultMerchantId }))
  }, [open, defaultMerchantId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!f.merchant_id) return setErr('Vui lòng chọn Merchant.')
    setSaving(true)
    setErr(null)
    const mins = parseFloat(f.minutes)
    const picked = staff.find((s) => s.id === f.staff_id)
    // `code` (LH-xxxx) is generated by the database sequence
    const { error, codes } = await insertContactLogs(
      [{
        merchantId: f.merchant_id,
        contactPerson: f.contact_person,
        channel: f.channel,
        channelLabel: CHANNEL_SHORT[f.channel],
        purpose: f.purpose,
        content: f.content,
        tags: f.tags.split(','),
        status: f.status,
        durationSeconds: isNaN(mins) ? 0 : Math.round(mins * 60),
        needsCallback: f.needs_callback,
        callbackAt: f.needs_callback && f.callback_at ? new Date(f.callback_at).toISOString() : null,
      }],
      settings.name,
      picked ? { staffId: picked.id, name: picked.full_name } : undefined,
    )
    setSaving(false)
    if (error) return setErr(error)
    setF(empty)
    onCreated(codes[0] ?? '')
  }

  return (
    <Modal open={open} title="Ghi nhận cuộc gọi mới" onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="add-contact-form" className={btnPrimary} disabled={saving}>
            <Icon name="add_call" className="text-[20px]" />{saving ? 'Đang lưu...' : 'Lưu cuộc gọi'}
          </button>
        </>
      }>
      <form id="add-contact-form" onSubmit={submit} className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="Merchant" required className="sm:col-span-2">
          <select required className={inputCls} value={f.merchant_id} onChange={(e) => set('merchant_id', e.target.value)}>
            <option value="">-- Chọn Merchant --</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{hashCode(m.code)} - {m.name}</option>)}
          </select>
        </Field>
        <Field label="Nhân sự thực hiện">
          <select className={inputCls} value={f.staff_id} onChange={(e) => set('staff_id', e.target.value)}>
            <option value="">{settings.name} (bạn)</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.role_label ? ` - ${s.role_label}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Người liên hệ (phía Merchant)">
          <input className={inputCls} value={f.contact_person} onChange={(e) => set('contact_person', e.target.value)} placeholder="Anh Long (Chủ quán)" />
        </Field>
        <Field label="Loại liên hệ">
          <select className={inputCls} value={f.channel} onChange={(e) => set('channel', e.target.value as ContactLog['channel'])}>
            {(Object.keys(CONTACT_CHANNELS) as ContactLog['channel'][]).map((c) => <option key={c} value={c}>{CONTACT_CHANNELS[c]}</option>)}
          </select>
        </Field>
        <Field label="Mục đích">
          <select className={inputCls} value={f.purpose} onChange={(e) => set('purpose', e.target.value)}>
            {CONTACT_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Nội dung cuộc trao đổi" required className="sm:col-span-2">
          <textarea required rows={3} className={inputCls} value={f.content} onChange={(e) => set('content', e.target.value)} />
        </Field>
        <Field label="Thẻ (cách nhau bằng dấu phẩy)">
          <input className={inputCls} value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Upsell Gói Gold, Hẹn callback" />
        </Field>
        <Field label="Thời lượng (phút)">
          <input type="number" min="0" step="0.5" className={inputCls} value={f.minutes} onChange={(e) => set('minutes', e.target.value)} placeholder="4.5" />
        </Field>
        <Field label="Trạng thái">
          <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value as ContactStatus)}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{CONTACT_STATUSES[s].label}</option>)}
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 pt-6 font-label-md text-[13px] font-semibold text-secondary">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={f.needs_callback}
              onChange={(e) => { set('needs_callback', e.target.checked); if (e.target.checked && !f.callback_at) set('callback_at', toLocalInput(new Date(Date.now() + 86400000))) }} />
            Cần gọi lại
          </label>
        </div>
        {f.needs_callback && (
          <Field label="Hẹn gọi lại lúc" required className="sm:col-span-2">
            <input type="datetime-local" required className={inputCls} value={f.callback_at} onChange={(e) => set('callback_at', e.target.value)} />
          </Field>
        )}
        {err && <p className="rounded-lg bg-error-container sm:col-span-2 px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
      </form>
    </Modal>
  )
}
