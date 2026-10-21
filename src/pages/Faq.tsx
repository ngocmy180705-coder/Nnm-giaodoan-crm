import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import ResponsiveTable, { MobileCard } from '../components/ResponsiveTable'
import SearchInput from '../components/SearchInput'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { btnPrimary, btnSecondary } from '../components/Form'
import { FAQ_AUDIENCES, FAQ_CATEGORIES } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { formatDate, formatNumber, formatTime, initials } from '../lib/format'
import { useToast } from '../lib/layoutContext'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { FaqCategory, Staff } from '../lib/types'
import { useNewParam } from '../lib/useNewParam'
import { useQuery } from '../lib/useQuery'
import { useRowSelection } from '../lib/useRowSelection'
import { CategoryModal } from './faq/CategoryModal'
import { FaqFormModal } from './faq/FaqForm'
import { CATEGORY_ICON, type Audience, type FaqWithStaff } from './faq/shared'

const CATEGORY_KEYS = Object.keys(FAQ_CATEGORIES) as FaqCategory[]
const AVATAR_BG = ['bg-primary-container text-on-primary', 'bg-tertiary-container text-on-tertiary', 'bg-surface-variant text-on-surface-variant']

const selectCls =
  'w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low py-2.5 pl-3.5 pr-8 font-label-lg text-[16px] font-semibold text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary-container sm:w-auto sm:text-label-lg'

