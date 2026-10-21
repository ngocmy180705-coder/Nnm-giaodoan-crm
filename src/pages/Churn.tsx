import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { btnPrimary, btnSecondary } from '../components/Form'
import { CONTACT_PURPOSES, RISK_LEVELS, RISK_TYPES } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { daysUntil, formatDate, formatNumber, hashCode } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { contactsPath, merchantPath, subscriptionPath } from '../lib/links'
import { REMIND_TOAST } from '../lib/contactLog'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { ChurnRisk, Staff } from '../lib/types'
import { useQuery } from '../lib/useQuery'
import { useRowSelection } from '../lib/useRowSelection'
import CampaignModal from '../components/CampaignModal'
import { AssignModal, CareModal } from './churn/modals'
import type { RiskRow } from './churn/types'

type Tab = 'all' | ChurnRisk['risk_type'] | 'handled'

const LEVEL_RANK: Record<ChurnRisk['risk_level'], number> = { critical: 0, high: 1, medium: 2 }
const LEVEL_TONE = { critical: 'danger', high: 'warning', medium: 'neutral' } as const
const ACTIVITY_ICON: Record<ChurnRisk['risk_type'], string> = { expiring: 'hourglass_top', order_gap: 'receipt_long', app_inactive: 'phonelink_erase' }

/** Remaining-time pill: <= 7 days = red, else green; shown in days (< 1 month) or months. */
function remaining(expiresOn: string | null): { text: string; danger: boolean } {
  const d = daysUntil(expiresOn)
  if (d === null) return { text: '—', danger: false }
  if (d < 0) return { text: `Quá hạn ${-d} ngày`, danger: true }
  if (d === 0) return { text: 'Hết hạn hôm nay', danger: true }
  if (d <= 7) return { text: `Còn ${d} ngày`, danger: true }
  if (d < 30) return { text: `Còn ${d} ngày`, danger: false }
  return { text: `Còn ${Math.round(d / 30)} tháng`, danger: false }
}

/** What the "Hoạt động" column shows: the stored alert, else a description built from the risk type / counters. */
function alertText(r: RiskRow): string {
  if (r.alert_text) return r.alert_text
  if (r.risk_type === 'expiring') {
    const d = daysUntil(r.expires_on)
    return d === null ? RISK_TYPES.expiring : d <= 0 ? 'Dịch vụ đã đến hạn gia hạn' : `Dịch vụ hết hạn sau ${d} ngày`
  }
  if (r.inactive_days) return r.risk_type === 'order_gap' ? `${r.inactive_days} ngày không phát sinh đơn` : `${r.inactive_days} ngày chưa vào app`
  return RISK_TYPES[r.risk_type]
}

const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low py-2.5 pl-3.5 pr-8 font-label-md text-[16px] text-on-surface outline-none focus:ring-2 focus:ring-primary-container sm:w-auto sm:text-label-md'

