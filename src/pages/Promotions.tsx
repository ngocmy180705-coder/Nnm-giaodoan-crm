import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Field, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { PROMO_SPONSORS, PROMO_STATUSES, PROMO_TYPES } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { daysUntil, formatDate, formatNumber, formatVnd, formatVndCompact, hashCode, initials } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { merchantPath, ROUTES } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { Promotion, PromotionBudget } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'
import { useRowSelection } from '../lib/useRowSelection'
import PromoDrawer from './promotions/PromoDrawer'
import { REGION_OPTIONS, SPONSOR_DOT, TYPE_ICON } from './promotions/shared'

type Tab = 'all' | Promotion['status']
type PM = {
  promotion_id: string
  merchant_id: string
  orders_count: number
  uplift_pct: number | null
  revenue_gain_vnd: number
  merchant: { code: string; name: string } | null
}
type Ranked = { id: string; code: string; name: string; orders: number; gain: number; uplift: number[]; promos: number }

const AVATAR_CLS = ['bg-surface-container-high text-primary', 'bg-primary-fixed text-on-primary-fixed', 'bg-tertiary-fixed text-on-tertiary-fixed']
const STATUS_ORDER: Record<Promotion['status'], number> = { running: 0, upcoming: 1, ended: 2 }

const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low py-2.5 pl-3.5 pr-9 font-label-md text-[16px] font-semibold text-on-surface outline-none transition-colors hover:bg-surface-container focus:ring-2 focus:ring-primary-container/30 sm:w-auto sm:py-2 sm:text-label-md'
const iconBtn = 'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low transition-colors hover:bg-surface-container'

function StatusPill({ p }: { p: Promotion }) {
  const paused = p.status === 'running' && !p.is_active
  if (paused) return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FEF3C7] px-3 py-1 font-label-md text-label-md font-bold text-[#92400E]"><span className="h-2 w-2 rounded-full bg-amber-500" />Tạm dừng</span>
  if (p.status === 'running') return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-tertiary-fixed/30 px-3 py-1 font-label-md text-label-md font-bold text-on-tertiary-container"><span className="h-2 w-2 rounded-full bg-tertiary" />Đang chạy</span>
  if (p.status === 'upcoming') return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-fixed px-3 py-1 font-label-md text-label-md font-bold text-on-primary-fixed-variant"><span className="h-2 w-2 rounded-full bg-primary-container" />Sắp diễn ra</span>
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md font-bold text-on-secondary-container">Đã kết thúc</span>
}

function TimeNote({ p }: { p: Promotion }) {
  const left = daysUntil(p.end_date)
  const toStart = daysUntil(p.start_date)
  const span = (left ?? 0) - (toStart ?? 0)
  if (p.status === 'running' && span > 300) return <span className="flex items-center gap-1 font-body-sm text-body-sm font-semibold text-tertiary"><Icon name="timelapse" className="text-[14px]" /> Dài hạn</span>
  if (p.status === 'running') return <span className="flex items-center gap-1 font-body-sm text-body-sm font-semibold text-tertiary"><Icon name="timelapse" className="text-[14px]" /> Còn {left ?? 0} ngày</span>
  if (p.status === 'upcoming') return <span className="flex items-center gap-1 font-body-sm text-body-sm font-semibold text-secondary"><Icon name="event" className="text-[14px]" /> Bắt đầu sau {toStart ?? 0} ngày</span>
  return <span className="flex items-center gap-1 font-body-sm text-body-sm font-semibold text-secondary"><Icon name="event_busy" className="text-[14px]" /> Đã kết thúc {left !== null ? `${-left} ngày trước` : ''}</span>
}

function ActiveToggle({ p, onToggle }: { p: Promotion; onToggle: (p: Promotion) => void }) {
  return (
    <label className="relative inline-flex h-10 cursor-pointer items-center px-1" title={p.is_active ? 'Đang bật - bấm để tạm dừng' : 'Đang tắt - bấm để bật'}>
      <input type="checkbox" className="peer sr-only" aria-label={`Bật/tắt ${p.code}`} checked={p.is_active} onChange={() => onToggle(p)} />
      <div className="peer relative h-6 w-11 rounded-full bg-secondary-container after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-container peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
    </label>
  )
}