export default function Faq() {
  const toast = useToast()
  const { settings } = useSettings()
  const pageSize = settings.pageSize
  const { data, loading, error, reload, setData } = useQuery<FaqWithStaff[]>(
    () => supabase.from('faqs').select('*, updater:staff!updated_by_id(id,full_name,title)').order('code'),
    [],
  )
  const staffQ = useQuery<Staff[]>(() => supabase.from('staff').select('*').order('code'), [])
  // No auth: edits are attributed to the operator named in Cài đặt, else the default operator of the design (Nguyễn Văn A).
  const me = staffQ.data?.find((s) => s.full_name === settings.name) ?? staffQ.data?.find((s) => s.full_name === 'Nguyễn Văn A') ?? staffQ.data?.[0] ?? null

  const [category, setCategory] = useState<'all' | FaqCategory>('all')
  const [q, setQ] = useState('')
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all')
  const [audience, setAudience] = useState<'all' | Audience>('all')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<FaqWithStaff | 'new' | null>(null)
  const [previewing, setPreviewing] = useState<FaqWithStaff | null>(null)
  const [deleting, setDeleting] = useState<FaqWithStaff[] | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  useNewParam(() => setEditing('new'))

  const faqs = data ?? []

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: faqs.length }
    for (const k of CATEGORY_KEYS) c[k] = faqs.filter((f) => f.category === k).length
    return c
  }, [faqs])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return faqs.filter((f) => {
      if (category !== 'all' && f.category !== category) return false
      if (visibility === 'visible' && !f.is_visible) return false
      if (visibility === 'hidden' && f.is_visible) return false
      if (audience !== 'all' && f.audience !== audience) return false
      if (!needle) return true
      return [f.code, f.question, f.answer, FAQ_CATEGORIES[f.category]].some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [faqs, category, visibility, audience, q])

  const { selected, setSelected, selectedRows } = useRowSelection(filtered)

  const curPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const pageRows = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)

  // KPIs (computed from rows)
  const totalViews = faqs.reduce((s, f) => s + f.view_count, 0)
  const updatedThisMonth = faqs.filter((f) => Date.now() - new Date(f.updated_at).getTime() < 30 * 86400000).length
  const visibleCount = faqs.filter((f) => f.is_visible).length
  const visiblePct = faqs.length ? Math.round((visibleCount / faqs.length) * 1000) / 10 : 0
  const avgViews = faqs.length ? Math.round(totalViews / faqs.length) : 0
  const top = faqs.reduce<FaqWithStaff | null>((best, f) => (!best || f.view_count > best.view_count ? f : best), null)

  async function setVisible(rows: FaqWithStaff[], next: boolean) {
    const ids = new Set(rows.map((r) => r.id))
    setData((cur) => (cur ?? []).map((x) => (ids.has(x.id) ? { ...x, is_visible: next } : x)))
    const { error: err } = await supabase.from('faqs').update({ is_visible: next, updated_at: new Date().toISOString(), updated_by_id: me?.id ?? null }).in('id', [...ids])
    if (err) {
      setData((cur) => (cur ?? []).map((x) => { const old = rows.find((r) => r.id === x.id); return old ? { ...x, is_visible: old.is_visible } : x }))
      toast(`Không cập nhật được trạng thái: ${err.message}`)
    } else {
      toast(rows.length === 1 ? (next ? `Đã hiển thị #${rows[0].code} cho Merchant` : `Đã ẩn #${rows[0].code}`) : next ? `Đã hiển thị ${rows.length} câu hỏi` : `Đã ẩn ${rows.length} câu hỏi`)
    }
  }

  async function confirmDelete() {
    const rows = deleting
    if (!rows?.length) return
    const { error: err } = await supabase.from('faqs').delete().in('id', rows.map((r) => r.id))
    setDeleting(null)
    if (err) return toast(`Không xóa được: ${err.message}`)
    toast(rows.length === 1 ? `Đã xóa câu hỏi #${rows[0].code}` : `Đã xóa ${rows.length} câu hỏi`)
    setSelected((cur) => { const n = new Set(cur); rows.forEach((r) => n.delete(r.id)); return n })
    reload()
  }

  function exportList() {
    exportCsv(
      'faq.csv',
      [
        { header: 'Mã FAQ', value: (f: FaqWithStaff) => f.code },
        { header: 'Chuyên mục', value: (f) => FAQ_CATEGORIES[f.category] },
        { header: 'Câu hỏi', value: (f) => f.question },
        { header: 'Câu trả lời', value: (f) => f.answer },
        { header: 'Đối tượng', value: (f) => FAQ_AUDIENCES[f.audience] },
        { header: 'Lượt tra cứu', value: (f) => f.view_count },
        { header: 'Trạng thái', value: (f) => (f.is_visible ? 'Đang hiển thị' : 'Đang ẩn') },
        { header: 'Người cập nhật', value: (f) => f.updater?.full_name },
        { header: 'Ngày cập nhật', value: (f) => `${formatDate(f.updated_at)} ${formatTime(f.updated_at)}` },
      ],
      filtered,
    )
  }

  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleExpanded = (id: string) => setExpanded((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((f) => selected.has(f.id))
  function toggleAll() {
    setSelected((cur) => {
      const next = new Set(cur)
      if (allOnPageSelected) pageRows.forEach((f) => next.delete(f.id))
      else pageRows.forEach((f) => next.add(f.id))
      return next
    })
  }

  const tab = (key: 'all' | FaqCategory, label: string) => (
    <button key={key} type="button" onClick={() => { setCategory(key); setPage(1) }}
      className={`flex min-h-[40px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 font-label-lg text-label-lg transition-colors ${
        category === key ? 'bg-primary-container font-bold text-on-primary shadow-sm' : 'bg-surface-container-low font-semibold text-on-surface hover:bg-surface-container'}`}>
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-xs ${category === key ? 'bg-white/20 text-on-primary' : 'bg-surface-container-highest font-bold text-secondary'}`}>{formatNumber(catCounts[key])}</span>
    </button>
  )

  const iconBtn = 'flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-container hover:text-primary'

  const visibleSwitch = (f: FaqWithStaff) => (
    <button type="button" role="switch" aria-checked={f.is_visible} title={f.is_visible ? 'Đang hiển thị - bấm để ẩn' : 'Đang ẩn - bấm để hiển thị'} onClick={() => setVisible([f], !f.is_visible)}
      className="flex h-10 w-11 cursor-pointer items-center justify-center">
      <span className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${f.is_visible ? 'bg-tertiary-container' : 'bg-surface-container-highest'}`}>
        <span className={`block h-5 w-5 transform rounded-full bg-surface-container-lowest shadow-md transition-transform ${f.is_visible ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )

  const categoryChip = (f: FaqWithStaff) => {
    const ci = CATEGORY_ICON[f.category]
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2.5 py-0.5 font-label-sm text-label-sm font-semibold text-on-surface">
        <Icon name={f.icon || ci.icon} className={`text-[14px] ${ci.cls}`} />
        {FAQ_CATEGORIES[f.category]}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        title="Quản Lý FAQ & Trợ Giúp Đối Tác"
        subtitle={<span className="block max-w-2xl">Hệ thống cơ sở tri thức giúp Merchant tra cứu tự động, giải đáp nhanh các thắc mắc về vận hành quán, đối soát đơn hàng và chính sách sàn Giaodoan.</span>}
        actions={
          <>
            <button type="button" onClick={exportList} disabled={filtered.length === 0} className={`${btnSecondary} min-h-[40px]`}>
              <Icon name="download" className="text-[20px] text-secondary" />
              <span>Xuất Excel</span>
            </button>
            <button type="button" onClick={() => setCategoriesOpen(true)} className={`${btnSecondary} min-h-[40px]`}>
              <Icon name="label" className="text-[20px] text-secondary" />
              <span>Phân loại chuyên mục</span>
            </button>
            <button type="button" onClick={() => setEditing('new')} className={`${btnPrimary} min-h-[40px]`}>
              <Icon name="add" className="text-[20px]" />
              <span>Thêm câu hỏi</span>
            </button>
          </>
        }
      />

      {/* KPI cards: 2 per row on phones */}
      <div className="grid grid-cols-2 gap-space-sm sm:gap-space-md lg:grid-cols-4">
        <KpiCard label="Tổng số câu hỏi" value={formatNumber(faqs.length)} icon="menu_book" tone="primary"
          footer={<span className="text-secondary"><b className="text-tertiary">+{updatedThisMonth}</b> câu cập nhật tháng này</span>} />
        <KpiCard label="Lượt tra cứu" value={formatNumber(totalViews)} icon="manage_search" tone="tertiary"
          footer={<span className="text-secondary">TB {formatNumber(avgViews)} lượt / câu hỏi</span>} />
        <KpiCard label="Đang hiển thị" value={<span className="text-tertiary">{visiblePct.toLocaleString('vi-VN')}%</span>} icon="task_alt" tone="secondary" progress={visiblePct}
          footer={<span className="text-secondary">{visibleCount}/{faqs.length} câu · {visiblePct >= 80 ? 'Rất tốt' : 'Cần bổ sung'}</span>} />
        <KpiCard label="Xem nhiều nhất" value={formatNumber(top?.view_count ?? 0)} icon="local_fire_department" tone="primary"
          footer={top ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewing(top) }} title={top.question} className="line-clamp-1 w-full text-left font-semibold text-primary hover:underline">{top.question}</button>
          ) : <span className="text-secondary">—</span>} />
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="-mx-space-md flex gap-2 overflow-x-auto px-space-md pb-1">
          {tab('all', 'Tất cả')}
          {CATEGORY_KEYS.map((k) => tab(k, FAQ_CATEGORIES[k]))}
        </div>
        <div className="flex flex-col gap-space-sm lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Tìm theo từ khóa, mã FAQ, câu hỏi hoặc câu trả lời..." className="lg:max-w-xl" />
          <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center">
            <div className="relative">
              <select value={visibility} onChange={(e) => { setVisibility(e.target.value as typeof visibility); setPage(1) }} className={selectCls} aria-label="Trạng thái">
                <option value="all">Trạng thái: Tất cả</option>
                <option value="visible">Trạng thái: Đang hiển thị</option>
                <option value="hidden">Trạng thái: Đang ẩn</option>
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            </div>
            <div className="relative">
              <select value={audience} onChange={(e) => { setAudience(e.target.value as typeof audience); setPage(1) }} className={selectCls} aria-label="Đối tượng">
                <option value="all">Đối tượng: Tất cả Merchant</option>
                <option value="new">Đối tượng: {FAQ_AUDIENCES.new}</option>
                <option value="chain">Đối tượng: {FAQ_AUDIENCES.chain}</option>
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-secondary" />
            </div>
            <button type="button" title="Làm mới danh sách" onClick={() => { reload(); toast('Đã làm mới danh sách') }} className={`${btnSecondary} min-h-[40px] max-sm:w-full`}>
              <Icon name="refresh" className="text-[20px]" />
              <span className="sm:hidden">Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions for ticked rows */}
      {selectedRows.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-primary-fixed px-space-md py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-label-lg text-[14px] font-bold text-on-primary-fixed-variant">Đã chọn {selectedRows.length} câu hỏi (đang hiển thị)</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btnSecondary} min-h-[40px]`} onClick={() => setVisible(selectedRows, true)}><Icon name="visibility" className="text-[18px]" />Hiển thị</button>
            <button type="button" className={`${btnSecondary} min-h-[40px]`} onClick={() => setVisible(selectedRows, false)}><Icon name="visibility_off" className="text-[18px]" />Ẩn</button>
            <button type="button" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-error-container px-4 py-2 font-label-lg text-[14px] font-semibold text-error" onClick={() => setDeleting(selectedRows)}><Icon name="delete" className="text-[18px]" />Xóa</button>
            <button type="button" className="min-h-[40px] px-2 font-label-lg text-[14px] font-semibold text-secondary hover:underline" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div>
          <div className="md:overflow-hidden md:rounded-t-xl md:bg-surface-container-lowest md:shadow-sm">
            {filtered.length > 0 && (
              <ResponsiveTable minWidth={960}
                cards={pageRows.map((f) => (
                  <MobileCard key={f.id}
                    title={
                      <span className="flex items-start gap-1">
                        <label className="-ml-2 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center" aria-label="Chọn câu hỏi">
                          <input type="checkbox" className="h-4 w-4 cursor-pointer accent-primary-container" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                        </label>
                        <button type="button" onClick={() => setEditing(f)} className="line-clamp-3 min-w-0 whitespace-normal pt-2 text-left font-bold leading-snug hover:text-primary">{f.question}</button>
                      </span>
                    }
                    fields={[
                      ['Mã FAQ', `#${f.code}`],
                      ['Chuyên mục', FAQ_CATEGORIES[f.category]],
                      ['Lượt tra cứu', formatNumber(f.view_count)],
                      ['Cập nhật', `${formatDate(f.updated_at)}${f.updater ? ` · ${f.updater.full_name}` : ''}`],
                    ]}
                    actions={
                      <>
                        <p className={`w-full whitespace-pre-line text-[13px] leading-relaxed text-secondary ${expanded.has(f.id) ? '' : 'line-clamp-3'}`}>{f.answer}</p>
                        <button type="button" onClick={() => toggleExpanded(f.id)} className="flex min-h-[40px] items-center gap-1 text-[13px] font-semibold text-primary">
                          <Icon name={expanded.has(f.id) ? 'unfold_less' : 'unfold_more'} className="text-[18px]" />
                          {expanded.has(f.id) ? 'Thu gọn' : 'Xem đầy đủ'}
                        </button>
                        <span className="ml-auto flex items-center">
                          <button type="button" aria-label="Xem trước" title="Xem trước bản xem Merchant" onClick={() => setPreviewing(f)} className={iconBtn}><Icon name="visibility" className="text-[20px]" /></button>
                          <button type="button" aria-label="Chỉnh sửa" title="Chỉnh sửa câu hỏi" onClick={() => setEditing(f)} className={iconBtn}><Icon name="edit" className="text-[20px]" /></button>
                          <button type="button" aria-label="Xóa" title="Xóa câu hỏi" onClick={() => setDeleting([f])} className={`${iconBtn} hover:bg-error-container hover:text-error`}><Icon name="delete" className="text-[20px]" /></button>
                          {visibleSwitch(f)}
                        </span>
                      </>
                    }
                    badge={f.is_visible ? undefined : <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-secondary">Đang ẩn</span>}
                  />
                ))}>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-primary-container text-on-primary">
                      <th className="w-12 px-2.5 py-3.5 text-center">
                        <input type="checkbox" aria-label="Chọn tất cả trên trang" className="h-4 w-4 cursor-pointer rounded accent-surface-container-lowest focus:ring-0" checked={allOnPageSelected} onChange={toggleAll} />
                      </th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 font-label-lg text-[13px] font-bold uppercase tracking-wider">MÃ FAQ</th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 font-label-lg text-[13px] font-bold uppercase tracking-wider">CÂU HỎI</th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 font-label-lg text-[13px] font-bold uppercase tracking-wider">CÂU TRẢ LỜI</th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 text-right font-label-lg text-[13px] font-bold uppercase tracking-wider">LƯỢT TRA CỨU</th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 font-label-lg text-[13px] font-bold uppercase tracking-wider">NGƯỜI CẬP NHẬT</th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 font-label-lg text-[13px] font-bold uppercase tracking-wider">NGÀY CẬP NHẬT</th>
                      <th className="whitespace-nowrap px-2.5 py-3.5 text-center font-label-lg text-[13px] font-bold uppercase tracking-wider">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {pageRows.map((f, idx) => {
                      const open = expanded.has(f.id)
                      return (
                        <tr key={f.id} className={`group transition-colors hover:bg-surface-container-low ${f.is_visible ? '' : 'opacity-60'}`}>
                          <td className="px-2.5 py-4 text-center">
                            <input type="checkbox" aria-label="Chọn câu hỏi" className="h-4 w-4 cursor-pointer rounded accent-primary-container" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-4">
                            <span className="inline-flex items-center rounded-md bg-surface-container-high px-2.5 py-1 font-headline-md text-body-md font-bold text-primary">#{f.code}</span>
                          </td>
                          <td className="px-2.5 py-4">
                            <div className="flex min-w-[160px] flex-col gap-1.5">
                              <button type="button" onClick={() => setEditing(f)} className="text-left font-headline-md text-body-lg font-bold leading-snug text-on-surface hover:text-primary">{f.question}</button>
                              <div>{categoryChip(f)}</div>
                            </div>
                          </td>
                          <td className="px-2.5 py-4">
                            <div className="flex min-w-[150px] items-start justify-between gap-2">
                              <p className={`font-body-md text-body-md leading-relaxed text-secondary ${open ? '' : 'line-clamp-2'}`}>{f.answer}</p>
                              <button type="button" title={open ? 'Thu gọn câu trả lời' : 'Xem đầy đủ câu trả lời'} onClick={() => toggleExpanded(f.id)}
                                className="shrink-0 rounded p-1 text-primary hover:bg-surface-container hover:text-on-primary-container">
                                <Icon name={open ? 'unfold_less' : 'unfold_more'} className="text-[20px]" />
                              </button>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-4 text-right">
                            <span className="font-headline-md text-body-lg font-extrabold text-primary">{formatNumber(f.view_count)}</span>
                            <span className="ml-1 font-body-sm text-body-sm text-secondary">lượt</span>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-4">
                            {f.updater ? (
                              <div className="flex items-center gap-2.5">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full font-label-md text-label-md font-bold shadow-sm ${AVATAR_BG[(curPage * pageSize + idx) % AVATAR_BG.length]}`}>{initials(f.updater.full_name)}</div>
                                <div className="flex flex-col">
                                  <span className="font-label-lg text-body-md font-bold leading-tight text-on-surface">{f.updater.full_name}</span>
                                  
                                </div>
                              </div>
                            ) : (
                              <span className="text-secondary">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-4">
                            <div className="flex flex-col font-body-md text-body-md text-secondary">
                              <span className="font-bold text-on-surface">{formatDate(f.updated_at)}</span>
                              <span className="text-body-sm text-secondary">{formatTime(f.updated_at)}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <button type="button" aria-label="Xem trước" title="Xem trước bản xem Merchant" onClick={() => setPreviewing(f)} className={iconBtn}><Icon name="visibility" className="text-[20px]" /></button>
                              <button type="button" aria-label="Chỉnh sửa" title="Chỉnh sửa câu hỏi" onClick={() => setEditing(f)} className={iconBtn}><Icon name="edit" className="text-[20px]" /></button>
                              <button type="button" aria-label="Xóa" title="Xóa câu hỏi" onClick={() => setDeleting([f])} className={`${iconBtn} hover:bg-error-container hover:text-error`}><Icon name="delete" className="text-[20px]" /></button>
                              {visibleSwitch(f)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ResponsiveTable>
            )}
            {filtered.length === 0 && <EmptyState message="Không tìm thấy câu hỏi nào phù hợp." />}
          </div>
          <div className="mt-space-sm overflow-hidden rounded-xl shadow-sm md:mt-0 md:rounded-t-none">
            <Pagination page={curPage} pageSize={pageSize} total={filtered.length} onPage={setPage} label="câu hỏi" />
          </div>
        </div>
      )}

      <FaqFormModal
        faq={editing}
        meId={me?.id ?? null}
        onClose={() => setEditing(null)}
        onSaved={(msg) => { setEditing(null); toast(msg); reload() }}
      />

      <CategoryModal
        open={categoriesOpen}
        faqs={faqs}
        onClose={() => setCategoriesOpen(false)}
        onPick={(c) => { setCategory(c); setPage(1); setCategoriesOpen(false) }}
      />

      <Modal open={!!previewing} title="Xem trước (góc nhìn Merchant)" onClose={() => setPreviewing(null)} width="max-w-xl"
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => { const f = previewing; setPreviewing(null); if (f) setEditing(f) }}><Icon name="edit" className="text-[18px]" />Chỉnh sửa</button>
            <button type="button" className={btnPrimary} onClick={() => setPreviewing(null)}>Đóng</button>
          </>
        }>
        {previewing && (
          <div className="flex flex-col gap-3">
            <span className="w-fit">{categoryChip(previewing)}</span>
            <h3 className="font-headline-md text-[18px] font-bold text-on-surface">{previewing.question}</h3>
            <p className="whitespace-pre-line rounded-xl bg-surface-container-low p-space-md font-body-lg text-body-lg leading-relaxed text-on-surface">{previewing.answer}</p>
            <p className="text-[13px] text-secondary">Đối tượng: {FAQ_AUDIENCES[previewing.audience]} • {previewing.is_visible ? 'Đang hiển thị' : 'Đang ẩn khỏi Merchant'}</p>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} title={deleting && deleting.length > 1 ? `Xóa ${deleting.length} câu hỏi` : 'Xóa câu hỏi FAQ'} onClose={() => setDeleting(null)} width="max-w-md"
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setDeleting(null)}>Hủy bỏ</button>
            <button type="button" onClick={confirmDelete}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-error px-5 py-2.5 font-label-lg text-[14px] font-bold text-on-error shadow-md hover:opacity-95">
              <Icon name="delete" className="text-[20px]" />
              {deleting && deleting.length > 1 ? `Xóa ${deleting.length} câu hỏi` : 'Xóa câu hỏi'}
            </button>
          </>
        }>
        {deleting && (
          <p className="text-[14px] text-on-surface">
            {deleting.length === 1 ? (
              <>
                Bạn chắc chắn muốn xóa <b>#{deleting[0].code}</b>?<br />
                <span className="text-secondary">“{deleting[0].question}”</span>
              </>
            ) : (
              <>Bạn chắc chắn muốn xóa <b>{deleting.length}</b> câu hỏi đã chọn?</>
            )}
            <br />
            Hành động này không thể hoàn tác.
          </p>
        )}
      </Modal>
    </div>
  )
}