export default function Churn() {
  const toast = useToast()
  const { settings } = useSettings()
  const pageSize = settings.pageSize
  const [params] = useSearchParams()
  const { data, loading, error, reload } = useQuery<RiskRow[]>(
    () =>
      supabase
        .from('churn_risks')
        .select('*, merchant:merchants(id,code,name,phone,address,icon,emoji,region,status), assignee:staff!assignee_id(id,full_name)'),
    [],
  )
  const totalQ = useQuery<number>(
    () => supabase.from('merchants').select('id').then((r) => ({ data: r.data?.length ?? 0, error: r.error })),
    [],
  )
  const staffQ = useQuery<Staff[]>(() => supabase.from('staff').select('*').order('code'), [])

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState(() => params.get('q') ?? '') // /churn?q=<merchant code> (links from Tổng quan)
  const [region, setRegion] = useState('')
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)
  const [care, setCare] = useState<RiskRow | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [campaign, setCampaign] = useState(false)

  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          LEVEL_RANK[a.risk_level] - LEVEL_RANK[b.risk_level] ||
          (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999') ||
          (a.merchant?.code ?? '').localeCompare(b.merchant?.code ?? ''),
      ),
    [data],
  )

  const counts = useMemo(
    () => ({
      all: rows.length,
      expiring: rows.filter((r) => r.risk_type === 'expiring').length,
      order_gap: rows.filter((r) => r.risk_type === 'order_gap').length,
      app_inactive: rows.filter((r) => r.risk_type === 'app_inactive').length,
      handled: rows.filter((r) => r.handled).length,
    }),
    [rows],
  )

  const regions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.merchant?.region).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, 'vi')),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return rows.filter((r) => {
      if (tab === 'handled' ? !r.handled : tab !== 'all' && r.risk_type !== tab) return false
      if (region && r.merchant?.region !== region) return false
      if (level && r.risk_level !== level) return false
      if (!needle) return true
      return [r.merchant?.code, r.merchant?.name, r.merchant?.phone, r.merchant?.address].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [rows, tab, region, level, q])

  const { selected, setSelected, selectedRows } = useRowSelection(filtered)

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const pageRows = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)

  const atRiskMerchants = new Set(rows.map((r) => r.merchant_id)).size
  const openRisks = rows.filter((r) => !r.handled).length
  const share = totalQ.data ? Math.round((atRiskMerchants / totalQ.data) * 1000) / 10 : 0

  function exportList() {
    exportCsv(
      'nguy-co-roi-bo.csv',
      [
        { header: 'Mã Merchant', value: (r: RiskRow) => r.merchant?.code },
        { header: 'Tên Merchant', value: (r) => r.merchant?.name },
        { header: 'Số điện thoại', value: (r) => r.merchant?.phone },
        { header: 'Địa chỉ', value: (r) => r.merchant?.address },
        { header: 'Loại nguy cơ', value: (r) => RISK_TYPES[r.risk_type] },
        { header: 'Mức độ rủi ro', value: (r) => RISK_LEVELS[r.risk_level] },
        { header: 'Ngày hết hạn dịch vụ', value: (r) => formatDate(r.expires_on) },
        { header: 'Thời hạn còn lại', value: (r) => remaining(r.expires_on).text },
        { header: 'Cảnh báo hoạt động', value: (r) => alertText(r) },
        { header: 'Nhân sự phụ trách', value: (r) => r.assignee?.full_name },
        { header: 'Đã liên hệ xử lý', value: (r) => (r.handled ? 'Đã xử lý' : 'Chưa xử lý') },
        { header: 'Ghi chú', value: (r) => r.note },
      ],
      filtered,
    )
  }

  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
  function toggleAll() {
    setSelected((cur) => {
      const next = new Set(cur)
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(r.id))
      else pageRows.forEach((r) => next.add(r.id))
      return next
    })
  }

  function resetFilters() {
    setTab('all'); setQ(''); setRegion(''); setLevel(''); setPage(1)
    reload()
  }

  // only risk rows whose merchant exists can get a contact log, so only those can be marked handled
  const campaignMerchants = useMemo(
    () => Array.from(new Map(selectedRows.filter((r) => r.merchant).map((r) => [r.merchant_id, r.merchant!])).values()),
    [selectedRows],
  )
  async function markCampaignHandled(loggedMerchantIds: string[]) {
    const logged = new Set(loggedMerchantIds)
    const ids = selectedRows.filter((r) => r.merchant && logged.has(r.merchant_id)).map((r) => r.id)
    if (ids.length === 0) return null
    const { error: err } = await supabase.from('churn_risks').update({ handled: true, handled_at: new Date().toISOString() }).in('id', ids)
    return err ? err.message : null
  }

  const needSelection = (then: () => void) => () => (selectedRows.length ? then() : toast('Hãy tích chọn ít nhất một merchant trong danh sách trước'))

  const tabBtn = (key: Tab, label: string, count: number, badge: string) => (
    <button key={key} type="button" onClick={() => { setTab(key); setPage(1) }}
      className={`flex min-h-[40px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-space-md py-2 font-label-md text-label-md shadow-sm transition-colors ${
        tab === key ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'}`}>
      <span>{label}</span>
      <span className={`rounded-full px-1.5 text-label-sm font-bold ${tab === key ? 'bg-on-primary/20 text-on-primary' : badge}`}>{formatNumber(count)}</span>
    </button>
  )

  const avatar = (m: RiskRow['merchant']) => (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container font-bold text-primary-container">
      {m?.emoji ? <span className="text-[20px]">{m.emoji}</span> : <Icon name={m?.icon ?? 'storefront'} className="text-[20px]" />}
    </div>
  )

  const iconLink = 'flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-container hover:text-primary'

  const careBtn = (r: RiskRow) =>
    r.risk_type === 'expiring' && !r.handled && r.merchant?.phone ? (
      <a href={`tel:${r.merchant.phone.replace(/\s+/g, '')}`} onClick={() => { toast(`Đang gọi ${r.merchant?.name ?? ''} (${r.merchant?.phone ?? ''})`); setCare(r) }}
        className="flex min-h-[40px] items-center gap-1 whitespace-nowrap rounded-lg bg-primary-container px-3 py-1.5 font-label-sm text-label-sm text-on-primary shadow-sm transition-transform hover:opacity-90 active:scale-95">
        <Icon name="call" className="text-[15px]" />
        <span>Gọi ngay</span>
      </a>
    ) : (
      <button type="button" onClick={() => setCare(r)}
        className="flex min-h-[40px] items-center gap-1 whitespace-nowrap rounded-lg bg-surface-container-high px-3 py-1.5 font-label-sm text-label-sm text-on-surface shadow-sm transition-transform hover:bg-surface-container active:scale-95">
        <Icon name="support_agent" className="text-[15px] text-primary" />
        <span>Chăm sóc</span>
      </button>
    )

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-space-sm py-0.5 font-label-sm text-label-sm font-bold normal-case tracking-wide text-on-primary-fixed-variant shadow-sm">
            <Icon name="smart_toy" className="animate-pulse text-[15px] text-primary" />
            HỆ THỐNG CẢNH BÁO SỚM AI
          </span>
        }
        title="Quản Lý Nguy Cơ Rời Bỏ"
        subtitle={<span className="block max-w-2xl">Theo dõi và phát hiện sớm các đối tác F&B có dấu hiệu sụt giảm tương tác, sắp hết hạn hợp đồng dịch vụ hoặc ngừng phát sinh đơn để kịp thời chăm sóc và giữ chân.</span>}
        actions={
          <>
            <button type="button" onClick={exportList} disabled={filtered.length === 0} className={`${btnSecondary} min-h-[40px]`}>
              <Icon name="file_download" className="text-[19px] text-tertiary" />
              <span>Xuất<span className="hidden sm:inline"> Excel</span></span>
            </button>
            <button type="button" onClick={needSelection(() => setCampaign(true))} className={`${btnSecondary} min-h-[40px]`}
              title={selectedRows.length ? undefined : 'Tích chọn merchant trong danh sách để tạo chiến dịch'}>
              <Icon name="campaign" className="text-[19px] text-primary" />
              <span>Chiến dịch<span className="hidden sm:inline"> chăm sóc</span>{selectedRows.length ? ` (${selectedRows.length})` : ''}</span>
            </button>
            <button type="button" onClick={needSelection(() => setAssigning(true))} className={`${btnPrimary} min-h-[40px]`}
              title={selectedRows.length ? undefined : 'Tích chọn merchant trong danh sách để phân công'}>
              <Icon name="person_add" className="text-[19px]" />
              <span>Phân công<span className="hidden sm:inline"> CSKH</span>{selectedRows.length ? ` (${selectedRows.length})` : ''}</span>
            </button>
          </>
        }
      />

      {/* KPI bento: 2 per row on phones */}
      <div className="grid grid-cols-2 gap-space-sm sm:gap-space-md lg:grid-cols-4">
        <KpiCard label="Merchant nguy cơ" value={<span className="text-error">{formatNumber(atRiskMerchants)}</span>} icon="warning" tone="error"
          footer={<span className="text-secondary"><b className="text-error">{share.toLocaleString('vi-VN')}%</b> hệ thống · {openRisks} chưa xử lý</span>} />
        <KpiCard label="Sắp hết hạn gói" value={formatNumber(counts.expiring)} icon="hourglass_top" tone="primary" footer={<span className="text-secondary">Cần liên hệ tái ký gấp</span>} />
        <KpiCard label="Gián đoạn đơn" value={formatNumber(counts.order_gap)} icon="production_quantity_limits" tone="secondary" footer={<span className="text-secondary">&gt; 7 ngày không có đơn</span>} />
        <KpiCard label="Ngừng dùng app/POS" value={formatNumber(counts.app_inactive)} icon="phonelink_erase" tone="secondary" footer={<span className="text-secondary">&gt; 5 ngày chưa truy cập</span>} />
      </div>

      {/* Tabs + filter bar */}
      <div className="flex flex-col gap-space-md">
        <div className="-mx-margin flex gap-space-xs overflow-x-auto px-margin pb-1">
          {tabBtn('all', 'Tất cả', counts.all, 'bg-surface-container text-secondary')}
          {tabBtn('expiring', 'Sắp hết hạn dịch vụ', counts.expiring, 'bg-error-container text-on-error-container')}
          {tabBtn('order_gap', 'Gián đoạn phát sinh đơn', counts.order_gap, 'bg-primary-fixed text-on-primary-fixed-variant')}
          {tabBtn('app_inactive', 'Không truy cập app', counts.app_inactive, 'bg-surface-container text-secondary')}
          {tabBtn('handled', 'Đã liên hệ xử lý', counts.handled, 'bg-tertiary-fixed text-on-tertiary-fixed-variant')}
        </div>
        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row md:items-center md:justify-between">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo mã Merchant, tên quán, số điện thoại..." />
          <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center">
            <div className="relative">
              <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1) }} className={selectCls} aria-label="Khu vực">
                <option value="">Khu vực: Toàn quốc</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            </div>
            <div className="relative">
              <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1) }} className={selectCls} aria-label="Mức độ rủi ro">
                <option value="">Mức độ rủi ro: Tất cả</option>
                {(Object.keys(RISK_LEVELS) as ChurnRisk['risk_level'][]).map((l) => <option key={l} value={l}>{RISK_LEVELS[l]}</option>)}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            </div>
            <button type="button" onClick={resetFilters} className={`${btnSecondary} min-h-[40px] max-sm:w-full`} title="Xóa bộ lọc và tải lại dữ liệu">
              <Icon name="refresh" className="text-[20px]" />
              <span className="sm:hidden">Xóa bộ lọc</span>
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div>
          <div className="md:overflow-hidden md:rounded-t-xl md:bg-surface-container-lowest md:shadow-sm">
            {filtered.length > 0 && (
              <ResponsiveTable minWidth={1000}
                cards={pageRows.map((r) => {
                  const m = r.merchant
                  const rem = remaining(r.expires_on)
                  return (
                    <MobileCard key={r.id}
                      title={
                        <span className="flex items-center gap-1">
                          <label className="-ml-2 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center" aria-label="Chọn merchant">
                            <input type="checkbox" className="h-4 w-4 cursor-pointer accent-primary-container" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                          </label>
                          <span className="min-w-0 truncate">
                            {m ? <Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">{m.name}</Link> : '—'}
                          </span>
                        </span>
                      }
                      subtitle={m ? <Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">{hashCode(m.code)}</Link> : undefined}
                      badge={<StatusBadge tone={rem.danger ? 'danger' : 'success'}>{rem.text}</StatusBadge>}
                      fields={[
                        ['Mức độ', <StatusBadge key="l" tone={LEVEL_TONE[r.risk_level]}>{RISK_LEVELS[r.risk_level].replace(/ \(.*\)/, '')}</StatusBadge>],
                        ['Điện thoại', m?.phone ? <a key="p" href={`tel:${m.phone.replace(/\s+/g, '')}`} className="text-primary">{m.phone}</a> : '—'],
                        ['Cảnh báo', alertText(r)],
                        ['Phụ trách', r.assignee?.full_name ?? '—'],
                        ...(r.handled ? [['Trạng thái', 'Đã liên hệ xử lý'] as [string, string]] : []),
                      ]}
                      actions={
                        <>
                          {careBtn(r)}
                          {m && (
                            <>
                              <Link to={subscriptionPath(m.id)} className="flex min-h-[40px] items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 text-[13px] font-semibold text-on-surface"><Icon name="calendar_today" className="text-[16px] text-primary" />Gói</Link>
                              <Link to={contactsPath(m.code)} className="flex min-h-[40px] items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 text-[13px] font-semibold text-on-surface"><Icon name="history" className="text-[16px] text-primary" />Liên hệ</Link>
                            </>
                          )}
                        </>
                      }
                    />
                  )
                })}>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-primary-container text-on-primary">
                      <th className="w-12 px-3 py-3.5 text-center">
                        <input type="checkbox" aria-label="Chọn tất cả trên trang" className="h-4 w-4 cursor-pointer rounded align-middle accent-primary-container" checked={allOnPageSelected} onChange={toggleAll} />
                      </th>
                      <th className="whitespace-nowrap px-3 py-3.5 font-headline-md text-label-md font-bold uppercase tracking-wider">MÃ MERCHANT</th>
                      <th className="px-3 py-3.5 font-headline-md text-label-md font-bold uppercase tracking-wider">TÊN MERCHANT</th>
                      <th className="px-3 py-3.5 font-headline-md text-label-md font-bold uppercase tracking-wider">SỐ ĐIỆN THOẠI</th>
                      <th className="px-3 py-3.5 text-center font-headline-md text-label-md font-bold uppercase tracking-wider">THỜI HẠN CÒN LẠI</th>
                      <th className="px-3 py-3.5 font-headline-md text-label-md font-bold uppercase tracking-wider">HOẠT ĐỘNG</th>
                      <th className="px-3 py-3.5 text-center font-headline-md text-label-md font-bold uppercase tracking-wider">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body-md text-body-md text-on-surface">
                    {pageRows.map((r) => {
                      const m = r.merchant
                      const rem = remaining(r.expires_on)
                      return (
                        <tr key={r.id} className="group transition-colors hover:bg-primary-fixed/20">
                          <td className="px-3 py-3 text-center">
                            <input type="checkbox" aria-label="Chọn merchant" className="h-4 w-4 cursor-pointer rounded accent-primary-container" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                          </td>
                          <td className="px-3 py-3">
                            {m ? (
                              <Link to={merchantPath(m.id)} className="inline-block whitespace-nowrap rounded-md bg-surface-container-high px-2.5 py-1 font-label-md text-label-md font-bold tracking-tight text-on-surface hover:text-primary">{hashCode(m.code)}</Link>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-space-sm">
                              {avatar(m)}
                              <div className="min-w-0">
                                {m ? (
                                  <Link to={merchantPath(m.id)} className="block max-w-[160px] truncate font-headline-md text-body-lg font-bold text-on-surface transition-colors hover:text-primary hover:underline">{m.name}</Link>
                                ) : '—'}
                                <div className="max-w-[160px] truncate font-body-sm text-body-sm text-secondary">{m?.address}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {m?.phone ? <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="font-label-lg text-label-lg font-medium text-on-surface hover:text-primary">{m.phone}</a> : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-label-md text-label-md font-bold ${
                              rem.danger ? 'bg-error-container text-error shadow-sm' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'}`}>
                              <Icon name={rem.danger ? 'error' : 'check_circle'} className="text-[16px]" />
                              <span>{rem.text}</span>
                            </span>
                          </td>
                          <td className="min-w-[170px] px-3 py-3 text-secondary">
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-fixed px-2.5 py-1 font-label-md text-label-md font-semibold text-on-primary-fixed-variant">
                                <Icon name={ACTIVITY_ICON[r.risk_type]} className="text-[16px] text-primary" />
                                <span>{alertText(r)}</span>
                              </span>
                              {r.handled && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-tertiary-fixed px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-tertiary-fixed-variant" title={r.note ?? undefined}>
                                  <Icon name="task_alt" className="text-[14px]" />
                                  Đã liên hệ xử lý
                                </span>
                              )}
                              {r.assignee && <span className="font-body-sm text-body-sm text-secondary">Phụ trách: {r.assignee.full_name}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {careBtn(r)}
                              {m && (
                                <>
                                  <Link to={subscriptionPath(m.id)} title="Gói & gia hạn" aria-label="Gói và gia hạn" className={iconLink}><Icon name="calendar_today" className="text-[19px]" /></Link>
                                  <Link to={contactsPath(m.code)} title="Lịch sử liên hệ" aria-label="Lịch sử liên hệ" className={iconLink}><Icon name="history" className="text-[19px]" /></Link>
                                  <Link to={merchantPath(m.id)} title="Xem hồ sơ merchant" aria-label="Xem hồ sơ merchant" className={iconLink}><Icon name="visibility" className="text-[19px]" /></Link>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ResponsiveTable>
            )}
            {filtered.length === 0 && <EmptyState message="Không có merchant nào có nguy cơ phù hợp bộ lọc." />}
          </div>
          <div className="mt-space-sm overflow-hidden rounded-xl shadow-sm md:mt-0 md:rounded-t-none">
            <Pagination page={curPage} pageSize={pageSize} total={filtered.length} onPage={setPage} label="Merchant có nguy cơ" />
          </div>
        </div>
      )}

      <CareModal
        row={care}
        staff={staffQ.data ?? []}
        onClose={() => setCare(null)}
        onSaved={(msg) => { setCare(null); toast(msg); reload() }}
      />
      <AssignModal
        open={assigning}
        ids={selectedRows.map((r) => r.id)}
        staff={staffQ.data ?? []}
        onClose={() => setAssigning(false)}
        onSaved={(msg) => { setAssigning(false); setSelected(new Set()); toast(msg); reload() }}
      />
      <CampaignModal
        open={campaign}
        merchants={campaignMerchants}
        staff={staffQ.data ?? []}
        tag="Chiến dịch giữ chân"
        defaultPurpose={CONTACT_PURPOSES[0]}
        defaultContent="Chiến dịch chăm sóc giữ chân đối tác: liên hệ hỏi thăm tình hình kinh doanh và hỗ trợ gia hạn / vận hành."
        markHandledLabel='Đánh dấu các nguy cơ này là "Đã liên hệ xử lý"'
        onMarkHandled={markCampaignHandled}
        onClose={() => setCampaign(false)}
        onDone={(n) => { setCampaign(false); setSelected(new Set()); toast(REMIND_TOAST(n)); reload() }}
      />
    </div>
  )
}
