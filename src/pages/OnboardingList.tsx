import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Field, FormGrid, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { ONBOARDING_STEPS } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { daysUntil, formatDate, formatNumber, hashCode, initials } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { ROUTES, merchantPath, onboardingPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { Merchant, Onboarding, Staff } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'
import { useRowSelection } from '../lib/useRowSelection'
import { REMIND_TOAST } from '../lib/contactLog'
import { STEP_TEMPLATES, applyProgress } from './onboarding/progress'
import { logReminders } from './onboarding/remind'

type MerchantLite = Pick<Merchant, 'id' | 'code' | 'name' | 'phone' | 'address' | 'region' | 'district' | 'image_url' | 'emoji' | 'icon' | 'status'>
type Row = Onboarding & { merchant: MerchantLite | null; assignee: Pick<Staff, 'id' | 'full_name' | 'role_label'> | null }

// Step-chip colours (written out in full so Tailwind can see them). Index = steps_done (0..5).
const CHIP = [
  { cls: 'bg-surface-container text-secondary', icon: 'hourglass_empty', iconCls: 'text-secondary', label: 'Chưa bắt đầu' },
  { cls: 'bg-surface-container-high text-on-surface', icon: 'badge', iconCls: 'text-secondary', label: ONBOARDING_STEPS[0].doneLabel },
  { cls: 'bg-secondary-fixed text-on-secondary-fixed', icon: 'store', iconCls: 'text-on-secondary-fixed', label: ONBOARDING_STEPS[1].doneLabel },
  { cls: 'bg-primary-fixed/60 text-on-primary-fixed-variant', icon: 'restaurant_menu', iconCls: 'text-primary', label: ONBOARDING_STEPS[2].doneLabel },
  { cls: 'bg-surface-variant text-on-surface-variant', icon: 'sell', iconCls: 'text-primary', label: ONBOARDING_STEPS[3].doneLabel },
  { cls: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', icon: 'check_circle', iconCls: 'text-tertiary', label: ONBOARDING_STEPS[4].doneLabel },
]

const filterBox =
  'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-2.5 font-label-lg text-label-lg text-on-surface transition-colors hover:bg-surface-container sm:w-auto'
const pillCls = (on: boolean) =>
  `min-h-10 flex-shrink-0 whitespace-nowrap rounded-full px-space-md py-1.5 font-label-lg text-label-lg transition-colors ${on ? 'bg-primary-container text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`
const actionLink =
  'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-container-low px-space-md py-1.5 font-label-lg text-label-lg text-primary shadow-sm transition-all hover:bg-surface-container'

export default function OnboardingList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { settings } = useSettings()
  const PAGE_SIZE = settings.pageSize

  const { data, loading, error, reload, setData } = useQuery<Row[]>(
    () =>
      supabase
        .from('onboardings')
        .select('*, merchant:merchants(id,code,name,phone,address,region,district,image_url,emoji,icon,status), assignee:staff(id,full_name,role_label)')
        .order('started_at', { ascending: false }),
    [],
  )
  const merchantsQ = useQuery<MerchantLite[]>(
    () => supabase.from('merchants').select('id,code,name,phone,address,region,district,image_url,emoji,icon,status').order('code', { ascending: false }),
    [],
  )
  const staffQ = useQuery<Staff[]>(() => supabase.from('staff').select('*').order('code'), [])

  const [q, setQ] = useState('')
  const [step, setStep] = useState<number | null>(null) // null = all, 1..5 = steps_done
  const [region, setRegion] = useState('')
  const [staffId, setStaffId] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [reminding, setReminding] = useState(false)
  useNewParam(() => setAdding(true))

  const rows = useMemo(() => data ?? [], [data])

  const regions = useMemo(() => [...new Set(rows.map((r) => r.merchant?.region).filter((x): x is string => !!x))].sort(), [rows])
  const assignees = useMemo(() => {
    const m = new Map<string, string>()
    rows.forEach((r) => r.assignee && m.set(r.assignee.id, r.assignee.full_name))
    return [...m.entries()]
  }, [rows])

  const stepCounts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0]
    rows.forEach((r) => { c[Math.min(5, Math.max(0, r.steps_done))]++ })
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return rows.filter((r) => {
      if (step !== null && r.steps_done !== step) return false
      if (region && r.merchant?.region !== region) return false
      if (staffId && r.assignee_id !== staffId) return false
      if (!needle) return true
      return [r.merchant?.code, r.merchant?.name, r.merchant?.phone, r.merchant?.address, r.owner_label, r.assignee?.full_name].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [rows, q, step, region, staffId])

  const { selected, setSelected, selectedRows } = useRowSelection(filtered)

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  // KPIs (computed from data)
  const total = rows.length
  const inProgress = rows.filter((r) => r.steps_done < 5).length
  const newThisWeek = rows.filter((r) => r.started_at && Date.now() - new Date(r.started_at).getTime() < 7 * 86400000).length
  const avgPct = total ? Math.round((rows.reduce((s, r) => s + r.steps_done, 0) / (total * 5)) * 100) : 0
  const allMerchants = merchantsQ.data ?? []
  const activeCount = allMerchants.filter((m) => m.status === 'active').length
  const stoppedCount = allMerchants.filter((m) => m.status === 'stopped').length
  const successRate = activeCount + stoppedCount ? Math.round((activeCount / (activeCount + stoppedCount)) * 1000) / 10 : 0

  async function changeStep(r: Row, next: number) {
    const prev = r.steps_done
    if (next === prev) return
    setData((cur) => (cur ?? []).map((x) => (x.id === r.id ? { ...x, steps_done: next } : x)))
    const err = await applyProgress(r.id, next, r.assignee?.full_name ?? null)
    if (err) {
      setData((cur) => (cur ?? []).map((x) => (x.id === r.id ? { ...x, steps_done: prev } : x)))
      toast(`Không cập nhật được tiến độ: ${err}`)
    } else {
      toast(`Đã cập nhật ${r.merchant?.name ?? 'merchant'} → ${CHIP[next].label}`)
    }
  }

  async function remindSelected() {
    if (selectedRows.length === 0 || reminding) return
    setReminding(true)
    const err = await logReminders(
      selectedRows.map((r) => ({
        merchantId: r.merchant_id,
        contactPerson: r.owner_label,
        content: `Nhắc nhở merchant hoàn thành onboarding (hiện tại: ${CHIP[Math.min(5, Math.max(0, r.steps_done))].label}, ${r.steps_done}/5 bước).`,
      })),
      settings.name,
    )
    setReminding(false)
    if (err) return toast(`Không ghi nhận được nhắc nhở: ${err}`)
    toast(REMIND_TOAST(selectedRows.length))
    setSelected(new Set())
  }

  function exportList() {
    exportCsv(
      'tien-do-onboarding.csv',
      [
        { header: 'Mã Merchant', value: (r: Row) => r.merchant?.code },
        { header: 'Tên Merchant', value: (r) => r.merchant?.name },
        { header: 'Địa chỉ', value: (r) => r.merchant?.address },
        { header: 'Khu vực', value: (r) => [r.merchant?.region, r.merchant?.district].filter(Boolean).join(' • ') },
        { header: 'Số điện thoại', value: (r) => r.merchant?.phone },
        { header: 'Người liên hệ', value: (r) => r.owner_label },
        { header: 'Tiến độ onboard', value: (r) => CHIP[r.steps_done].label },
        { header: 'Hoàn thành (%)', value: (r) => r.steps_done * 20 },
        { header: 'Nhân sự phụ trách', value: (r) => r.assignee?.full_name },
        { header: 'Hạn Go-Live', value: (r) => formatDate(r.go_live_date) },
      ],
      selectedRows.length > 0 ? selectedRows : filtered,
    )
  }

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
  const toggleAll = () =>
    setSelected((cur) => {
      const n = new Set(cur)
      pageRows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)))
      return n
    })

  const clearFilters = () => { setQ(''); setStep(null); setRegion(''); setStaffId(''); setPage(1); reload() }

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        title="Tiến độ Onboarding Đối Tác"
        subtitle="Theo dõi, giám sát và cập nhật quy trình đưa các nhà hàng, quán ăn lên hệ sinh thái Giaodoan theo từng giai đoạn."
        actions={
          <>
            <button type="button" onClick={exportList} disabled={filtered.length === 0} className={`${btnSecondary} max-sm:min-w-[45%]`}>
              <Icon name="download" className="text-[20px] text-primary" />
              <span>{selectedRows.length > 0 ? `Xuất Excel (${selectedRows.length} đã chọn)` : 'Xuất Excel'}</span>
            </button>
            <button type="button" onClick={() => setAdding(true)} className={`${btnPrimary} max-sm:min-w-[45%]`}>
              <Icon name="add_circle" className="text-[22px]" />
              <span>Thêm Onboarding</span>
            </button>
          </>
        }
      />

      {/* KPIs + pipeline */}
      <div className="grid grid-cols-2 gap-space-md xl:grid-cols-12 xl:gap-space-lg">
        <div className="col-span-1 flex min-w-0 flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg xl:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate rounded-full bg-primary-fixed px-space-sm py-1 font-label-md text-[11px] uppercase tracking-wider text-on-primary-fixed-variant sm:px-space-md sm:text-label-md">Đang Onboard</span>
            <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-primary sm:flex"><Icon name="pending_actions" className="text-[24px]" /></div>
          </div>
          <div className="mt-space-md flex flex-col">
            <span className="font-headline-xl text-[28px] font-bold leading-tight text-on-surface sm:text-[38px]">{formatNumber(inProgress)} <span className="text-[14px] font-normal text-secondary sm:text-headline-md">Đối tác</span></span>
            <div className="mt-space-xs flex items-center gap-space-xs font-label-lg text-[13px] text-primary sm:text-label-lg">
              <Icon name="trending_up" className="text-[18px]" />
              <span>+{newThisWeek} merchant trong tuần này</span>
            </div>
          </div>
          <div className="mt-space-md rounded-lg bg-surface-container-low p-space-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2 font-label-md text-[12px] sm:text-label-md">
              <span className="text-secondary">Hoàn thành trung bình</span>
              <span className="font-bold text-primary">{avgPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary-container" style={{ width: `${avgPct}%` }} />
            </div>
          </div>
        </div>

        <div className="col-span-1 flex min-w-0 flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg xl:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate rounded-full bg-tertiary-fixed px-space-sm py-1 font-label-md text-[11px] uppercase tracking-wider text-on-tertiary-fixed-variant sm:px-space-md sm:text-label-md">Đã Onboard</span>
            <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-tertiary-fixed/40 text-tertiary sm:flex"><Icon name="verified" className="text-[24px]" /></div>
          </div>
          <div className="mt-space-md flex flex-col">
            <span className="font-headline-xl text-[28px] font-bold leading-tight text-on-surface sm:text-[38px]">{formatNumber(activeCount)} <span className="text-[14px] font-normal text-secondary sm:text-headline-md">Đối tác</span></span>
            <Link to={ROUTES.merchants} className="mt-space-xs flex items-center gap-space-xs font-label-lg text-[13px] text-tertiary hover:underline sm:text-label-lg">
              <Icon name="check_circle" className="text-[18px]" />
              <span>Đã Go-Live mở bán</span>
            </Link>
          </div>
          <div className="mt-space-md rounded-lg bg-surface-container-low p-space-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2 font-label-md text-[12px] sm:text-label-md">
              <span className="text-secondary">Tỉ lệ kích hoạt</span>
              <span className="font-bold text-tertiary">{successRate}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-tertiary-container" style={{ width: `${successRate}%` }} />
            </div>
          </div>
        </div>

        <div className="col-span-2 flex min-w-0 flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-space-xs">
            <div className="flex items-center gap-space-sm">
              <Icon name="route" className="text-[22px] text-primary" />
              <h2 className="font-headline-md text-headline-md text-on-surface">Quy trình Onboarding 5 Bước</h2>
            </div>
            <span className="rounded-full bg-surface-container-low px-space-sm py-1 font-label-sm text-label-sm text-secondary">Chuẩn vận hành F&amp;B 2025</span>
          </div>
          <div className="mt-space-sm flex gap-space-sm overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
            {ONBOARDING_STEPS.map((s) => {
              const on = step === s.no
              const last = s.no === 5
              return (
                <button key={s.no} type="button" onClick={() => { setStep(on ? null : s.no); setPage(1) }}
                  className={`group relative flex w-40 flex-shrink-0 flex-col rounded-lg p-space-sm text-left transition-all md:w-auto ${
                    on ? 'bg-primary-fixed/50 hover:bg-primary-fixed/70' : last ? 'bg-tertiary-fixed/30 hover:bg-tertiary-fixed/50' : 'bg-surface-container-low hover:bg-surface-container'}`}>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${on ? 'bg-primary-container text-on-primary shadow-sm' : last ? 'bg-tertiary-container text-on-tertiary' : 'bg-surface-container-highest text-primary'}`}>
                      <Icon name={s.icon} className="text-[18px]" />
                    </div>
                    <span className={`font-headline-md text-headline-md font-bold ${on ? 'text-on-primary-container' : last ? 'text-tertiary' : 'text-on-surface'}`}>{stepCounts[s.no]}</span>
                  </div>
                  <span className={`mt-2 truncate font-label-md text-label-md font-semibold ${on ? 'text-on-primary-container' : last ? 'text-tertiary' : 'text-on-surface'}`}>{s.no}. {s.title}</span>
                  <span className={`mt-0.5 line-clamp-2 font-body-sm text-[11px] leading-snug ${on ? 'text-on-surface-variant' : last ? 'text-on-tertiary-container' : 'text-secondary'}`}>{s.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
        <div className="flex flex-col gap-space-sm lg:flex-row lg:items-center lg:justify-between lg:gap-space-lg">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo mã Merchant, tên quán, SĐT..." className="lg:max-w-xl lg:!w-auto" />
          <div className="flex flex-col gap-space-sm sm:flex-row sm:flex-wrap sm:items-center">
            <label className={filterBox}>
              <Icon name="location_on" className="text-[20px] text-secondary" />
              <span>Khu vực:</span>
              <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1) }} className="min-w-0 flex-1 cursor-pointer bg-transparent font-semibold outline-none">
                <option value="">Tất cả</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className={filterBox}>
              <Icon name="account_box" className="text-[20px] text-secondary" />
              <span>Chuyên viên:</span>
              <select value={staffId} onChange={(e) => { setStaffId(e.target.value); setPage(1) }} className="min-w-0 flex-1 cursor-pointer bg-transparent font-semibold outline-none">
                <option value="">Toàn bộ nhân sự</option>
                {assignees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <button type="button" onClick={clearFilters} title="Làm mới bộ lọc"
              className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-surface-container-low px-3 py-2.5 text-secondary transition-all hover:bg-surface-container hover:text-on-surface">
              <Icon name="refresh" className="text-[20px]" />
              <span className="font-label-lg text-label-lg sm:hidden">Làm mới bộ lọc</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1">
          <span className="mr-2 flex-shrink-0 font-label-md text-label-md text-secondary">Trạng thái:</span>
          <button type="button" onClick={() => { setStep(null); setPage(1) }} className={pillCls(step === null)}>
            Tất cả ({formatNumber(total)})
          </button>
          {ONBOARDING_STEPS.map((s) => (
            <button key={s.no} type="button" onClick={() => { setStep(s.no); setPage(1) }} className={pillCls(step === s.no)}>
              {s.doneLabel} ({stepCounts[s.no]})
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar (selected rows) */}
      {selectedRows.length > 0 && (
        <div className="flex flex-col gap-space-sm rounded-xl bg-primary-fixed/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-label-lg text-label-lg font-semibold text-on-surface">Đã chọn {selectedRows.length} merchant (đang hiển thị)</span>
          <div className="flex flex-wrap gap-space-sm max-sm:[&>*]:flex-1">
            <button type="button" onClick={remindSelected} disabled={reminding} className={btnPrimary}>
              <Icon name="send_to_mobile" className="text-[20px]" />
              <span>{reminding ? 'Đang ghi nhận...' : 'Ghi nhận nhắc Zalo/SMS'}</span>
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className={btnSecondary}>Bỏ chọn</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex flex-col gap-3 md:gap-0 md:overflow-hidden md:rounded-xl md:bg-surface-container-lowest md:shadow-sm">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="rounded-xl bg-surface-container-lowest p-6"><ErrorState message={error} onRetry={reload} /></div>
        ) : (
          <>
            <ResponsiveTable
              minWidth={1020}
              cards={
                pageRows.map((r) => {
                    const m = r.merchant
                    const chip = CHIP[Math.min(5, Math.max(0, r.steps_done))]
                    const left = daysUntil(r.go_live_date)
                    const done = r.steps_done >= 5
                    return (
                      <MobileCard
                        key={r.id}
                        title={m ? <Link to={merchantPath(m.id)}>{m.name}</Link> : '—'}
                        subtitle={[hashCode(m?.code), m?.region].filter(Boolean).join(' • ')}
                        badge={<StatusBadge tone={done ? 'success' : 'primary'}>{r.steps_done}/5</StatusBadge>}
                        fields={[
                          ['Tiến độ', chip.label],
                          ['Go-Live', done ? 'Sẵn sàng mở bán' : `${formatDate(r.go_live_date)}${left === 0 ? ' (Hôm nay)' : left !== null && left < 0 ? ' (Quá hạn)' : ''}`],
                          ['SĐT', m?.phone ? <a href={`tel:${m.phone.replace(/\s/g, '')}`} className="text-primary">{m.phone}</a> : '—'],
                          ['Chuyên viên', r.assignee?.full_name ?? 'Chưa phân công'],
                        ]}
                        actions={
                          <>
                            <Link to={onboardingPath(r.merchant_id)} className={`${actionLink} flex-1`}><Icon name="fact_check" className="text-[18px]" />Chi tiết tiến độ</Link>
                            {m && <Link to={merchantPath(m.id)} className={`${actionLink} flex-1`}><Icon name="visibility" className="text-[18px]" />Xem hồ sơ</Link>}
                            <select value={r.steps_done} onChange={(e) => changeStep(r, Number(e.target.value))} aria-label="Đổi giai đoạn onboard"
                              className={`min-h-10 w-full cursor-pointer rounded-lg px-3 py-1.5 font-label-lg text-label-lg font-bold shadow-sm focus:outline-none ${chip.cls}`}>
                              {CHIP.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
                            </select>
                          </>
                        }
                      />
                    )
                })
              }
            >
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="h-14 bg-primary-container font-headline-md text-headline-md text-on-primary">
                    <th className="w-14 pl-space-lg pr-2 text-center">
                      <input type="checkbox" aria-label="Chọn tất cả trên trang" className="h-4 w-4 cursor-pointer rounded accent-primary" checked={allOnPage} onChange={toggleAll} />
                    </th>
                    <th className="whitespace-nowrap px-space-md py-space-md font-bold tracking-tight">MÃ MERCHANT</th>
                    <th className="min-w-[240px] px-space-md py-space-md font-bold tracking-tight">TÊN MERCHANT &amp; ĐỊA CHỈ</th>
                    <th className="min-w-[170px] px-space-md py-space-md font-bold tracking-tight">SỐ ĐIỆN THOẠI</th>
                    <th className="whitespace-nowrap px-space-md py-space-md text-center font-bold tracking-tight">CHI TIẾT</th>
                    <th className="min-w-[220px] px-space-md py-space-md font-bold tracking-tight">TIẾN ĐỘ ONBOARD</th>
                    <th className="min-w-[200px] whitespace-nowrap px-space-md py-space-md pr-space-lg font-bold tracking-tight">NHÂN SỰ &amp; HẠN GO-LIVE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low font-body-lg text-body-lg text-on-surface">
                  {pageRows.map((r) => {
                    const m = r.merchant
                    const chip = CHIP[Math.min(5, Math.max(0, r.steps_done))]
                    const left = daysUntil(r.go_live_date)
                    const done = r.steps_done >= 5
                    const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
                    return (
                      <tr key={r.id} className="group h-16 cursor-pointer transition-colors hover:bg-primary-fixed/20" onClick={() => navigate(onboardingPath(r.merchant_id))}>
                        <td className="pl-space-lg pr-2 text-center" onClick={stop}>
                          <input type="checkbox" aria-label="Chọn merchant" className="h-4 w-4 cursor-pointer rounded accent-primary" checked={selected.has(r.id)}
                            onChange={() => setSelected((cur) => { const n = new Set(cur); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })} />
                        </td>
                        <td className="whitespace-nowrap px-space-md py-space-md">
                          {m ? (
                            <Link to={merchantPath(m.id)} onClick={stop} className="font-headline-md text-headline-md font-bold text-primary hover:underline">{hashCode(m.code)}</Link>
                          ) : <span>—</span>}
                          <span className="block font-label-sm text-label-sm text-secondary">{[m?.region, m?.district].filter(Boolean).join(' • ')}</span>
                        </td>
                        <td className="px-space-md py-space-md">
                          <div className="flex items-center gap-space-md">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container shadow-sm">
                              {m?.image_url ? <img className="h-full w-full object-cover" alt={m.name} src={m.image_url} /> : <span className="text-[22px]">{m?.emoji ?? <Icon name={m?.icon ?? 'storefront'} className="text-[22px] text-primary" />}</span>}
                            </div>
                            <div className="flex min-w-0 flex-col">
                              {m ? (
                                <Link to={merchantPath(m.id)} onClick={stop} className="truncate font-headline-md text-headline-md font-bold text-on-surface transition-colors hover:text-primary hover:underline">{m.name}</Link>
                              ) : <span>—</span>}
                              <span className="truncate font-body-sm text-body-sm text-secondary">{m?.address}</span>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-space-md py-space-md">
                          <div className="flex items-center gap-space-xs font-semibold">
                            <Icon name="call" className="text-[18px] text-tertiary" />
                            {m?.phone ? <a href={`tel:${m.phone.replace(/\s/g, '')}`} onClick={stop} className="hover:text-primary hover:underline">{m.phone}</a> : <span>—</span>}
                          </div>
                          <span className="block font-label-sm text-label-sm text-secondary">{r.owner_label}</span>
                        </td>
                        <td className="px-space-md py-space-md text-center" onClick={stop}>
                          <div className="inline-flex gap-2">
                            <Link to={onboardingPath(r.merchant_id)} title="Chi tiết tiến độ onboarding" className={`${actionLink} !px-3`}>
                              <Icon name="fact_check" className="text-[18px]" />
                              <span>Tiến độ</span>
                            </Link>
                          </div>
                        </td>
                        <td className="px-space-md py-space-md" onClick={stop}>
                          <div className="relative inline-block w-full max-w-[210px]">
                            <Icon name={chip.icon} className={`pointer-events-none absolute left-space-md top-1/2 -translate-y-1/2 text-[18px] ${chip.iconCls}`} />
                            <select value={r.steps_done} onChange={(e) => changeStep(r, Number(e.target.value))} title="Đổi giai đoạn onboard"
                              className={`w-full cursor-pointer appearance-none truncate rounded-lg py-1.5 pl-10 pr-8 font-label-lg text-label-lg font-bold shadow-sm focus:outline-none ${chip.cls}`}>
                              {CHIP.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
                            </select>
                            <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[18px]" />
                          </div>
                        </td>
                        <td className="px-space-md py-space-md pr-space-lg">
                          <div className="flex items-center gap-space-sm">
                            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${done ? 'bg-tertiary-fixed text-tertiary' : 'bg-secondary-container text-on-secondary-container'}`}>
                              {r.assignee ? initials(r.assignee.full_name) : '?'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-label-lg text-label-lg font-bold text-on-surface">{r.assignee?.full_name ?? 'Chưa phân công'}</span>
                              {done ? (
                                <span className="flex items-center gap-1 font-body-sm text-body-sm font-semibold text-tertiary"><Icon name="done_all" className="text-[14px]" /> Sẵn sàng mở bán</span>
                              ) : (
                                <span className={`flex items-center gap-1 font-body-sm text-body-sm ${left === 0 ? 'text-primary' : left !== null && left < 0 ? 'text-error' : 'text-secondary'}`}>
                                  <Icon name="event" className="text-[14px]" /> {formatDate(r.go_live_date)}{left === 0 ? ' (Hôm nay)' : left !== null && left < 0 ? ' (Quá hạn)' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ResponsiveTable>
            {filtered.length === 0 && <div className="max-md:rounded-xl max-md:bg-surface-container-lowest max-md:shadow-sm"><EmptyState message="Không tìm thấy merchant onboarding nào phù hợp." /></div>}
            <div className="overflow-hidden max-md:rounded-xl max-md:shadow-sm"><Pagination page={curPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} label="Merchant đang onboard" /></div>
          </>
        )}
      </div>

      <AddOnboardingModal
        open={adding}
        onClose={() => setAdding(false)}
        candidates={allMerchants.filter((m) => !rows.some((r) => r.merchant_id === m.id))}
        staff={staffQ.data ?? []}
        onCreated={(m) => { setAdding(false); toast(`Đã thêm ${m.name} vào quy trình onboarding`); reload(); merchantsQ.reload(); navigate(onboardingPath(m.id)) }}
      />
    </div>
  )
}

function AddOnboardingModal({ open, onClose, candidates, staff, onCreated }: {
  open: boolean; onClose: () => void; candidates: MerchantLite[]; staff: Staff[]; onCreated: (m: MerchantLite) => void
}) {
  const toast = useToast()
  const empty = { merchant_id: '', assignee_id: '', owner_label: '', go_live_date: '' }
  const [f, setF] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof empty, v: string) => setF((cur) => ({ ...cur, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const m = candidates.find((c) => c.id === f.merchant_id)
    if (!m) return setErr('Vui lòng chọn Merchant.')
    setSaving(true)
    setErr(null)
    const { data: ob, error } = await supabase
      .from('onboardings')
      .insert({
        merchant_id: m.id,
        assignee_id: f.assignee_id || null,
        owner_label: f.owner_label.trim() || null,
        go_live_date: f.go_live_date || null,
        steps_done: 0,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error || !ob) {
      setSaving(false)
      return setErr(error?.message ?? 'Không tạo được onboarding.')
    }
    const { error: e2 } = await supabase.from('onboarding_steps').insert(
      STEP_TEMPLATES.map((t, i) => ({ onboarding_id: ob.id, step_no: i + 1, title: t.title, description: t.description, status: i === 0 ? 'in_progress' : 'pending' })),
    )
    if (e2) {
      await supabase.from('onboardings').delete().eq('id', ob.id)
      setSaving(false)
      return setErr(e2.message)
    }
    let statusErr: string | null = null
    if (m.status === 'new' || m.status === 'consulted') {
      const { error: e3 } = await supabase.from('merchants').update({ status: 'onboarding' }).eq('id', m.id)
      statusErr = e3?.message ?? null
    }
    setSaving(false)
    setF(empty)
    onCreated(m)
    if (statusErr) toast(`Không cập nhật được trạng thái Merchant: ${statusErr}`)
  }

  return (
    <Modal open={open} title="Thêm Merchant Onboarding" onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="add-onboarding-form" className={btnPrimary} disabled={saving || candidates.length === 0}>
            <Icon name="add_circle" className="text-[20px]" />{saving ? 'Đang lưu...' : 'Bắt đầu onboarding'}
          </button>
        </>
      }>
      <form id="add-onboarding-form" onSubmit={submit}>
        <FormGrid>
        <Field label="Merchant" required className="sm:col-span-2">
          <select required className={inputCls} value={f.merchant_id} onChange={(e) => set('merchant_id', e.target.value)}>
            <option value="">{candidates.length ? '-- Chọn Merchant --' : 'Tất cả merchant đã có hồ sơ onboarding'}</option>
            {candidates.map((m) => <option key={m.id} value={m.id}>{hashCode(m.code)} - {m.name}</option>)}
          </select>
        </Field>
        <Field label="Chuyên viên phụ trách">
          <select className={inputCls} value={f.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
            <option value="">Chưa phân công</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <Field label="Hạn Go-Live">
          <input type="date" className={inputCls} value={f.go_live_date} onChange={(e) => set('go_live_date', e.target.value)} />
        </Field>
        <Field label="Người liên hệ / Chủ sở hữu" className="sm:col-span-2">
          <input className={inputCls} value={f.owner_label} onChange={(e) => set('owner_label', e.target.value)} placeholder="Chủ sở hữu: Lê Văn Nam" />
        </Field>
        <p className="text-[13px] text-secondary sm:col-span-2">Hệ thống sẽ tạo sẵn checklist 5 bước chuẩn; bước 1 ở trạng thái "Đang xử lý".</p>
        {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container sm:col-span-2">{err}</p>}
        </FormGrid>
      </form>
    </Modal>
  )
}
