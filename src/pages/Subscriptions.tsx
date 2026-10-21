import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { btnPrimary, btnSecondary } from '../components/Form'
import { exportCsv } from '../lib/csv'
import { daysUntil, formatDate, formatNumber, formatVnd, formatVndCompact, hashCode, localISODate } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { invoicePath, merchantPath, subscriptionPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { Merchant, PlanTier, ServicePlan, Subscription } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'
import SubscriptionFormModal from './subscriptions/SubscriptionFormModal'
import { TIER_META } from './subscriptions/shared'

type SubRow = Subscription & { merchant: Pick<Merchant, 'id' | 'code' | 'name' | 'address' | 'region' | 'image_url' | 'emoji' | 'icon'> | null }
type Tab = 'all' | PlanTier | 'expiring'

const MERCHANT_COLS = 'id,code,name,address,region,image_url,emoji,icon'

const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low py-2.5 pl-10 pr-9 font-label-md text-[16px] sm:text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary-container'

const tabCls = (active: boolean) =>
  `min-h-10 flex-shrink-0 rounded-lg px-space-md py-2 font-label-md text-label-md transition-all whitespace-nowrap ${
    active ? 'bg-primary-container font-bold text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container hover:text-on-surface'
  }`

const rowBtn = 'inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-3 py-1.5 font-label-sm text-label-sm font-semibold transition-colors'

export default function Subscriptions() {
  const toast = useToast()
  const { settings } = useSettings()
  const PAGE_SIZE = settings.pageSize
  const subsQ = useQuery<SubRow[]>(
    () => supabase.from('subscriptions').select(`*, merchant:merchants(${MERCHANT_COLS})`).order('end_date', { ascending: true }),
    [],
  )
  const plansQ = useQuery<ServicePlan[]>(() => supabase.from('service_plans').select('*').order('sort_order'), [])
  const merchantsQ = useQuery<Pick<Merchant, 'id' | 'code' | 'name'>[]>(() => supabase.from('merchants').select('id,code,name').order('code'), [])

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [expiry, setExpiry] = useState('')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)
  const [formPlan, setFormPlan] = useState<string | null>(null) // non-null = modal open ('' = no preset plan)
  const [detailPlan, setDetailPlan] = useState<ServicePlan | null>(null)
  useNewParam(() => setFormPlan(''))

  const all = subsQ.data ?? []
  const plans = plansQ.data ?? []
  const current = useMemo(() => all.filter((s) => s.is_current), [all])

  const countTier = (t: PlanTier) => current.filter((s) => s.plan_tier === t).length
  const expiringCount = current.filter((s) => {
    const d = daysUntil(s.end_date)
    return d !== null && d >= 0 && d < 30
  }).length
  const regions = useMemo(() => Array.from(new Set(current.map((s) => s.merchant?.region).filter((r): r is string => !!r))).sort(), [current])

  // "Tỷ lệ duy trì gia hạn": of the contracts that have ended, the share that the merchant followed with a later contract
  const retention = useMemo(() => {
    const base = all.filter((s) => s.status !== 'cancelled' && (!s.is_current || (daysUntil(s.end_date) ?? 1) < 0))
    if (base.length === 0) return null
    const renewed = base.filter((s) => all.some((o) => o.merchant_id === s.merchant_id && o.start_date > s.start_date)).length
    return Math.round((renewed / base.length) * 1000) / 10
  }, [all])
  const monthStart = localISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const revenueThisMonth = all.filter((s) => s.status !== 'cancelled' && s.start_date >= monthStart).reduce((sum, s) => sum + s.amount_vnd, 0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return current.filter((s) => {
      const d = daysUntil(s.end_date)
      if (tab === 'expiring') {
        if (d === null || d < 0 || d >= 30) return false
      } else if (tab !== 'all' && s.plan_tier !== tab) return false
      if (expiry === 'expired' && !(d !== null && d < 0)) return false
      if (expiry === '30' && !(d !== null && d >= 0 && d < 30)) return false
      if (expiry === '90' && !(d !== null && d >= 30 && d <= 90)) return false
      if (expiry === 'long' && !(d !== null && d > 90)) return false
      if (region && s.merchant?.region !== region) return false
      if (!needle) return true
      return [s.code, s.merchant?.code, s.merchant?.name, s.merchant?.address].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [current, tab, q, expiry, region])

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const setT = (t: Tab) => { setTab(t); setPage(1) }
  const resetFilters = () => { setTab('all'); setQ(''); setExpiry(''); setRegion(''); setPage(1) }

  function exportList() {
    exportCsv(
      'goi-dich-vu.csv',
      [
        { header: 'Mã gói dịch vụ', value: (s: SubRow) => s.code },
        { header: 'Mã Merchant', value: (s) => s.merchant?.code },
        { header: 'Tên Merchant', value: (s) => s.merchant?.name },
        { header: 'Địa chỉ', value: (s) => s.merchant?.address },
        { header: 'Gói dịch vụ', value: (s) => s.plan_name },
        { header: 'Chu kỳ', value: (s) => s.cycle_label },
        { header: 'Giá tiền (đ)', value: (s) => s.amount_vnd },
        { header: 'Ngày bắt đầu', value: (s) => formatDate(s.start_date) },
        { header: 'Ngày hết hạn', value: (s) => formatDate(s.end_date) },
        { header: 'Số ngày còn lại', value: (s) => daysUntil(s.end_date) },
      ],
      filtered,
    )
  }

  const loading = (subsQ.loading && !subsQ.data) || (plansQ.loading && !plansQ.data)
  const error = subsQ.error ?? plansQ.error

  if (loading) return <div className="px-margin py-space-lg"><Loading /></div>
  if (error) return <div className="px-margin py-space-lg"><ErrorState message={error} onRetry={() => { subsQ.reload(); plansQ.reload() }} /></div>

  /** Remaining-time label + tone for a contract */
  const expiryOf = (s: SubRow) => {
    const d = daysUntil(s.end_date)
    const soon = d !== null && d >= 0 && d < 30
    const expired = d !== null && d < 0
    const text = d === null ? '—' : expired ? `Đã hết hạn ${-d} ngày` : soon ? `Còn ${d} ngày (Sắp hết hạn)` : `Còn ${d} ngày`
    return { d, soon, expired, text, warn: soon || expired }
  }

  const merchantAvatar = (m: SubRow['merchant']) => (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container shadow-sm ring-1 ring-black/5">
      {m?.image_url ? <img className="h-full w-full object-cover" alt={m.name} src={m.image_url} />
        : m?.emoji ? <span className="text-[20px]">{m.emoji}</span>
        : <Icon name={m?.icon ?? 'storefront'} className="text-[20px] text-primary" />}
    </div>
  )

  const rowActions = (s: SubRow, warn: boolean) => (
    <>
      <Link to={subscriptionPath(s.merchant_id)} className={`${rowBtn} bg-surface-container-low text-on-surface hover:bg-surface-container`}>
        <Icon name="visibility" className="text-[16px]" />
        <span>Hợp đồng</span>
      </Link>
      <Link to={invoicePath(s.merchant_id)} title="Xem hóa đơn VAT của gói hiện tại" className={`${rowBtn} bg-surface-container-low text-on-surface hover:bg-surface-container`}>
        <Icon name="receipt_long" className="text-[16px]" />
        <span>Hóa đơn</span>
      </Link>
      {warn ? (
        <Link to={`${subscriptionPath(s.merchant_id)}?renew=1`} className={`${rowBtn} bg-primary-container font-bold text-on-primary shadow-md hover:bg-primary-container/90`}>
          <Icon name="sync_saved_locally" className="text-[16px] text-on-primary" />
          <span className="text-on-primary">Gia hạn ngay</span>
        </Link>
      ) : (
        <Link to={`${subscriptionPath(s.merchant_id)}?renew=1`} className={`${rowBtn} bg-primary-container/10 font-bold text-primary hover:bg-primary-container hover:text-on-primary`}>
          <Icon name="autorenew" className="text-[16px]" />
          <span>Gia hạn sớm</span>
        </Link>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      {/* 1. Title & actions */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-primary-container/10 blur-3xl" />
        <div className="relative z-10">
          <PageHeader
            eyebrow={<span className="normal-case tracking-normal">Merchant Operation System • <span className="font-semibold text-primary-container">Dữ liệu trực tiếp từ hệ thống</span></span>}
            title="Quản Lý Gói Dịch Vụ & Gia Hạn Đối Tác"
            subtitle={<>Theo dõi trạng thái hợp đồng, điều phối quyền lợi và thực hiện quy trình tái ký hợp đồng cho {formatNumber(current.length)} đối tác ẩm thực F&amp;B trên toàn quốc.</>}
            actions={
              <>
                <button type="button" onClick={exportList} disabled={filtered.length === 0} className={btnSecondary}>
                  <Icon name="file_download" className="text-[20px] text-primary" />
                  <span>Xuất báo cáo Excel</span>
                </button>
                <button type="button" onClick={() => setFormPlan('')} className={btnPrimary}>
                  <Icon name="add_circle" className="text-[20px] text-on-primary" />
                  <span>Đăng ký gói mới</span>
                </button>
              </>
            }
          />
        </div>
      </div>

      {/* 2. Plan cards */}
      <div className="grid grid-cols-1 gap-space-lg pt-2 md:grid-cols-3">
        {plans.map((p) => {
          const n = countTier(p.code)
          const share = current.length ? Math.round((n / current.length) * 100) : 0
          const hot = p.code === 'gold'
          const diamond = p.code === 'diamond'
          return (
            <div key={p.id}
              className={`group relative flex flex-col justify-between rounded-xl bg-surface-container-lowest p-4 transition-all sm:p-space-xl ${hot ? 'shadow-md ring-2 ring-primary-container hover:shadow-lg' : 'shadow-sm hover:shadow-md'}`}>
              {p.badge && (
                <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary-container px-4 py-1 font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-primary shadow-[0_4px_10px_rgba(255,91,0,0.35)]">
                  <Icon name="local_fire_department" className="text-[15px] text-on-primary" />
                  <span>{p.badge}</span>
                </div>
              )}
              <div className="flex flex-col gap-space-md">
                <div className={`flex items-center justify-between gap-2 ${hot ? 'pt-1' : ''}`}>
                  <div className="flex min-w-0 items-center gap-space-md">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ${hot ? 'bg-primary-fixed' : diamond ? 'bg-surface-container-high' : 'bg-secondary-container'}`}>
                      <Icon name={p.icon ?? TIER_META[p.code].icon} className={`text-[28px] ${hot ? 'text-primary-container' : diamond ? 'text-tertiary' : 'text-secondary'}`} />
                    </div>
                    <div className="min-w-0">
                      <span className={`block break-words font-label-sm text-label-sm uppercase tracking-wider ${hot ? 'font-bold text-primary' : diamond ? 'font-bold text-tertiary' : 'text-secondary'}`}>{p.tier_label}</span>
                      <h2 className="break-words font-headline-lg text-headline-lg font-bold leading-tight text-on-surface">{p.name}</h2>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-label-sm text-label-sm font-semibold ${hot ? 'bg-primary-fixed font-bold text-on-primary-fixed' : diamond ? 'bg-surface-container-high text-on-background' : 'bg-secondary-container text-on-secondary-container'}`}>
                    {share}% Đối Tác
                  </span>
                </div>
                <div className="pt-space-sm">
                  <div className="flex flex-wrap items-baseline gap-1">
                    <span className={`font-headline-xl text-[26px] font-bold sm:text-headline-xl ${hot ? 'text-primary-container' : 'text-on-surface'}`}>{formatVnd(p.price_month_vnd)}</span>
                    <span className="font-body-md text-body-md text-secondary">/ tháng</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-secondary">{p.year_note}</span>
                </div>
                <div className="mt-space-xs flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-surface-container-low p-space-md">
                  <span className="font-label-md text-label-md text-secondary">Quy mô Merchant:</span>
                  <span className={`font-label-lg text-label-lg font-bold ${hot ? 'text-primary-container' : 'text-on-surface'}`}>{formatNumber(n)} Đối tác đang dùng</span>
                </div>
                <div className="flex flex-col gap-space-sm pt-space-xs">
                  <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Đặc quyền cốt lõi:</span>
                  <ul className="flex flex-col gap-2 font-body-md text-body-md text-on-surface">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Icon name="check_circle" className="text-[18px] text-tertiary" />
                        <span className="min-w-0">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-space-md flex flex-col gap-2 pt-space-lg">
                {hot && (
                  <button type="button" onClick={() => setFormPlan(p.code)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-container py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-[0_4px_12px_rgba(255,91,0,0.25)] transition-all hover:bg-primary-container/90">
                    <span>Nâng cấp cho đối tác</span>
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </button>
                )}
                <button type="button" onClick={() => setDetailPlan(p)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface-container py-2.5 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-secondary-container">
                  <span>Chi tiết cấu hình gói</span>
                  <Icon name="arrow_forward" className="text-[16px]" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 3. Toolbar */}
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-3 shadow-sm sm:p-space-md">
        <div className="flex flex-col gap-space-md xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-lg bg-surface-container-low p-1">
            <button type="button" className={tabCls(tab === 'all')} onClick={() => setT('all')}>Tất cả ({formatNumber(current.length)})</button>
            {(['silver', 'gold', 'diamond'] as PlanTier[]).map((t) => (
              <button key={t} type="button" className={tabCls(tab === t)} onClick={() => setT(t)}>
                {t === 'silver' ? 'Gói Bạc' : t === 'gold' ? 'Gói Vàng' : 'Gói Kim Cương'} ({formatNumber(countTier(t))})
              </button>
            ))}
            <button type="button" onClick={() => setT('expiring')}
              className={`flex min-h-10 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-space-md py-2 font-label-md text-label-md font-bold transition-all ${
                tab === 'expiring' ? 'bg-error text-on-error shadow-sm' : 'text-error hover:bg-error-container/50'}`}>
              <span className={`h-2 w-2 rounded-full ${tab === 'expiring' ? 'bg-on-error' : 'bg-error'}`} />
              <span>Sắp hết hạn &lt; 30 ngày ({formatNumber(expiringCount)})</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 font-label-md text-label-md text-secondary">
            <div className="flex items-center gap-2">
              <Icon name="verified" className="text-[18px] text-tertiary" />
              <span>Tỷ lệ duy trì gia hạn: <strong className="text-on-surface">{retention === null ? '—' : `${retention.toLocaleString('vi-VN')}%`}</strong></span>
            </div>
            <div className="hidden h-4 w-[1px] bg-secondary-container sm:block" />
            <div className="flex items-center gap-2">
              <Icon name="payments" className="text-[18px] text-primary" />
              <span>Doanh số gói tháng này: <strong className="text-on-surface">{formatVndCompact(revenueThisMonth)}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-space-sm md:flex-row md:flex-wrap md:items-center">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo mã gói, mã merchant, tên quán..." className="md:max-w-md" />
          <div className="relative w-full md:w-56">
            <Icon name="date_range" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            <select className={selectCls} value={expiry} onChange={(e) => { setExpiry(e.target.value); setPage(1) }} aria-label="Lọc theo thời hạn">
              <option value="">Thời hạn: Tất cả</option>
              <option value="expired">Đã hết hạn</option>
              <option value="30">Còn dưới 30 ngày</option>
              <option value="90">Còn 30 - 90 ngày</option>
              <option value="long">Còn trên 90 ngày</option>
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
          </div>
          <div className="relative w-full md:w-52">
            <Icon name="location_on" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            <select className={selectCls} value={region} onChange={(e) => { setRegion(e.target.value); setPage(1) }} aria-label="Lọc theo khu vực">
              <option value="">Khu vực: Toàn quốc</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
          </div>
          <div className="flex items-center gap-space-sm">
            <button type="button" onClick={resetFilters} title="Đặt lại tất cả bộ lọc"
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container-low px-space-md py-2.5 font-label-md text-label-md text-secondary transition-colors hover:bg-surface-container hover:text-on-surface md:flex-none">
              <Icon name="restart_alt" className="text-[18px]" />
              <span>Đặt lại bộ lọc</span>
            </button>
            <button type="button" title="Làm mới bảng" aria-label="Làm mới bảng" onClick={() => { subsQ.reload(); plansQ.reload() }}
              className="flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-surface-container-low p-2.5 text-secondary transition-colors hover:bg-surface-container hover:text-on-surface">
              <Icon name="refresh" className="text-[20px]" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Table */}
      <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <ResponsiveTable
          minWidth={980}
          cards={pageRows.map((s) => {
            const x = expiryOf(s)
            const m = s.merchant
            const tier = TIER_META[s.plan_tier]
            return (
              <MobileCard
                key={s.id}
                title={m ? <Link to={merchantPath(m.id)} className="hover:text-primary">{m.name}</Link> : '—'}
                subtitle={<span className="font-semibold">{hashCode(m?.code)}</span>}
                badge={<span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-label-sm text-label-sm font-bold ${tier.pill}`}><Icon name={tier.icon} className={`text-[14px] ${tier.iconCls}`} />{s.plan_name}</span>}
                fields={[
                  ['Mã gói', <Link key="c" to={subscriptionPath(s.merchant_id)} className="font-bold hover:text-primary">{hashCode(s.code)}</Link>],
                  ['Giá tiền', formatVnd(s.amount_vnd)],
                  ['Chu kỳ', s.cycle_label ?? '—'],
                  ['Thời hạn', `${formatDate(s.start_date)} → ${formatDate(s.end_date)}`],
                  ['Còn lại', <span key="d" className={x.warn ? 'text-error' : 'text-tertiary'}>{x.d === null ? '—' : x.expired ? `Quá hạn ${-x.d} ngày` : `Còn ${x.d} ngày`}</span>],
                ]}
                actions={rowActions(s, x.warn)}
              />
            )
          })}
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-primary-container text-on-primary">
                {['Mã Gói Dịch Vụ', 'Mã Merchant Sử Dụng', 'Gói Dịch Vụ', 'Giá Tiền', 'Thời Hạn', 'Hành Động / Thao Tác'].map((h, i) => (
                  <th key={h} scope="col" className={`whitespace-nowrap px-4 py-4 font-headline-md text-[14px] font-bold uppercase tracking-wider text-on-primary ${i === 5 ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/40 font-body-md text-body-md text-on-surface">
              {pageRows.map((s) => {
                const tier = TIER_META[s.plan_tier]
                const x = expiryOf(s)
                const m = s.merchant
                return (
                  <tr key={s.id} className={`group transition-colors hover:bg-primary-fixed/20 ${x.warn ? 'bg-error-container/20' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <Link to={subscriptionPath(s.merchant_id)} className="flex items-center gap-2" title="Xem chi tiết hợp đồng">
                        <Icon name={s.plan_tier === 'diamond' ? 'vpn_key' : tier.icon} className={`text-[18px] ${s.plan_tier === 'diamond' ? 'text-tertiary' : s.plan_tier === 'gold' ? 'text-primary' : 'text-secondary'}`} />
                        <span className="font-label-lg text-label-lg font-bold text-on-surface transition-colors group-hover:text-primary">{hashCode(s.code)}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-space-md text-left">
                        {merchantAvatar(m)}
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-surface-container px-1.5 py-0.5 font-label-sm text-label-sm font-bold text-secondary">{hashCode(m?.code)}</span>
                            {m ? (
                              <Link to={merchantPath(m.id)} className="font-headline-md text-[15px] font-bold text-on-surface hover:text-primary hover:underline">{m.name}</Link>
                            ) : <span className="font-headline-md text-[15px] font-bold">—</span>}
                          </div>
                          <span className="max-w-[320px] truncate font-body-sm text-body-sm text-secondary">{m?.address}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-md text-label-md font-bold ${tier.pill}`}>
                        <Icon name={tier.icon} className={`text-[16px] ${tier.iconCls}`} />
                        <span>{s.plan_name}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-label-lg text-[15px] font-bold text-on-surface">{formatVnd(s.amount_vnd)}</span>
                        <span className="font-body-sm text-body-sm text-secondary">{s.contract_note}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                          <span>{formatDate(s.start_date)}</span>
                          <span className="text-secondary">→</span>
                          <span className={`font-bold ${x.warn ? 'text-error' : ''}`}>{formatDate(s.end_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${x.soon ? 'animate-ping bg-error' : x.expired ? 'bg-error' : 'bg-tertiary'}`} />
                          <span className={`font-label-sm text-label-sm font-bold ${x.warn ? 'text-error' : 'text-tertiary'}`}>{x.text}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">{rowActions(s, x.warn)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ResponsiveTable>
        {filtered.length === 0 && <EmptyState message="Không tìm thấy hợp đồng gói dịch vụ nào phù hợp." />}
        <Pagination page={curPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} label="hợp đồng gói dịch vụ" />
      </div>

      {formPlan !== null && (
        <SubscriptionFormModal
          title="Đăng ký gói mới cho Merchant"
          merchants={merchantsQ.data ?? []}
          subs={all}
          defaultPlanCode={formPlan || undefined}
          onClose={() => setFormPlan(null)}
          onDone={({ subscription, invoice }) => {
            setFormPlan(null)
            toast(`Đã đăng ký gói ${subscription.plan_name} (#${subscription.code}) - Hóa đơn ${invoice.number}`)
            subsQ.reload()
          }}
        />
      )}

      <Modal
        open={!!detailPlan}
        title={detailPlan ? `Cấu hình ${detailPlan.name}` : ''}
        onClose={() => setDetailPlan(null)}
        width="max-w-xl"
        footer={detailPlan && (
          <>
            <button type="button" className={btnSecondary} onClick={() => setDetailPlan(null)}>Đóng</button>
            <button type="button" className={btnPrimary} onClick={() => { const c = detailPlan.code; setDetailPlan(null); setFormPlan(c) }}>
              <Icon name="add_circle" className="text-[20px]" />Đăng ký gói này
            </button>
          </>
        )}
      >
        {detailPlan && (() => {
          const users = current.filter((s) => s.plan_tier === detailPlan.code)
          return (
            <div className="flex flex-col gap-space-md">
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="rounded-lg bg-surface-container-low p-3"><dt className="text-secondary">Giá theo tháng</dt><dd className="font-bold text-on-surface">{formatVnd(detailPlan.price_month_vnd)}</dd></div>
                <div className="rounded-lg bg-surface-container-low p-3"><dt className="text-secondary">Giá theo năm</dt><dd className="font-bold text-on-surface">{formatVnd(detailPlan.price_year_vnd)}</dd></div>
                <div className="rounded-lg bg-surface-container-low p-3"><dt className="text-secondary">Phí hoa hồng nền tảng</dt><dd className="font-bold text-on-surface">{detailPlan.commission_pct}%</dd></div>
                <div className="rounded-lg bg-surface-container-low p-3"><dt className="text-secondary">Đối tác đang dùng</dt><dd className="font-bold text-on-surface">{formatNumber(users.length)}</dd></div>
              </dl>
              <div>
                <p className="mb-1.5 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Đặc quyền</p>
                <ul className="flex flex-col gap-1.5 text-[14px]">
                  {detailPlan.features.map((f) => <li key={f} className="flex items-center gap-2"><Icon name="check_circle" className="text-[18px] text-tertiary" />{f}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Đối tác đang sử dụng</p>
                {users.length === 0 ? <p className="text-[13px] text-secondary">Chưa có đối tác nào dùng gói này.</p> : (
                  <ul className="divide-y divide-surface-container">
                    {users.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                        <Link to={merchantPath(s.merchant_id)} className="min-w-0 truncate font-bold text-on-surface hover:text-primary">{s.merchant?.name ?? '—'}</Link>
                        <Link to={subscriptionPath(s.merchant_id)} className="flex-shrink-0 text-[13px] font-semibold text-primary hover:underline">{hashCode(s.code)} • hết hạn {formatDate(s.end_date)}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
