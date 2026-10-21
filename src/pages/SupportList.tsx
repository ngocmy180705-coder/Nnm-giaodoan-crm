import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Field, FormGrid, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { TICKET_CATEGORIES, TICKET_GROUPS, TICKET_PRIORITIES } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { formatDateTime, formatNumber, hashCode } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { merchantPath, supportPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { Staff, TicketCategory, TicketStatus } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'
import { useRowSelection } from '../lib/useRowSelection'
import { CATEGORY_DOT, MERCHANT_LITE_COLS, MerchantAvatar, SLA_HOURS, isOverdue, slaInfo, type MerchantLite, type TicketRow } from './support/ticketUi'

type Group = 'all' | 'unanswered' | 'answered' | 'waiting'

const selectWrap = 'relative'
const actionBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-surface-container px-3 py-1.5 font-label-md text-label-md font-semibold transition-colors hover:bg-surface-container-high'
const selectCls =
  'w-full cursor-pointer appearance-none rounded-xl bg-surface-container-low py-2.5 pl-10 pr-9 font-body-lg text-body-lg text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary-container'

export default function SupportList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { settings } = useSettings()
  const PAGE_SIZE = settings.pageSize
  const [params] = useSearchParams()
  const { data, loading, error, reload, setData } = useQuery<TicketRow[]>(
    () =>
      supabase
        .from('support_tickets')
        .select(`*, merchant:merchants(${MERCHANT_LITE_COLS})`)
        .order('created_at', { ascending: false }),
    [],
  )

  const [group, setGroup] = useState<Group>('all')
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  useNewParam(() => setAdding(true))

  const tickets = useMemo(() => data ?? [], [data])

  const counts = useMemo(() => {
    const inGroup = (g: TicketStatus[]) => tickets.filter((t) => g.includes(t.status)).length
    return {
      all: tickets.length,
      unanswered: inGroup(TICKET_GROUPS.unanswered),
      answered: inGroup(TICKET_GROUPS.answered),
      waiting: inGroup(TICKET_GROUPS.waiting),
    }
  }, [tickets])

  const regions = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.merchant?.region).filter((r): r is string => !!r))).sort((a, b) => a.localeCompare(b, 'vi')),
    [tickets],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return tickets.filter((t) => {
      if (group !== 'all' && !TICKET_GROUPS[group].includes(t.status)) return false
      if (category && t.category !== category) return false
      if (region && t.merchant?.region !== region) return false
      if (!needle) return true
      return [t.code, t.merchant?.code, t.merchant?.name, t.merchant?.phone, t.subject, t.branch_label].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [tickets, group, category, region, q])

  const { selected, setSelected, selectedRows } = useRowSelection(filtered)

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  // KPI numbers (all computed from the fetched rows)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const newToday = tickets.filter((t) => new Date(t.created_at).getTime() >= startOfToday.getTime()).length
  const completion = tickets.length ? Math.round((counts.answered / tickets.length) * 1000) / 10 : 0
  const overdue = tickets.filter(isOverdue).length
  const waitingNotes = Array.from(new Set(tickets.filter((t) => t.status === 'waiting_merchant' && t.status_note).map((t) => t.status_note as string)))

  async function changeCategory(t: TicketRow, next: TicketCategory) {
    const prev = t.category
    setData((cur) => (cur ?? []).map((x) => (x.id === t.id ? { ...x, category: next } : x)))
    const { error: err } = await supabase.from('support_tickets').update({ category: next, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (err) {
      setData((cur) => (cur ?? []).map((x) => (x.id === t.id ? { ...x, category: prev } : x)))
      toast(`Không cập nhật được loại YCHT: ${err.message}`)
    } else {
      toast(`Đã chuyển ${hashCode(t.code)} → ${TICKET_CATEGORIES[next].label}`)
    }
  }

  function exportList() {
    exportCsv(
      'yeu-cau-ho-tro.csv',
      [
        { header: 'Mã yêu cầu', value: (t: TicketRow) => t.code },
        { header: 'Mã Merchant', value: (t) => t.merchant?.code },
        { header: 'Tên Merchant', value: (t) => t.merchant?.name },
        { header: 'Chi nhánh', value: (t) => t.branch_label },
        { header: 'Loại YCHT', value: (t) => TICKET_CATEGORIES[t.category].long },
        { header: 'Tiêu đề', value: (t) => t.subject },
        { header: 'Mức độ ưu tiên', value: (t) => TICKET_PRIORITIES[t.priority] },
        { header: 'Trạng thái', value: (t) => (TICKET_GROUPS.answered.includes(t.status) ? 'Đã phản hồi' : t.status === 'waiting_merchant' ? 'Đợi Merchant bổ sung' : 'Chưa phản hồi') },
        { header: 'Ngày tạo', value: (t) => formatDateTime(t.created_at) },
        { header: 'Hạn xử lý (SLA)', value: (t) => (t.sla_due_at ? formatDateTime(t.sla_due_at) : '') },
      ],
      selectedRows.length > 0 ? selectedRows : filtered,
    )
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((t) => selected.has(t.id))
  function toggleAll() {
    setSelected((cur) => {
      const next = new Set(cur)
      if (allOnPageSelected) pageRows.forEach((t) => next.delete(t.id))
      else pageRows.forEach((t) => next.add(t.id))
      return next
    })
  }

  const pill = (g: Group, label: string, count: number, badgeCls: string) => (
    <button
      key={g}
      type="button"
      onClick={() => { setGroup(g); setPage(1) }}
      className={`flex min-h-10 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 font-label-lg text-label-lg transition-all ${
        group === g ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container-lowest'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm ${group === g ? 'bg-on-primary/20 text-on-primary' : badgeCls}`}>{formatNumber(count)}</span>
    </button>
  )

  const statusBadge = (t: TicketRow) => {
    if (isOverdue(t)) return <StatusBadge tone="danger" icon="alarm">Quá hạn</StatusBadge>
    if (TICKET_GROUPS.answered.includes(t.status)) return <StatusBadge tone="success">Đã phản hồi</StatusBadge>
    if (t.status === 'waiting_merchant') return <StatusBadge tone="neutral">Đợi bổ sung</StatusBadge>
    return <StatusBadge tone="warning">Chưa phản hồi</StatusBadge>
  }

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        eyebrow={<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-label-md text-label-md normal-case tracking-normal text-primary">Live Sync • {formatNumber(tickets.length)} Yêu cầu</span>}
        title="Yêu Cầu Hỗ Trợ & Khiếu Nại Đối Tác"
        subtitle="Tiếp nhận, theo dõi phân loại và xử lý các phản hồi, vướng mắc từ nhà hàng, quán ăn trên toàn hệ thống Giaodoan."
        actions={
          <>
            <button type="button" onClick={exportList} disabled={filtered.length === 0} className={`${btnSecondary} max-sm:min-w-[45%]`}>
              <Icon name="file_download" className="text-[20px] text-secondary" />
              <span>{selectedRows.length > 0 ? `Xuất Excel (${selectedRows.length} đã chọn)` : 'Xuất Excel'}</span>
            </button>
            <button type="button" onClick={() => setAdding(true)} className={`${btnPrimary} max-sm:min-w-[45%]`}>
              <Icon name="add_circle" className="text-[22px]" />
              <span>Tạo yêu cầu hỗ trợ mới</span>
            </button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-space-md xl:grid-cols-4">
        <KpiCard label="Tổng số yêu cầu" value={formatNumber(counts.all)} icon="inbox" tone="primary"
          footer={<span className="flex items-center gap-1 font-semibold text-tertiary"><Icon name="trending_up" className="text-[16px]" />+{newToday} mới hôm nay</span>} />
        <KpiCard label="Đã phản hồi" value={formatNumber(counts.answered)} icon="check_circle" tone="tertiary" valueClassName="text-tertiary"
          footer={
            <>
              <span className="font-semibold text-tertiary">Hoàn thành: {completion.toLocaleString('vi-VN')}%</span>
              {overdue === 0 ? (
                <span className="rounded-full bg-tertiary-fixed/40 px-2 py-0.5 text-[12px] font-bold text-on-tertiary-fixed-variant">Chuẩn SLA</span>
              ) : (
                <span className="rounded-full bg-error-container px-2 py-0.5 text-[12px] font-bold text-on-error-container">{overdue} quá hạn SLA</span>
              )}
            </>
          } />
        <KpiCard label="Chưa được phản hồi" value={formatNumber(counts.unanswered)} icon="hourglass_top" tone="primary" valueClassName="text-primary-container"
          footer={<span className="font-semibold text-primary">Cần phân bổ &amp; xử lý ngay</span>} />
        <KpiCard label="Đợi Merchant bổ sung" value={formatNumber(counts.waiting)} icon="pending_actions" tone="secondary"
          footer={<span className="line-clamp-2 break-words text-secondary" title={waitingNotes.join(' • ')}>{waitingNotes.length ? waitingNotes.join(' • ') : 'Không có yêu cầu nào đang chờ'}</span>} />
      </div>

      {/* Filter hub */}
      <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-3 shadow-sm sm:p-space-md">
        <div className="flex flex-col gap-space-sm md:flex-row md:items-center md:justify-between md:gap-space-md">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-container p-1">
            {pill('all', 'Tất cả', counts.all, 'bg-surface-container-high text-secondary')}
            {pill('unanswered', 'Chưa phản hồi', counts.unanswered, 'bg-primary-fixed text-primary')}
            {pill('answered', 'Đã phản hồi', counts.answered, 'bg-tertiary-fixed text-on-tertiary-fixed')}
            {pill('waiting', 'Đợi Merchant bổ sung', counts.waiting, 'bg-secondary-container text-on-secondary-container')}
          </div>
          <button type="button" onClick={() => { reload(); toast('Đã làm mới danh sách') }} title="Làm mới bảng"
            className="flex min-h-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-surface-container-low px-3 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container">
            <Icon name="refresh" className="text-[18px] text-secondary" />
            <span>Làm mới</span>
          </button>
        </div>

        <div className="grid grid-cols-1 items-center gap-space-sm md:grid-cols-12">
          <div className="md:col-span-6 xl:col-span-7">
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo mã yêu cầu, mã Merchant, tên quán, SĐT..." className="sm:!w-full" />
          </div>
          <div className={`${selectWrap} md:col-span-3 xl:col-span-3`}>
            <Icon name="category" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">Tất cả loại YCHT</option>
              {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => <option key={c} value={c}>{TICKET_CATEGORIES[c].long}</option>)}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
          </div>
          <div className={`${selectWrap} md:col-span-3 xl:col-span-2`}>
            <Icon name="location_on" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">Toàn quốc</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-3 md:gap-0 md:overflow-hidden md:rounded-2xl md:bg-surface-container-lowest md:shadow-sm">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="rounded-xl bg-surface-container-lowest p-6"><ErrorState message={error} onRetry={reload} /></div>
        ) : (
          <>
            <ResponsiveTable
              minWidth={960}
              cards={pageRows.map((t) => {
                const m: MerchantLite | null = t.merchant
                const sla = slaInfo(t)
                return (
                  <MobileCard
                    key={t.id}
                    title={<Link to={supportPath(t.id)}>{hashCode(t.code)}{t.subject ? ` · ${t.subject}` : ''}</Link>}
                    subtitle={m ? <Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">{m.name} ({hashCode(m.code)})</Link> : '—'}
                    badge={statusBadge(t)}
                    fields={[
                      ['Loại YCHT', TICKET_CATEGORIES[t.category].label],
                      ['Ưu tiên', TICKET_PRIORITIES[t.priority]],
                      ['Ngày tạo', formatDateTime(t.created_at)],
                      ['SLA', <span key="sla" className={sla.cls}>{sla.text}</span>],
                    ]}
                    actions={
                      <>
                        <Link to={supportPath(t.id)} className={`${actionBtn} flex-1 text-primary`}><Icon name="visibility" className="text-[18px]" />Xem chi tiết</Link>
                        <select value={t.category} onChange={(e) => changeCategory(t, e.target.value as TicketCategory)} aria-label="Loại YCHT"
                          className="min-h-10 flex-1 cursor-pointer rounded-lg bg-surface-container px-3 py-1.5 font-label-md text-label-md font-semibold text-on-surface focus:outline-none">
                          {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => <option key={c} value={c}>{TICKET_CATEGORIES[c].label}</option>)}
                        </select>
                      </>
                    }
                  />
                )
              })}
            >
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-primary-container text-on-primary">
                    <th className="w-12 px-space-md py-3.5 text-center">
                      <input type="checkbox" aria-label="Chọn tất cả trên trang" className="h-4 w-4 cursor-pointer rounded accent-surface-container-lowest" checked={allOnPageSelected} onChange={toggleAll} />
                    </th>
                    {['MÃ YÊU CẦU', 'MÃ MERCHANT', 'TÊN MERCHANT', 'LOẠI YCHT', 'NGÀY TẠO & HẠN XỬ LÝ'].map((h) => (
                      <th key={h} className="px-space-md py-3.5 font-headline-md text-label-lg uppercase tracking-wider text-on-primary">{h}</th>
                    ))}
                    <th className="px-space-md py-3.5 text-center font-headline-md text-label-lg uppercase tracking-wider text-on-primary">CHI TIẾT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/60">
                  {pageRows.map((t) => {
                    const m: MerchantLite | null = t.merchant
                    const sla = slaInfo(t)
                    return (
                      <tr key={t.id} className="group cursor-pointer transition-colors hover:bg-surface-container-low/50" onClick={() => navigate(supportPath(t.id))}>
                        <td className="px-space-md py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label="Chọn yêu cầu" className="h-4 w-4 cursor-pointer rounded accent-primary-container" checked={selected.has(t.id)}
                            onChange={() => setSelected((cur) => { const n = new Set(cur); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })} />
                        </td>
                        <td className="px-space-md py-4">
                          <div className="flex flex-col items-start gap-1">
                            <Link to={supportPath(t.id)} onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center rounded-md bg-surface-container px-2.5 py-1 font-label-md text-label-md font-bold text-on-surface transition-colors group-hover:bg-primary-fixed group-hover:text-primary">
                              {hashCode(t.code)}
                            </Link>
                            {t.subject && <span className="max-w-[220px] truncate text-[13px] text-secondary" title={t.subject}>{t.subject}</span>}
                          </div>
                        </td>
                        <td className="px-space-md py-4">
                          {m ? (
                            <Link to={merchantPath(m.id)} onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center rounded-md bg-surface-container-high px-2.5 py-1 font-label-md text-label-md font-semibold text-on-surface hover:text-primary hover:underline">{hashCode(m.code)}</Link>
                          ) : '—'}
                        </td>
                        <td className="px-space-md py-4">
                          <div className="flex items-center gap-3">
                            <MerchantAvatar m={m} />
                            <div className="flex min-w-0 flex-col">
                              {m ? (
                                <Link to={merchantPath(m.id)} onClick={(e) => e.stopPropagation()} className="truncate font-headline-md text-body-lg font-bold text-on-surface hover:text-primary hover:underline">{m.name}</Link>
                              ) : <span>—</span>}
                              <span className="truncate font-body-sm text-body-sm text-secondary">{t.branch_label ?? m?.address ?? ''}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high py-1.5 pl-3 pr-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container">
                            <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[t.category]}`} />
                            <select value={t.category} onChange={(e) => changeCategory(t, e.target.value as TicketCategory)} aria-label="Loại YCHT"
                              className="cursor-pointer appearance-none bg-transparent pr-5 font-semibold focus:outline-none">
                              {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => <option key={c} value={c}>{TICKET_CATEGORIES[c].label}</option>)}
                            </select>
                            <Icon name="expand_more" className="pointer-events-none absolute right-2 text-[16px] text-secondary" />
                          </div>
                        </td>
                        <td className="px-space-md py-4">
                          <div className="flex flex-col">
                            <span className="font-label-md text-body-md font-medium text-on-surface">{formatDateTime(t.created_at)}</span>
                            <div className={`mt-0.5 flex items-center gap-1 font-label-sm text-label-sm ${sla.cls}`}>
                              <Icon name={sla.icon} className="text-[14px]" />
                              <span className={sla.bold ? 'font-bold' : ''}>{sla.text}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <Link to={supportPath(t.id)} title="Xem chi tiết yêu cầu" aria-label={`Xem chi tiết ${t.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-primary transition-all hover:scale-105 hover:bg-surface-container-high hover:text-primary-container active:scale-95">
                            <Icon name="visibility" className="text-[20px]" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ResponsiveTable>
            {filtered.length === 0 && <div className="max-md:rounded-xl max-md:bg-surface-container-lowest max-md:shadow-sm"><EmptyState message="Không tìm thấy yêu cầu hỗ trợ nào phù hợp." /></div>}
            <div className="overflow-hidden max-md:rounded-xl max-md:shadow-sm"><Pagination page={curPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} label="yêu cầu" /></div>
          </>
        )}
      </div>

      <CreateTicketModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(code) => { setAdding(false); toast(`Đã tạo yêu cầu hỗ trợ ${hashCode(code)}`); reload() }}
      />
    </div>
  )
}

function CreateTicketModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (code: string) => void }) {
  const merchantsQ = useQuery<Pick<MerchantLite, 'id' | 'code' | 'name' | 'address'>[]>(
    () => supabase.from('merchants').select('id,code,name,address').order('code', { ascending: false }),
    [],
  )
  const staffQ = useQuery<Staff[]>(() => supabase.from('staff').select('*').order('code'), [])

  const empty = { merchant_id: '', category: 'payment' as TicketCategory, priority: 'normal' as 'low' | 'normal' | 'high', subject: '', body: '', branch_label: '', assignee_id: '' }
  const [f, setF] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof empty, v: string) => setF((cur) => ({ ...cur, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const merchant = merchantsQ.data?.find((m) => m.id === f.merchant_id)
    // `code` (TK-xxxx) is generated by the database sequence
    const { data: row, error: insErr } = await supabase
      .from('support_tickets')
      .insert({
        merchant_id: f.merchant_id,
        category: f.category,
        priority: f.priority,
        subject: f.subject.trim(),
        body: f.body.trim() || null,
        branch_label: f.branch_label.trim() || merchant?.address || null,
        assignee_id: f.assignee_id || null,
        status: 'new',
        sla_due_at: new Date(Date.now() + SLA_HOURS[f.priority] * 3600000).toISOString(),
        updated_by: staffQ.data?.find((s) => s.full_name === 'Nguyễn Văn A')?.full_name ?? staffQ.data?.[0]?.full_name ?? null,
      })
      .select('code')
      .single()
    setSaving(false)
    if (insErr) return setErr(insErr.message)
    setF(empty)
    onCreated(row?.code ?? '')
  }

  return (
    <Modal open={open} title="Tạo yêu cầu hỗ trợ mới" onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="create-ticket-form" className={btnPrimary} disabled={saving || !f.merchant_id}>
            <Icon name="add_circle" className="text-[20px]" />
            {saving ? 'Đang lưu...' : 'Tạo yêu cầu'}
          </button>
        </>
      }>
      <form id="create-ticket-form" onSubmit={submit}>
        <FormGrid>
        <Field label="Merchant" required className="sm:col-span-2">
          <select required className={inputCls} value={f.merchant_id} onChange={(e) => set('merchant_id', e.target.value)}>
            <option value="">{merchantsQ.loading ? 'Đang tải danh sách...' : '-- Chọn Merchant --'}</option>
            {(merchantsQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{hashCode(m.code)} · {m.name}</option>)}
          </select>
        </Field>
        <Field label="Loại YCHT" required>
          <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
            {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => <option key={c} value={c}>{TICKET_CATEGORIES[c].long}</option>)}
          </select>
        </Field>
        <Field label="Mức độ ưu tiên">
          <select className={inputCls} value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="low">{TICKET_PRIORITIES.low}</option>
            <option value="normal">{TICKET_PRIORITIES.normal}</option>
            <option value="high">{TICKET_PRIORITIES.high}</option>
          </select>
        </Field>
        <Field label="Tiêu đề" required className="sm:col-span-2">
          <input required className={inputCls} value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Ví dụ: Chưa nhận được tiền đối soát tuần 43" />
        </Field>
        <Field label="Chi nhánh / Địa điểm">
          <input className={inputCls} value={f.branch_label} onChange={(e) => set('branch_label', e.target.value)} placeholder="Chi nhánh 1 • Q.1, TP. Hồ Chí Minh" />
        </Field>
        <Field label="Nhân sự phụ trách">
          <select className={inputCls} value={f.assignee_id} onChange={(e) => set('assignee_id', e.target.value)}>
            <option value="">-- Chưa phân công --</option>
            {(staffQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <Field label="Nội dung yêu cầu" className="sm:col-span-2">
          <textarea rows={4} className={inputCls} value={f.body} onChange={(e) => set('body', e.target.value)} placeholder="Mô tả chi tiết vấn đề của Merchant..." />
        </Field>
        {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container sm:col-span-2">{err}</p>}
        </FormGrid>
      </form>
    </Modal>
  )
}
