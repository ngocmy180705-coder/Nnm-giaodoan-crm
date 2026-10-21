import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import CampaignModal from '../components/CampaignModal'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Field, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { MERCHANT_STATUSES, merchantStatus } from '../lib/constants'
import { REMIND_TOAST } from '../lib/contactLog'
import { exportCsv } from '../lib/csv'
import { daysUntil, formatNumber } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { contactsPath, merchantPath, ROUTES, subscriptionPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { Merchant, MerchantStatus } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'
import { useRowSelection } from '../lib/useRowSelection'
import { expiryState } from './subscriptions/shared'

const REGIONS = ['Đà Nẵng', 'Hà Nội', 'TP. Hồ Chí Minh', 'Huế', 'Bắc Ninh', 'Quảng Nam', 'Lâm Đồng']

export default function MerchantList() {
  const navigate = useNavigate()
  const toast = useToast()
  const PAGE_SIZE = useSettings().settings.pageSize
  const { data, loading, error, reload, setData } = useQuery<Merchant[]>(
    () => supabase.from('merchants').select('*').order('code', { ascending: false }),
    [],
  )

  const [status, setStatus] = useState<'all' | MerchantStatus>('all')
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [campaign, setCampaign] = useState(false)
  useNewParam(() => setAdding(true))

  const merchants = data ?? []

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: merchants.length }
    for (const s of MERCHANT_STATUSES) c[s.value] = merchants.filter((m) => m.status === s.value).length
    return c
  }, [merchants])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return merchants.filter((m) => {
      if (status !== 'all' && m.status !== status) return false
      if (region && m.region !== region) return false
      if (!needle) return true
      return [m.code, m.name, m.phone, m.address, m.category, m.contact_name].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [merchants, status, q, region])

  const { selected, setSelected, selectedRows } = useRowSelection(filtered)

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  // KPI numbers (computed from data)
  const total = merchants.length
  const active = counts.active ?? 0
  const onboarding = counts.onboarding ?? 0
  const expiring = merchants.filter((m) => {
    const d = daysUntil(m.contract_end)
    return d !== null && d >= 0 && expiryState(d) === 'soon'
  }).length
  const newLast30 = merchants.filter((m) => Date.now() - new Date(m.created_at).getTime() < 30 * 86400000).length
  const growth = total - newLast30 > 0 ? Math.round((newLast30 / (total - newLast30)) * 100) : 0
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0)
  const coverage = pct(active + onboarding)

  async function changeStatus(m: Merchant, next: MerchantStatus) {
    const prev = m.status
    setData((cur) => (cur ?? []).map((x) => (x.id === m.id ? { ...x, status: next } : x)))
    const { error: err } = await supabase.from('merchants').update({ status: next }).eq('id', m.id)
    if (err) {
      setData((cur) => (cur ?? []).map((x) => (x.id === m.id ? { ...x, status: prev } : x)))
      toast(`Không cập nhật được trạng thái: ${err.message}`)
    } else {
      toast(`Đã cập nhật ${m.name} → ${merchantStatus(next).label}`)
    }
  }

  function exportList() {
    exportCsv(
      'merchants.csv',
      [
        { header: 'Mã Merchant', value: (m: Merchant) => m.code },
        { header: 'Tên Merchant', value: (m) => m.name },
        { header: 'Phân loại', value: (m) => m.category },
        { header: 'Số điện thoại', value: (m) => m.phone },
        { header: 'Địa chỉ quán', value: (m) => m.address_full ?? m.address },
        { header: 'Khu vực', value: (m) => m.region },
        { header: 'Người liên hệ', value: (m) => m.contact_name },
        { header: 'Email', value: (m) => m.email },
        { header: 'Trạng thái', value: (m) => merchantStatus(m.status).label },
      ],
      filtered,
    )
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((m) => selected.has(m.id))
  function toggleAll() {
    setSelected((cur) => {
      const next = new Set(cur)
      if (allOnPageSelected) pageRows.forEach((m) => next.delete(m.id))
      else pageRows.forEach((m) => next.add(m.id))
      return next
    })
  }

  // donut: circumference of r=40 is 251.2
  const donut = (() => {
    let offset = 0
    return MERCHANT_STATUSES.map((s) => {
      const share = total ? (counts[s.value] ?? 0) / total : 0
      const len = share * 251.2
      const seg = { s, share, len, offset: -offset }
      offset += len
      return seg
    })
  })()

  const toggleOne = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pill = (on: boolean) =>
    on ? 'bg-primary-container font-bold text-on-primary shadow-sm' : 'border border-secondary-container/50 bg-surface-container-low font-semibold text-on-surface hover:bg-surface-container'

  const statusSelect = (m: Merchant) => (
    <select value={m.status} onChange={(e) => changeStatus(m, e.target.value as MerchantStatus)} aria-label={`Trạng thái ${m.name}`}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[14px] font-semibold transition-all focus:outline-none ${merchantStatus(m.status).select}`}>
      {MERCHANT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )

  const quickLinks = (m: Merchant, withLabels = false) => {
    const cls = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-surface-container px-2.5 py-2 text-on-surface shadow-sm transition-all hover:bg-primary-container hover:text-on-primary min-h-[40px] min-w-[40px]'
    const lbl = 'text-[13px] font-semibold'
    return (
      <>
        <Link to={merchantPath(m.id)} title="Xem hồ sơ chi tiết" className={cls}><Icon name="visibility" className="text-[19px]" /><span className={withLabels ? lbl : 'hidden'}>Hồ sơ</span></Link>
        <Link to={contactsPath(m.code)} title="Lịch sử liên hệ" className={cls}><Icon name="call" className="text-[19px]" /><span className={withLabels ? lbl : 'hidden'}>Liên hệ</span></Link>
        <Link to={subscriptionPath(m.id)} title="Gói dịch vụ & hợp đồng" className={cls}><Icon name="workspace_premium" className="text-[19px]" /><span className={withLabels ? lbl : 'hidden'}>Gói</span></Link>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        title="Hồ sơ Merchant"
        subtitle="Quản lý toàn diện hợp đồng, thông tin chi nhánh và tiến độ onboard đối tác ẩm thực Giaodoan trên toàn quốc."
        actions={
          <>
            <button type="button" onClick={exportList} disabled={filtered.length === 0} className={btnSecondary}>
              <Icon name="download" className="text-[20px] text-primary" />
              <span>Xuất file Excel</span>
            </button>
            <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>
              <Icon name="add_circle" className="text-[22px]" />
              <span>Thêm Merchant mới</span>
            </button>
          </>
        }
      />

      {/* KPI bento */}
      <div className="grid grid-cols-2 gap-space-md xl:grid-cols-12">
        <KpiCard className="xl:col-span-2" label="Tổng số Merchant" value={formatNumber(total)} icon="storefront" tone="primary" progress={100}
          footer={<span className="flex items-center gap-1.5 text-[13px] text-tertiary sm:text-[14px]"><Icon name="trending_up" className="text-[17px]" /><b>+{growth}%</b><span className="ml-0.5 font-normal text-secondary">tháng trước</span></span>} />
        <KpiCard className="xl:col-span-2" label="Đang hoạt động" value={formatNumber(active)} icon="verified" tone="tertiary" progress={pct(active)}
          footer={<span className="rounded bg-tertiary-container/15 px-2 py-0.5 font-bold text-tertiary">{pct(active)}% tổng số</span>} />
        <KpiCard to={ROUTES.onboarding} className="xl:col-span-2" label="Đang Onboard" value={formatNumber(onboarding)} icon="pending_actions" tone="primary" progress={pct(onboarding)}
          footer={<span className="rounded bg-primary-fixed px-2 py-0.5 font-bold text-primary">{pct(onboarding)}% tổng số</span>} />
        <KpiCard to={ROUTES.subscriptions} className="xl:col-span-2" label="Sắp hết hạn HĐ" value={formatNumber(expiring)} icon="alarm" tone="error" valueClassName="text-error" progress={pct(expiring)}
          footer={<span className="flex items-center gap-1 text-error"><Icon name="priority_high" className="text-[17px]" /><b>{pct(expiring)}%</b><span className="ml-0.5 font-normal text-secondary">cần tái ký</span></span>} />

        {/* Donut */}
        <div className="col-span-2 flex flex-col items-center justify-between gap-5 rounded-xl bg-surface-container-lowest p-5 shadow-sm sm:flex-row xl:col-span-4">
          <div className="relative flex h-36 w-36 flex-shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle className="text-surface-container" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth="12" />
              {donut.filter((d) => d.len > 0).map((d) => (
                <circle key={d.s.value} className="transition-all duration-700" cx="50" cy="50" fill="transparent" r="40" stroke={d.s.hex}
                  strokeDasharray={`${d.len} 251.2`} strokeDashoffset={d.offset} strokeWidth="12" />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-headline-md text-[20px] font-bold leading-tight text-on-surface">{coverage}%</span>
              <span className="font-label-sm text-[12px] font-semibold leading-none text-secondary">Tỉ lệ phủ sóng</span>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
            {donut.map((d) => (
              <button key={d.s.value} type="button" onClick={() => { setStatus(d.s.value); setPage(1) }} title={`Lọc: ${d.s.label}`}
                className="flex min-h-[36px] items-center justify-between rounded px-1 text-left text-[14px] font-medium hover:bg-surface-container-low">
                <div className="flex items-center gap-2 truncate">
                  <span className={`h-3 w-3 flex-shrink-0 rounded-full ${d.s.dot}`} />
                  <span className="truncate text-secondary">{d.s.label}</span>
                </div>
                <span className="font-label-lg text-[14px] font-bold text-on-surface">{Math.round(d.share * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar: status pills + search */}
      <div className="flex flex-col items-stretch justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm 2xl:flex-row 2xl:items-center">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 2xl:pb-0">
          <button type="button" onClick={() => { setStatus('all'); setPage(1) }}
            className={`whitespace-nowrap rounded-lg px-4 py-2.5 font-label-lg text-[14px] transition-all ${pill(status === 'all')}`}>
            Tất cả <span className="ml-1 font-semibold opacity-95">({formatNumber(counts.all)})</span>
          </button>
          {MERCHANT_STATUSES.map((s) => (
            <button key={s.value} type="button" onClick={() => { setStatus(s.value); setPage(1) }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 font-label-lg text-[14px] transition-all ${pill(status === s.value)}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span>{s.label}</span>
              <span className={status === s.value ? 'font-medium' : 'font-medium text-secondary'}>({formatNumber(counts[s.value])})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-space-sm">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo mã, tên merchant, SĐT..." />
          <button type="button" onClick={() => setShowFilters((v) => !v)} title="Bộ lọc nâng cao" aria-label="Bộ lọc nâng cao"
            className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-secondary-container/40 px-3 py-2.5 font-label-lg text-[14px] font-semibold transition-all hover:bg-surface-container hover:text-on-surface sm:px-4 ${showFilters || region ? 'bg-surface-container text-on-surface' : 'bg-surface-container-low text-secondary'}`}>
            <Icon name="tune" className="text-[20px] text-primary" />
            <span className="hidden sm:inline">Bộ lọc</span>
          </button>
          <button type="button" onClick={reload} title="Làm mới danh sách" aria-label="Làm mới danh sách"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-secondary-container/40 bg-surface-container-low p-2.5 text-secondary transition-all hover:bg-surface-container hover:text-on-surface">
            <Icon name="refresh" className="text-[20px]" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <span className="flex items-center gap-2 font-label-md text-[13px] font-semibold text-secondary"><Icon name="location_on" className="text-[20px] text-primary" /> Khu vực:</span>
          <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1) }} className={`${inputCls} sm:!w-60`}>
            <option value="">Toàn quốc</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {region && <button type="button" className="min-h-[40px] text-[13px] font-semibold text-primary hover:underline" onClick={() => setRegion('')}>Xóa lọc</button>}
        </div>
      )}

      {/* Bulk actions for the selected rows */}
      {selectedRows.length > 0 && (
        <div className="flex flex-col gap-space-sm rounded-xl bg-primary-fixed px-space-md py-space-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="font-label-lg text-[14px] font-bold text-primary">Đã chọn {selectedRows.length} merchant (đang hiển thị)</span>
          <div className="flex flex-wrap gap-space-sm">
            <button type="button" className={btnPrimary} onClick={() => setCampaign(true)}>
              <Icon name="campaign" className="text-[20px]" /> Tạo chiến dịch chăm sóc
            </button>
            <button type="button" className={btnSecondary}
              onClick={() => exportCsv('merchants-da-chon.csv', [
                { header: 'Mã Merchant', value: (m: Merchant) => m.code },
                { header: 'Tên Merchant', value: (m) => m.name },
                { header: 'Số điện thoại', value: (m) => m.phone },
                { header: 'Trạng thái', value: (m) => merchantStatus(m.status).label },
              ], selectedRows)}>
              <Icon name="download" className="text-[20px]" /> Xuất đã chọn
            </button>
            <button type="button" className={btnSecondary} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="p-6"><ErrorState message={error} onRetry={reload} /></div>
        ) : (
          <>
            <ResponsiveTable minWidth={960}
              cards={pageRows.map((m) => (
                <MobileCard key={m.id}
                  title={
                    <span className="flex items-center gap-2.5">
                      <input type="checkbox" className="h-5 w-5 flex-shrink-0 cursor-pointer rounded accent-primary" aria-label={`Chọn ${m.name}`} checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                      <Link to={merchantPath(m.id)} className="-my-2 truncate py-2 hover:text-primary hover:underline">{m.name}</Link>
                    </span>
                  }
                  subtitle={<><Link to={merchantPath(m.id)} className="font-bold text-primary">#{m.code}</Link>{m.category ? ` · ${m.category}` : ''}</>}
                  fields={[['Số điện thoại', m.phone], ['Khu vực', m.region ?? '—'], ['Địa chỉ', m.address]]}
                  actions={<>{statusSelect(m)}{quickLinks(m, true)}</>}
                />
              ))}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-primary-container font-headline-md text-[15px] uppercase tracking-wider text-on-primary">
                    <th scope="col" className="w-12 px-4 py-4 text-center">
                      <input type="checkbox" className="h-4 w-4 cursor-pointer rounded accent-primary" aria-label="Chọn tất cả trên trang" checked={allOnPageSelected} onChange={toggleAll} />
                    </th>
                    <th scope="col" className="w-28 px-3 py-4 text-left font-bold">Mã MC</th>
                    <th scope="col" className="px-4 py-4 text-left font-bold">Tên Merchant</th>
                    <th scope="col" className="w-40 px-3 py-4 text-left font-bold">Số điện thoại</th>
                    <th scope="col" className="px-4 py-4 text-left font-bold">Địa chỉ quán</th>
                    <th scope="col" className="w-48 px-4 py-4 text-center font-bold">Trạng thái</th>
                    <th scope="col" className="w-36 px-4 py-4 text-center font-bold">Hồ sơ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-container/30 font-body-lg text-[15px] text-on-surface">
                  {pageRows.map((m) => (
                    <tr key={m.id} className="group transition-colors hover:bg-surface-container-low/70">
                      <td className="px-4 py-3.5 text-center">
                        <input type="checkbox" className="h-4 w-4 cursor-pointer rounded accent-primary" aria-label={`Chọn ${m.name}`} checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                      </td>
                      <td className="px-3 py-3.5">
                        <Link to={merchantPath(m.id)} className="font-label-lg text-[15px] font-bold tracking-tight text-primary hover:underline">#{m.code}</Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link to={merchantPath(m.id)} className="flex w-full max-w-[230px] items-center gap-3 text-left">
                          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-surface-container shadow-sm ring-2 ring-primary/20">
                            {m.image_url ? (
                              <img className="h-full w-full object-cover" alt={m.name} src={m.image_url} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[22px]">{m.emoji ?? <Icon name={m.icon ?? 'storefront'} className="text-[22px] text-primary" />}</div>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-label-lg text-[16px] font-bold text-on-surface transition-colors group-hover:text-primary">{m.name}</span>
                            <span className="truncate text-[13px] font-normal text-secondary">{m.category}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-label-lg text-[15px] font-medium text-on-surface">{m.phone}</td>
                      <td className="px-4 py-3.5 text-secondary">
                        <div className="flex max-w-[170px] items-center gap-2" title={m.address_full ?? m.address}>
                          <Icon name="pin_drop" className="flex-shrink-0 text-[18px] text-primary" />
                          <span className="truncate text-[14px] font-medium text-on-surface">{m.address}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">{statusSelect(m)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">{quickLinks(m)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
            {filtered.length === 0 && <EmptyState message="Không tìm thấy merchant nào phù hợp." />}
            <Pagination page={curPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} label="Merchant" />
          </>
        )}
      </div>

      <AddMerchantModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(name) => { setAdding(false); toast(`Đã thêm merchant ${name}`); reload() }}
      />
      <CampaignModal
        open={campaign}
        merchants={selectedRows}
        tag="Chiến dịch chăm sóc"
        contentPlaceholder="Ví dụ: Gửi lời chúc và nhắc cập nhật menu mùa Tết."
        onClose={() => setCampaign(false)}
        onDone={(n) => { setCampaign(false); setSelected(new Set()); toast(REMIND_TOAST(n)); navigate(ROUTES.contacts) }}
      />
    </div>
  )
}

function AddMerchantModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const empty = { name: '', phone: '', address: '', category: '', region: '', contact_name: '', email: '', status: 'new' as MerchantStatus }
  const [f, setF] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof empty, v: string) => setF((cur) => ({ ...cur, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    // `code` (MC-xxxx) is generated by the database sequence
    const { error } = await supabase.from('merchants').insert({
      name: f.name.trim(),
      phone: f.phone.trim(),
      address: f.address.trim(),
      address_full: f.address.trim(),
      category: f.category.trim() || null,
      region: f.region.trim() || null,
      contact_name: f.contact_name.trim() || null,
      email: f.email.trim() || null,
      status: f.status,
    })
    setSaving(false)
    if (error) return setErr(error.message)
    const name = f.name.trim()
    setF(empty)
    onCreated(name)
  }

  return (
    <Modal open={open} title="Thêm Merchant mới" onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="add-merchant-form" className={btnPrimary} disabled={saving}>
            <Icon name="add_circle" className="text-[20px]" />
            {saving ? 'Đang lưu...' : 'Tạo Merchant'}
          </button>
        </>
      }>
      <form id="add-merchant-form" onSubmit={submit} className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="Tên Merchant" required className="sm:col-span-2">
          <input required className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ví dụ: Whisper Coffee & Lounge" />
        </Field>
        <Field label="Số điện thoại" required>
          <input required className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+84 935 413 191" />
        </Field>
        <Field label="Phân loại">
          <input className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Cà phê & Đồ uống" />
        </Field>
        <Field label="Địa chỉ quán" required className="sm:col-span-2">
          <input required className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="140/11 Hải Phòng, Hải Châu, Đà Nẵng" />
        </Field>
        <Field label="Khu vực (Tỉnh / Thành phố)">
          <input list="region-options" className={inputCls} value={f.region} onChange={(e) => set('region', e.target.value)} placeholder="Đà Nẵng" />
          <datalist id="region-options">{REGIONS.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Trạng thái">
          <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {MERCHANT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Người liên hệ">
          <input className={inputCls} value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        {err && <p className="rounded-lg bg-error-container sm:col-span-2 px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
      </form>
    </Modal>
  )
}