export default function Promotions() {
  const toast = useToast()
  const { settings } = useSettings()
  const pageSize = settings.pageSize
  const promosQ = useQuery<Promotion[]>(() => supabase.from('promotions').select('*').order('end_date', { ascending: true }), [])
  const pmQ = useQuery<PM[]>(
    () => supabase.from('promotion_merchants').select('promotion_id,merchant_id,orders_count,uplift_pct,revenue_gain_vnd,merchant:merchants(code,name)'),
    [],
  )
  const budgetQ = useQuery<PromotionBudget[]>(() => supabase.from('promotion_budgets').select('*').order('limit_vnd', { ascending: false }), [])
  const merchantsQ = useQuery<{ id: string }[]>(() => supabase.from('merchants').select('id'), [])

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [sponsor, setSponsor] = useState('')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)
  const [drawer, setDrawer] = useState<{ open: boolean; promo: Promotion | null }>({ open: false, promo: null })
  const [deleting, setDeleting] = useState<Promotion | null>(null)
  const [viewing, setViewing] = useState<Promotion | null>(null)
  const [ranking, setRanking] = useState(false)
  const [policy, setPolicy] = useState(false)
  const [budgetEdit, setBudgetEdit] = useState<Record<string, string> | null>(null)
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({})
  useNewParam(() => setDrawer({ open: true, promo: null }))

  const promos = useMemo(
    () => [...(promosQ.data ?? [])].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.end_date.localeCompare(b.end_date)),
    [promosQ.data],
  )
  const pms = pmQ.data ?? []
  const budgets = budgetQ.data ?? []

  const pmByPromo = useMemo(() => {
    const m = new Map<string, PM[]>()
    for (const r of pms) m.set(r.promotion_id, [...(m.get(r.promotion_id) ?? []), r])
    return m
  }, [pms])

  const counts = {
    all: promos.length,
    running: promos.filter((p) => p.status === 'running').length,
    upcoming: promos.filter((p) => p.status === 'upcoming').length,
    ended: promos.filter((p) => p.status === 'ended').length,
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return promos.filter((p) => {
      if (tab !== 'all' && p.status !== tab) return false
      if (type && p.promo_type !== type) return false
      if (sponsor && p.sponsor !== sponsor) return false
      if (region && p.region !== region) return false
      if (!needle) return true
      return [p.code, p.name, p.description, p.discount_label].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [promos, tab, q, type, sponsor, region])

  const { selected, setSelected, selectedRows } = useRowSelection(filtered)

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const curPage = Math.min(page, pages)
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  const rows = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)

  // ---- KPIs (computed) ----
  const distinctMc = new Set(pms.map((r) => r.merchant_id)).size
  const totalMerchants = merchantsQ.data?.length ?? 0
  const mcShare = totalMerchants ? Math.round((distinctMc / totalMerchants) * 1000) / 10 : 0
  const budgetLimit = budgets.reduce((s, b) => s + b.limit_vnd, 0)
  const budgetSpent = budgets.reduce((s, b) => s + b.spent_vnd, 0)
  const budgetPct = budgetLimit ? Math.round((budgetSpent / budgetLimit) * 1000) / 10 : 0
  const revenue = promos.reduce((s, p) => s + p.revenue_vnd, 0)
  const participantsTotal = promos.filter((p) => p.status === 'running').reduce((s, p) => s + p.participants, 0)

  // type distribution donut
  const GROUPS = [
    { label: 'Giảm giá % theo đơn', types: ['percent', 'voucher'], stroke: 'text-primary-container', dot: 'bg-primary-container' },
    { label: 'Freeship giao nhanh', types: ['freeship'], stroke: 'text-tertiary', dot: 'bg-tertiary' },
    { label: 'Combo & Giờ Vàng', types: ['combo', 'flash_sale', 'bogo'], stroke: 'text-surface-dim', dot: 'bg-surface-dim' },
  ]
  const groups = GROUPS.map((g) => {
    const list = promos.filter((p) => g.types.includes(p.promo_type))
    const spent = list.reduce((s, p) => s + p.spent_vnd, 0)
    const rev = list.reduce((s, p) => s + p.revenue_vnd, 0)
    return { ...g, n: list.length, roi: spent > 0 ? rev / spent : null }
  })
  const donut = (() => {
    let off = 0
    return groups.map((g) => {
      const share = promos.length ? (g.n / promos.length) * 100 : 0
      const seg = { ...g, share, off: -off }
      off += share
      return seg
    })
  })()
  const bestGroup = groups.filter((g) => g.roi !== null).sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0]

  // partners ranked by incremental revenue
  const ranked = useMemo<Ranked[]>(() => {
    const m = new Map<string, Ranked>()
    for (const r of pms) {
      const cur = m.get(r.merchant_id) ?? { id: r.merchant_id, code: r.merchant?.code ?? '', name: r.merchant?.name ?? '—', orders: 0, gain: 0, uplift: [], promos: 0 }
      cur.orders += r.orders_count
      cur.gain += r.revenue_gain_vnd
      cur.promos += 1
      if (r.uplift_pct != null) cur.uplift.push(r.uplift_pct)
      m.set(r.merchant_id, cur)
    }
    return [...m.values()].sort((a, b) => b.gain - a.gain)
  }, [pms])
  const top = ranked.slice(0, 3)
  const avgUplift = (t: Ranked) => (t.uplift.length ? Math.round(t.uplift.reduce((a, b) => a + b, 0) / t.uplift.length) : null)

  // voucher / sponsor policy summary
  const sponsorRows = (Object.keys(PROMO_SPONSORS) as Promotion['sponsor'][]).map((k) => {
    const list = promos.filter((p) => p.sponsor === k)
    return { key: k, n: list.length, budget: list.reduce((s, p) => s + p.budget_vnd, 0), spent: list.reduce((s, p) => s + p.spent_vnd, 0) }
  })

  const reloadAll = () => { promosQ.reload(); pmQ.reload(); budgetQ.reload(); merchantsQ.reload() }
  const resetFilters = () => { setTab('all'); setQ(''); setType(''); setSponsor(''); setRegion(''); setPage(1) }

  async function toggleActive(p: Promotion) {
    const next = !p.is_active
    promosQ.setData((cur) => (cur ?? []).map((x) => (x.id === p.id ? { ...x, is_active: next } : x)))
    const { error } = await supabase.from('promotions').update({ is_active: next }).eq('id', p.id)
    if (error) {
      promosQ.setData((cur) => (cur ?? []).map((x) => (x.id === p.id ? { ...x, is_active: !next } : x)))
      toast(`Không cập nhật được trạng thái: ${error.message}`)
    } else toast(next ? `Đã bật CTKM ${p.code}` : `Đã tạm dừng CTKM ${p.code}`)
  }

  async function confirmDelete() {
    if (!deleting) return
    const p = deleting
    const { error } = await supabase.from('promotions').delete().eq('id', p.id)
    setDeleting(null)
    if (error) return toast(`Không xóa được: ${error.message}`)
    promosQ.setData((cur) => (cur ?? []).filter((x) => x.id !== p.id))
    setSelected((cur) => { const n = new Set(cur); n.delete(p.id); return n })
    toast(`Đã xóa CTKM ${p.code}`)
    pmQ.reload()
  }

  /** Required, whole number >= 0 (an empty field must never become 0). Returns an error message or null. */
  function budgetError(raw: string | undefined): string | null {
    const v = (raw ?? '').trim()
    if (v === '') return 'Bắt buộc nhập hạn mức'
    if (!/^\d+$/.test(v)) return 'Hạn mức phải là số nguyên không âm'
    return Number.isSafeInteger(Number(v)) ? null : 'Hạn mức quá lớn'
  }

  async function saveBudgets() {
    if (!budgetEdit || savingBudget) return
    const errs: Record<string, string> = {}
    for (const b of budgets) {
      const e = budgetError(budgetEdit[b.id])
      if (e) errs[b.id] = e
    }
    setBudgetErrors(errs)
    if (Object.keys(errs).length > 0) return
    const changed = budgets.filter((b) => Number(budgetEdit[b.id].trim()) !== b.limit_vnd)
    if (changed.length === 0) { setBudgetEdit(null); return toast('Chưa có thay đổi nào') }
    setSavingBudget(true)
    const results = await Promise.all(changed.map((b) => supabase.from('promotion_budgets').update({ limit_vnd: Number(budgetEdit[b.id].trim()) }).eq('id', b.id)))
    setSavingBudget(false)
    budgetQ.reload() // full or partial failure: always show what is really stored
    const failed = changed.flatMap((b, i) => (results[i].error ? [{ b, msg: results[i].error!.message }] : []))
    if (failed.length > 0) {
      setBudgetErrors(Object.fromEntries(failed.map((f) => [f.b.id, f.msg])))
      return toast(`Không cập nhật được hạn mức: ${failed.map((f) => f.b.region).join(', ')}${failed.length < changed.length ? ` (đã lưu ${changed.length - failed.length}/${changed.length} khu vực)` : ''}`)
    }
    setBudgetEdit(null)
    toast(`Đã cập nhật hạn mức ngân sách (${changed.length} khu vực)`)
  }

  function exportList() {
    exportCsv(
      'ctkm.csv',
      [
        { header: 'Mã CTKM', value: (p: Promotion) => p.code },
        { header: 'Tên chương trình', value: (p) => p.name },
        { header: 'Hình thức', value: (p) => PROMO_TYPES[p.promo_type] },
        { header: 'Mức giảm', value: (p) => p.discount_label },
        { header: 'Nguồn tài trợ', value: (p) => PROMO_SPONSORS[p.sponsor] },
        { header: 'Số Merchant tham gia', value: (p) => p.participants },
        { header: 'Ngày bắt đầu', value: (p) => formatDate(p.start_date) },
        { header: 'Ngày kết thúc', value: (p) => formatDate(p.end_date) },
        { header: 'Trạng thái', value: (p) => PROMO_STATUSES[p.status] },
        { header: 'Ngân sách (đ)', value: (p) => p.budget_vnd },
        { header: 'Đã giải ngân (đ)', value: (p) => p.spent_vnd },
        { header: 'Doanh thu CTKM (đ)', value: (p) => p.revenue_vnd },
        { header: 'Khu vực', value: (p) => p.region },
      ],
      selectedRows.length > 0 ? selectedRows : filtered,
    )
  }

  const toggleOne = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOnPage = rows.length > 0 && rows.every((p) => selected.has(p.id))
  const toggleAll = () =>
    setSelected((cur) => {
      const n = new Set(cur)
      if (allOnPage) rows.forEach((p) => n.delete(p.id))
      else rows.forEach((p) => n.add(p.id))
      return n
    })

  if (promosQ.loading && !promosQ.data) return <div className="px-margin py-space-lg"><Loading /></div>
  if (promosQ.error) return <div className="px-margin py-space-lg"><ErrorState message={promosQ.error} onRetry={reloadAll} /></div>

  const tabBtn = (t: Tab, label: string, n: number, badgeCls: string) => (
    <button key={t} type="button" onClick={() => { setTab(t); setPage(1) }}
      className={`flex min-h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-label-lg text-label-lg transition-all sm:px-space-lg ${
        tab === t ? 'bg-surface-container-lowest font-bold text-primary-container shadow-sm' : 'font-semibold text-secondary hover:bg-surface-container hover:text-on-surface'}`}>
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm ${badgeCls}`}>{n}</span>
    </button>
  )

  const selectWrap = 'relative w-full sm:w-auto'
  const chevron = <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      {/* Header */}
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
        <PageHeader
          eyebrow={<span className="normal-case tracking-normal"><span className="rounded-full bg-surface-container px-3 py-1 font-label-sm text-label-sm font-bold uppercase tracking-wide text-primary">Enterprise F&amp;B Hub</span></span>}
          title="Quản Lý Chương Trình Khuyến Mãi (CTKM)"
          subtitle="Giám sát, phân bổ ngân sách tài trợ và theo dõi các chiến dịch ưu đãi kích cầu ẩm thực áp dụng cho các đối tác Merchant."
          actions={
            <>
              <button type="button" onClick={exportList} disabled={filtered.length === 0} className={btnSecondary}>
                <Icon name="download" className="text-[20px] text-primary" />
                <span>{selectedRows.length > 0 ? `Xuất ${selectedRows.length} CTKM đã chọn` : 'Xuất báo cáo Excel'}</span>
              </button>
              <button type="button" onClick={() => setPolicy(true)} className={btnSecondary}>
                <Icon name="tune" className="text-[20px] text-on-surface-variant" />
                <span>Chính sách tài trợ voucher</span>
              </button>
              <button type="button" onClick={() => setDrawer({ open: true, promo: null })} className={btnPrimary}>
                <Icon name="add_circle" className="text-[20px]" />
                <span>Tạo CTKM mới</span>
              </button>
            </>
          }
        />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-space-lg lg:grid-cols-4">
        <KpiCard label="CTKM đang chạy" value={counts.running} icon="campaign" tone="primary"
          footer={<span className="font-bold text-tertiary">{counts.upcoming} CTKM sắp diễn ra</span>} />
        <KpiCard label="MC sử dụng CTKM" value={formatNumber(distinctMc)} icon="storefront" tone="tertiary" to={ROUTES.merchants}
          footer={<span className="text-secondary">Chiếm <strong className="text-on-surface">{mcShare}%</strong> tổng đối tác • {formatNumber(participantsTotal)} lượt</span>} />
        <KpiCard label="Ngân sách tài trợ" value={formatVndCompact(budgetLimit)} icon="payments" tone="secondary" valueClassName="text-primary-container" progress={budgetPct}
          footer={<span className="text-secondary">Đã giải ngân <strong className="text-on-surface">{formatVndCompact(budgetSpent)}</strong> ({budgetPct}%)</span>} />
        <KpiCard label="Doanh thu đơn áp dụng" value={formatVndCompact(revenue)} icon="insights" tone="tertiary"
          footer={<span className="text-secondary"><strong className="text-tertiary">{budgetSpent ? `ROI x${(revenue / budgetSpent).toFixed(1)}` : 'ROI —'}</strong> • {promos.length} chiến dịch</span>} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-3 shadow-sm sm:p-space-lg">
        <div className="flex flex-col items-stretch justify-between gap-space-md xl:flex-row xl:items-center">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-surface-container-low p-1">
            {tabBtn('all', 'Tất cả', counts.all, 'bg-primary-fixed text-on-primary-fixed')}
            {tabBtn('running', 'Đang diễn ra', counts.running, 'bg-tertiary-fixed text-on-tertiary-fixed')}
            {tabBtn('upcoming', 'Sắp diễn ra', counts.upcoming, 'bg-secondary-container text-on-secondary-container')}
            {tabBtn('ended', 'Đã kết thúc', counts.ended, 'bg-surface-container text-secondary')}
          </div>
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo tên CTKM, mã chương trình..." className="xl:max-w-xl" />
        </div>
        <div className="flex flex-col gap-space-sm border-t border-surface-container-low pt-space-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-space-md">
          <div className="flex flex-col gap-space-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-space-md">
            <div className={selectWrap}>
              <select className={selectCls} value={type} aria-label="Loại khuyến mãi" onChange={(e) => { setType(e.target.value); setPage(1) }}>
                <option value="">Loại khuyến mãi: Tất cả</option>
                {Object.entries(PROMO_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {chevron}
            </div>
            <div className={selectWrap}>
              <select className={selectCls} value={sponsor} aria-label="Nguồn tài trợ" onChange={(e) => { setSponsor(e.target.value); setPage(1) }}>
                <option value="">Nguồn tài trợ: Tất cả</option>
                {Object.entries(PROMO_SPONSORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {chevron}
            </div>
            <div className={selectWrap}>
              <select className={selectCls} value={region} aria-label="Khu vực" onChange={(e) => { setRegion(e.target.value); setPage(1) }}>
                <option value="">Khu vực: Toàn quốc</option>
                {Array.from(new Set([...REGION_OPTIONS.filter((r) => r !== 'Toàn quốc'), ...promos.map((p) => p.region).filter((r) => r !== 'Toàn quốc')])).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {chevron}
            </div>
            <button type="button" onClick={resetFilters} className="flex min-h-10 items-center justify-center gap-1 font-label-md text-label-md font-bold text-secondary transition-colors hover:text-primary">
              <Icon name="restart_alt" className="text-[16px]" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
          <div className="font-label-md text-label-md text-secondary">Đang hiển thị <strong className="text-on-surface">{rows.length}</strong> / {filtered.length} chiến dịch</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-md">
        <ResponsiveTable
          minWidth={1100}
          cards={rows.map((p) => {
            const people = pmByPromo.get(p.id) ?? []
            return (
              <MobileCard
                key={p.id}
                title={<button type="button" onClick={() => setDrawer({ open: true, promo: p })} className="block max-w-full truncate text-left hover:text-primary">{p.name}</button>}
                subtitle={<><span className="font-mono font-semibold">#{p.code}</span> • {p.discount_label ?? PROMO_TYPES[p.promo_type]}</>}
                badge={<StatusPill p={p} />}
                fields={[
                  ['Hình thức', PROMO_TYPES[p.promo_type]],
                  ['Nguồn tài trợ', PROMO_SPONSORS[p.sponsor]],
                  ['Merchant tham gia', `${formatNumber(p.participants)} MC`],
                  ['Thời gian', `${formatDate(p.start_date)} - ${formatDate(p.end_date)}`],
                  ['Ngân sách', p.budget_vnd ? `${formatVndCompact(p.spent_vnd)} / ${formatVndCompact(p.budget_vnd)}` : '—'],
                  ['Doanh thu', formatVndCompact(p.revenue_vnd)],
                ]}
                actions={
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <label className="mr-1 flex min-h-10 cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-secondary">
                      <input type="checkbox" className="h-5 w-5 accent-primary-container" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />Chọn
                    </label>
                    <button type="button" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={() => setDrawer({ open: true, promo: p })} className={`${iconBtn} text-on-surface`}><Icon name="edit" className="text-[18px]" /></button>
                    <button type="button" title="Danh sách Merchant tham gia" aria-label="Danh sách Merchant tham gia" onClick={() => setViewing(p)} className={`${iconBtn} text-primary`}><Icon name="group" className="text-[18px]" />{people.length > 0 && <span className="sr-only">{people.length}</span>}</button>
                    <button type="button" title="Xóa CTKM" aria-label="Xóa CTKM" onClick={() => setDeleting(p)} className={`${iconBtn} text-error`}><Icon name="delete" className="text-[18px]" /></button>
                    <div className="ml-auto"><ActiveToggle p={p} onToggle={toggleActive} /></div>
                  </div>
                }
              />
            )
          })}
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-primary-container text-on-primary">
                <th scope="col" className="w-12 px-3 py-4 text-center">
                  <input type="checkbox" aria-label="Chọn tất cả" className="h-4 w-4 cursor-pointer rounded accent-on-primary" checked={allOnPage} onChange={toggleAll} />
                </th>
                {['MÃ CTKM', 'TÊN CHƯƠNG TRÌNH KHUYẾN MÃI', 'HÌNH THỨC & MỨC GIẢM', 'NGUỒN TÀI TRỢ', 'SỐ MERCHANT THAM GIA', 'THỜI GIAN ÁP DỤNG'].map((h, i) => (
                  <th key={h} scope="col" className={`py-4 font-label-md text-[13px] font-bold uppercase tracking-wider ${i === 1 ? 'min-w-[220px] px-3' : 'whitespace-nowrap px-3'}`}>{h}</th>
                ))}
                <th scope="col" className="px-3 py-4 text-center font-label-md text-[13px] font-bold uppercase tracking-wider">TRẠNG THÁI</th>
                <th scope="col" className="px-3 py-4 text-center font-label-md text-[13px] font-bold uppercase tracking-wider">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-body-lg text-body-lg text-on-surface">
              {rows.map((p) => {
                const people = pmByPromo.get(p.id) ?? []
                return (
                  <tr key={p.id} className="group transition-colors hover:bg-primary-fixed/20">
                    <td className="px-3 py-4 text-center">
                      <input type="checkbox" aria-label={`Chọn ${p.code}`} className="h-4 w-4 cursor-pointer rounded accent-primary-container" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 font-mono text-[14px] font-bold text-primary-container">
                      <span className="rounded-md bg-surface-container px-2 py-1">#{p.code}</span>
                    </td>
                    <td className="min-w-[220px] px-3 py-4">
                      <button type="button" onClick={() => setDrawer({ open: true, promo: p })} className="flex flex-col text-left" title="Mở để chỉnh sửa">
                        <span className="font-label-lg text-[15px] font-bold text-on-surface transition-colors group-hover:text-primary">{p.name}</span>
                        <span className="font-body-sm text-body-sm text-secondary">{p.description}</span>
                      </button>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-label-md text-label-md font-bold ${p.promo_type === 'percent' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-variant text-on-surface'}`}>
                        <Icon name={p.icon ?? TYPE_ICON[p.promo_type]} className="text-[16px]" />
                        {p.discount_label ?? PROMO_TYPES[p.promo_type]}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-surface-container px-2.5 py-1 font-label-sm text-label-sm font-semibold text-on-surface">
                        <span className={`h-2 w-2 rounded-full ${SPONSOR_DOT[p.sponsor]}`} />
                        {PROMO_SPONSORS[p.sponsor]}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <button type="button" onClick={() => setViewing(p)} title="Xem danh sách Merchant tham gia" className="flex items-center gap-2">
                        {people.length > 0 && (
                          <div className="flex -space-x-2 overflow-hidden">
                            {people.slice(0, 3).map((r, i) => (
                              <div key={r.merchant_id} title={r.merchant?.name}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-surface-container-lowest ${AVATAR_CLS[i % 3]}`}>
                                {initials(r.merchant?.name).slice(0, 1)}
                              </div>
                            ))}
                          </div>
                        )}
                        <span className="font-headline-md text-headline-md font-bold text-on-surface">{formatNumber(p.participants)}</span>
                        <span className="font-body-sm text-body-sm text-secondary">MC</span>
                      </button>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col">
                        <span className="whitespace-nowrap font-label-md text-label-md font-bold text-on-surface">{formatDate(p.start_date)} - {formatDate(p.end_date)}</span>
                        <TimeNote p={p} />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center"><StatusPill p={p} /></td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={() => setDrawer({ open: true, promo: p })} className={`${iconBtn} text-on-surface`}>
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button type="button" title="Danh sách Merchant tham gia" aria-label="Danh sách Merchant tham gia" onClick={() => setViewing(p)} className={`${iconBtn} text-primary`}>
                          <Icon name="group" className="text-[18px]" />
                        </button>
                        <button type="button" title="Xóa CTKM" aria-label="Xóa CTKM" onClick={() => setDeleting(p)} className={`${iconBtn} text-error hover:!bg-error-container`}>
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                        <ActiveToggle p={p} onToggle={toggleActive} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ResponsiveTable>
        {filtered.length === 0 && <EmptyState message="Không tìm thấy CTKM nào phù hợp." />}
        <Pagination page={curPage} pageSize={pageSize} total={filtered.length} onPage={setPage} label="CTKM" />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-3">
        <div className="flex min-w-0 flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
          <div className="flex items-center justify-between border-b border-surface-container-low pb-space-sm">
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Phân bổ Hình Thức Khuyến Mãi</h3>
            <Icon name="donut_small" className="text-[20px] text-secondary" />
          </div>
          <div className="flex items-center gap-space-lg py-space-md">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4.5" />
                {donut.filter((d) => d.share > 0).map((d) => (
                  <path key={d.label} className={d.stroke} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor"
                    strokeDasharray={`${d.share}, 100`} strokeDashoffset={d.off} strokeWidth="4.5" />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-headline-md text-headline-md font-bold text-on-surface">{promos.length}</span>
                <span className="font-label-sm text-[10px] font-semibold uppercase text-secondary">Chiến dịch</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 font-label-md text-label-md">
              {donut.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2"><span className={`h-3 w-3 flex-shrink-0 rounded ${d.dot}`} /><span className="truncate">{d.label}</span></span>
                  <strong className="text-on-surface">{Math.round(d.share)}%</strong>
                </div>
              ))}
            </div>
          </div>
          <p className="rounded-lg bg-surface-container-low p-2.5 font-body-sm text-body-sm text-secondary">
            💡 <strong>Gợi ý từ dữ liệu:</strong>{' '}
            {bestGroup && bestGroup.roi !== null
              ? <>nhóm “{bestGroup.label}” đang cho ROI cao nhất (x{bestGroup.roi.toFixed(1)} doanh thu trên mỗi đồng giải ngân) - cân nhắc ưu tiên ngân sách cho nhóm này.</>
              : 'chưa đủ dữ liệu giải ngân để so sánh ROI giữa các hình thức.'}
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
          <div className="flex items-center justify-between border-b border-surface-container-low pb-space-sm">
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Tốc Độ Phân Bổ Ngân Sách {budgets[0]?.quarter?.split('/')[0] === 'Q4' ? 'Quý 4' : budgets[0]?.quarter ?? ''}</h3>
            <Icon name="stacked_bar_chart" className="text-[20px] text-secondary" />
          </div>
          <div className="flex flex-col gap-3 py-space-md">
            {budgets.length === 0 && <p className="text-[13px] text-secondary">Chưa có hạn mức ngân sách.</p>}
            {budgets.map((b, i) => {
              const pct = b.limit_vnd ? Math.round((b.spent_vnd / b.limit_vnd) * 100) : 0
              const bar = ['bg-primary-container', 'bg-tertiary', 'bg-secondary'][i % 3]
              const txt = ['text-primary', 'text-tertiary', 'text-on-surface'][i % 3]
              return (
                <div key={b.id}>
                  <div className="mb-1 flex flex-wrap justify-between gap-x-3 font-label-sm text-label-sm">
                    <span className="font-semibold text-secondary">{b.region} (Hạn mức {formatVndCompact(b.limit_vnd)})</span>
                    <span className={`font-bold ${txt}`}>{formatVndCompact(b.spent_vnd)} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-surface-container-low pt-2 font-label-sm text-label-sm">
            <span className="text-secondary">Chu kỳ tính toán: {budgets[0]?.quarter ?? '—'}</span>
            <button type="button" disabled={budgets.length === 0} onClick={() => { setBudgetErrors({}); setBudgetEdit(Object.fromEntries(budgets.map((b) => [b.id, String(b.limit_vnd)]))) }}
              className="min-h-10 font-bold text-primary hover:underline disabled:opacity-50">Cập nhật hạn mức ngân sách →</button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
          <div className="flex items-center justify-between border-b border-surface-container-low pb-space-sm">
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Top Đối Tác Đạt Hiệu Quả Cao</h3>
            <Icon name="hotel_class" className="text-[20px] text-primary-container" />
          </div>
          <div className="divide-y divide-surface-container-low py-1">
            {top.length === 0 && <p className="py-3 text-[13px] text-secondary">Chưa có dữ liệu đối tác tham gia.</p>}
            {top.map((t, i) => {
              const up = avgUplift(t)
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${['bg-primary-fixed text-on-primary-fixed', 'bg-surface-container-high text-primary', 'bg-surface-container text-secondary'][i]}`}>{i + 1}</div>
                    <div className="min-w-0">
                      <Link to={merchantPath(t.id)} className="block truncate font-label-md text-label-md font-bold leading-snug text-on-surface hover:text-primary hover:underline">{t.name}</Link>
                      <p className="font-body-sm text-[11px] text-secondary">{formatNumber(t.orders)} đơn CTKM{up !== null && <> • Tăng {up}%</>}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 rounded bg-tertiary-fixed/30 px-2 py-0.5 font-label-sm text-label-sm font-bold text-tertiary">+{formatVndCompact(t.gain)}</span>
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => setRanking(true)} disabled={ranked.length === 0}
            className="min-h-10 w-full rounded-lg bg-surface-container-low py-2 text-center font-label-md text-label-md font-bold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50">
            Xem bảng xếp hạng {formatNumber(distinctMc)} Merchant
          </button>
        </div>
      </div>

      <PromoDrawer
        open={drawer.open}
        promo={drawer.promo}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onSaved={(p, created) => {
          setDrawer((d) => ({ ...d, open: false }))
          toast(created ? `Đã tạo CTKM ${p.code}` : `Đã lưu CTKM ${p.code}`)
          promosQ.reload()
        }}
      />

      <Modal open={!!deleting} title="Xóa chương trình khuyến mãi" onClose={() => setDeleting(null)} width="max-w-md"
        footer={<>
          <button type="button" className={btnSecondary} onClick={() => setDeleting(null)}>Hủy bỏ</button>
          <button type="button" className={`${btnPrimary} !bg-error !text-on-error`} onClick={confirmDelete}><Icon name="delete" className="text-[20px]" />Xóa CTKM</button>
        </>}>
        <p className="text-[15px] text-on-surface">Bạn chắc chắn muốn xóa <strong>#{deleting?.code}</strong> - {deleting?.name}? Thao tác này không thể hoàn tác.</p>
      </Modal>

      <Modal open={!!viewing} title={`Merchant tham gia #${viewing?.code ?? ''}`} onClose={() => setViewing(null)} width="max-w-xl">
        {viewing && (() => {
          const list = pmByPromo.get(viewing.id) ?? []
          return list.length === 0 ? (
            <EmptyState message={`Chưa có dữ liệu chi tiết (tổng ${formatNumber(viewing.participants)} merchant tham gia toàn hệ thống).`} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-secondary">Tổng {formatNumber(viewing.participants)} merchant tham gia toàn hệ thống; dưới đây là {list.length} đối tác có số liệu.</p>
              <div className="divide-y divide-surface-container">
                {[...list].sort((a, b) => b.revenue_gain_vnd - a.revenue_gain_vnd).map((r) => (
                  <div key={r.merchant_id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link to={merchantPath(r.merchant_id)} className="block truncate font-label-lg text-[14px] font-bold text-on-surface hover:text-primary hover:underline">{r.merchant?.name ?? '—'}</Link>
                      <p className="text-[12px] text-secondary">{hashCode(r.merchant?.code)} • {formatNumber(r.orders_count)} đơn{r.uplift_pct != null && <> • Tăng {r.uplift_pct}%</>}</p>
                    </div>
                    <span className="flex-shrink-0 rounded bg-tertiary-fixed/30 px-2 py-0.5 text-[12px] font-bold text-tertiary">+{formatVndCompact(r.revenue_gain_vnd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal open={ranking} title={`Bảng xếp hạng ${ranked.length} Merchant theo doanh thu CTKM`} onClose={() => setRanking(false)} width="max-w-2xl">
        <div className="divide-y divide-surface-container">
          {ranked.map((t, i) => {
            const up = avgUplift(t)
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${i === 0 ? 'bg-primary-fixed text-on-primary-fixed' : i === 1 ? 'bg-surface-container-high text-primary' : 'bg-surface-container text-secondary'}`}>{i + 1}</div>
                  <div className="min-w-0">
                    <Link to={merchantPath(t.id)} className="block truncate font-label-lg text-[14px] font-bold text-on-surface hover:text-primary hover:underline">{t.name}</Link>
                    <p className="text-[12px] text-secondary">{hashCode(t.code)} • {t.promos} CTKM • {formatNumber(t.orders)} đơn{up !== null && <> • Tăng {up}%</>}</p>
                  </div>
                </div>
                <span className="flex-shrink-0 rounded bg-tertiary-fixed/30 px-2 py-0.5 text-[12px] font-bold text-tertiary">+{formatVndCompact(t.gain)}</span>
              </div>
            )
          })}
        </div>
      </Modal>

      <Modal open={policy} title="Chính sách tài trợ voucher" onClose={() => setPolicy(false)} width="max-w-2xl"
        footer={<>
          <button type="button" className={btnSecondary} onClick={() => setPolicy(false)}>Đóng</button>
          <button type="button" className={btnPrimary} onClick={() => { setTab('all'); setType('voucher'); setPage(1); setPolicy(false) }}>
            <Icon name="filter_alt" className="text-[20px]" />Lọc CTKM voucher
          </button>
        </>}>
        <p className="mb-3 text-[13px] text-secondary">Phân bổ ngân sách theo nguồn tài trợ của {promos.length} CTKM hiện có (tính từ dữ liệu thực).</p>
        <ResponsiveTable minWidth={460}>
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-surface-container text-[12px] uppercase tracking-wider text-secondary">
                <th className="py-2 pr-3 font-bold">Nguồn tài trợ</th>
                <th className="px-3 py-2 text-right font-bold">Số CTKM</th>
                <th className="px-3 py-2 text-right font-bold">Ngân sách</th>
                <th className="py-2 pl-3 text-right font-bold">Đã giải ngân</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {sponsorRows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-2 font-semibold text-on-surface"><span className={`h-2 w-2 rounded-full ${SPONSOR_DOT[r.key]}`} />{PROMO_SPONSORS[r.key]}</span></td>
                  <td className="px-3 py-2.5 text-right">{r.n}</td>
                  <td className="px-3 py-2.5 text-right">{formatVnd(r.budget)}</td>
                  <td className="py-2.5 pl-3 text-right font-semibold">{formatVnd(r.spent)}{r.budget > 0 && <span className="ml-1 text-[12px] text-secondary">({Math.round((r.spent / r.budget) * 100)}%)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      </Modal>

      <Modal open={budgetEdit !== null} title="Cập nhật hạn mức ngân sách" onClose={() => setBudgetEdit(null)} width="max-w-lg"
        footer={<>
          <button type="button" className={btnSecondary} onClick={() => setBudgetEdit(null)}>Hủy bỏ</button>
          <button type="button" className={btnPrimary} disabled={savingBudget} onClick={saveBudgets}>{savingBudget ? 'Đang lưu...' : 'Lưu hạn mức'}</button>
        </>}>
        <div className="flex flex-col gap-4">
          {budgets.map((b) => (
            <Field key={b.id} label={`${b.region} - ${b.quarter} (đã giải ngân ${formatVndCompact(b.spent_vnd)})`}>
              <input type="number" inputMode="numeric" min={0} step={1} required aria-invalid={!!budgetErrors[b.id]} className={`${inputCls} ${budgetErrors[b.id] ? 'border-error' : ''}`} value={budgetEdit?.[b.id] ?? ''}
                onChange={(e) => { setBudgetEdit((cur) => ({ ...(cur ?? {}), [b.id]: e.target.value })); setBudgetErrors((cur) => { const n = { ...cur }; delete n[b.id]; return n }) }} />
              {budgetErrors[b.id] && <span role="alert" className="text-[13px] text-error">{budgetErrors[b.id]}</span>}
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  )
}
