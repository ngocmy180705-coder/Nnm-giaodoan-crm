import { useCallback, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { ErrorState, Loading } from '../components/Loading'
import StatusBadge, { type Tone } from '../components/StatusBadge'
import { MERCHANT_STATUSES, merchantStatus, ONBOARDING_STEPS, RISK_LEVELS, RISK_TYPES, TICKET_STATUSES } from '../lib/constants'
import { daysUntil, formatDate, formatDateTime, formatNumber, formatVnd, hashCode, initials, relativeTime } from '../lib/format'
import { useBreadcrumb, useToast } from '../lib/layoutContext'
import { activityPath, churnPath, contactsPath, invoicePath, newPath, onboardingPath, promotionsPath, ROUTES, subscriptionPath, supportPath } from '../lib/links'
import { supabase } from '../lib/supabase'
import type { ActivityLog, ChurnRisk, ContactLog, Invoice, MerchantContact, MerchantStatus, MerchantWithStaff, Onboarding, Promotion, PromotionMerchant, SupportTicket, Subscription } from '../lib/types'
import { useDismiss } from '../lib/useDismiss'
import { useQuery } from '../lib/useQuery'
import { expiryState } from './subscriptions/shared'

// Fields editable via "Chỉnh sửa hồ sơ". Everything is edited as a string and converted on save.
const EDIT_TEXT = ['name', 'category', 'phone', 'email', 'personal_email', 'address_full', 'contact_name', 'contact_title', 'payout_schedule', 'bank_account', 'contract_end'] as const
const EDIT_NUM = ['take_rate_pct', 'delivery_radius_km'] as const
type EditKey = (typeof EDIT_TEXT)[number] | (typeof EDIT_NUM)[number]
type Draft = Record<EditKey, string>

const draftFrom = (m: MerchantWithStaff): Draft => {
  const d = {} as Draft
  for (const k of [...EDIT_TEXT, ...EDIT_NUM]) d[k] = m[k] == null ? '' : String(m[k])
  return d
}

const editInput = 'rounded-lg border border-primary-container/50 bg-surface-container-lowest px-2 py-1 text-[16px] font-normal text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/30 sm:text-[14px]'

type PromoRow = PromotionMerchant & { promotion: Pick<Promotion, 'id' | 'code' | 'name' | 'status' | 'discount_label'> | null }
type ContactLite = Pick<ContactLog, 'id' | 'code' | 'channel_label' | 'purpose' | 'content' | 'occurred_at' | 'needs_callback' | 'status'>

/** Everything the merchant "hub" summary cards need, fetched in one go. */
interface Hub {
  onboarding: Onboarding | null
  tickets: SupportTicket[]
  sub: Subscription | null
  invoice: Invoice | null
  contacts: ContactLite[]
  churn: ChurnRisk[]
  people: MerchantContact[]
  promos: PromoRow[]
}

async function loadHub(id: string): Promise<{ data: Hub | null; error: { message: string } | null }> {
  const r = await Promise.all([
    supabase.from('onboardings').select('*').eq('merchant_id', id).maybeSingle(),
    supabase.from('support_tickets').select('*').eq('merchant_id', id).order('updated_at', { ascending: false }),
    supabase.from('subscriptions').select('*').eq('merchant_id', id).eq('is_current', true).maybeSingle(),
    supabase.from('invoices').select('*').eq('merchant_id', id).order('issued_at', { ascending: false }).limit(1),
    supabase.from('contact_logs').select('id,code,channel_label,purpose,content,occurred_at,needs_callback,status').eq('merchant_id', id).order('occurred_at', { ascending: false }),
    supabase.from('churn_risks').select('*').eq('merchant_id', id).order('detected_at', { ascending: false }),
    supabase.from('merchant_contacts').select('*').eq('merchant_id', id).order('sort_order'),
    supabase.from('promotion_merchants').select('*, promotion:promotions(id,code,name,status,discount_label)').eq('merchant_id', id),
  ])
  const failed = r.find((x) => x.error)
  if (failed?.error) return { data: null, error: failed.error }
  const [onboarding, tickets, sub, invoices, contacts, churn, people, promos] = r.map((x) => x.data)
  return {
    data: {
      onboarding: (onboarding as Onboarding | null) ?? null,
      tickets: (tickets ?? []) as SupportTicket[],
      sub: (sub as Subscription | null) ?? null,
      invoice: ((invoices ?? []) as Invoice[])[0] ?? null,
      contacts: (contacts ?? []) as ContactLite[],
      churn: (churn ?? []) as ChurnRisk[],
      people: (people ?? []) as MerchantContact[],
      promos: (promos ?? []) as PromoRow[],
    },
    error: null,
  }
}

const OPEN_TICKET = ['new', 'processing', 'waiting_merchant']
const TICKET_TONE: Record<string, Tone> = { new: 'danger', processing: 'warning', waiting_merchant: 'info', resolved: 'success', closed: 'neutral' }
const RISK_TONE: Record<ChurnRisk['risk_level'], Tone> = { critical: 'danger', high: 'warning', medium: 'info' }

export default function MerchantDetail() {
  const { id } = useParams()
  const toast = useToast()

  const merchantQ = useQuery<MerchantWithStaff>(
    () => supabase.from('merchants').select('*, account_manager:staff!account_manager_id(*), created_by:staff!created_by_id(*)').eq('id', id!).single(),
    [id],
  )
  const hubQ = useQuery<Hub>(() => loadHub(id!), [id])
  const activityQ = useQuery<ActivityLog[]>(
    () => supabase.from('activity_logs').select('*').eq('merchant_id', id!).order('occurred_at', { ascending: false }).limit(3),
    [id],
  )

  const m = merchantQ.data
  useBreadcrumb(m ? [{ label: 'Hồ sơ Merchant', to: ROUTES.merchants }, `${m.name} (${hashCode(m.code)})`] : null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useDismiss(menuRef, menuOpen, closeMenu)

  if (merchantQ.loading && !m) return <Loading />
  if (merchantQ.error || !m) return <div className="px-margin py-space-lg"><ErrorState message={merchantQ.error ?? 'Không tìm thấy merchant.'} onRetry={merchantQ.reload} /></div>

  const meta = merchantStatus(m.status)
  const d = draft ?? draftFrom(m)
  const setField = (k: EditKey, v: string) => setDraft({ ...d, [k]: v })
  const contractDays = daysUntil(m.contract_end)
  const copy = (text: string, msg: string) => navigator.clipboard?.writeText(text).then(() => toast(msg), () => toast('Không sao chép được'))

  /** Render text, or an <input> when editing. */
  const ed = (k: EditKey, opts: { type?: string; className?: string; placeholder?: string; display?: string } = {}) =>
    editing ? (
      <input type={opts.type ?? 'text'} step={opts.type === 'number' ? '0.1' : undefined} value={d[k]} placeholder={opts.placeholder}
        onChange={(e) => setField(k, e.target.value)} className={`${editInput} w-full min-w-0 ${opts.className ?? ''}`} />
    ) : (
      <>{opts.display ?? (m[k] == null || m[k] === '' ? '—' : String(m[k]))}</>
    )

  async function changeStatus(next: MerchantStatus) {
    setMenuOpen(false)
    if (!m || next === m.status) return
    const { error } = await supabase.from('merchants').update({ status: next }).eq('id', m.id)
    if (error) return toast(`Không cập nhật được trạng thái: ${error.message}`)
    toast(`Đã chuyển trạng thái → ${merchantStatus(next).label}`)
    merchantQ.reload()
  }

  async function save() {
    if (!m || !draft) return
    if (!draft.name.trim()) return toast('Tên merchant không được để trống')
    setSaving(true)
    const payload: Record<string, string | number | null> = {}
    for (const k of EDIT_TEXT) payload[k] = draft[k].trim() || null
    payload.name = draft.name.trim()
    payload.phone = draft.phone.trim() || m.phone
    for (const k of EDIT_NUM) {
      const n = parseFloat(draft[k])
      payload[k] = isNaN(n) ? null : n
    }
    const { error } = await supabase.from('merchants').update(payload).eq('id', m.id)
    setSaving(false)
    if (error) return toast(`Không lưu được: ${error.message}`)
    toast('Đã lưu thay đổi hồ sơ')
    setEditing(false)
    setDraft(null)
    merchantQ.reload()
  }

  const startEdit = () => { setDraft(draftFrom(m)); setEditing(true) }
  const cancelEdit = () => { setDraft(null); setEditing(false) }

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.address_full ?? m.address)}`
  const hub = hubQ.data
  const contactCount = hub?.contacts.length ?? 0
  const am = m.account_manager
  const activities = activityQ.data ?? []

  const btnBase = 'inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 font-label-lg transition-all'

  return (
    <div className="flex w-full flex-col gap-space-lg px-margin py-space-lg">
      {/* Top action bar */}
      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest px-space-md py-space-md shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-space-xl">
        <div className="flex flex-wrap items-center gap-space-md">
          <Link to={ROUTES.merchants} className={`group bg-surface-container text-on-surface shadow-sm hover:bg-surface-container-high ${btnBase}`}>
            <Icon name="arrow_back" className="text-[20px] text-primary-container transition-transform group-hover:-translate-x-0.5" />
            <span>Quay lại danh sách</span>
          </Link>
          <span className="font-headline-md font-bold text-primary-container">{hashCode(m.code)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm max-sm:[&>*]:flex-1">
          <div className="hidden items-center gap-2 whitespace-nowrap rounded-lg bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-secondary xl:flex">
            <Icon name="check_circle" className="text-[18px] text-tertiary" />
            <span>Đã đồng bộ CRM: {merchantQ.loading ? 'Đang tải...' : 'Vừa xong'}</span>
          </div>
          <button type="button" onClick={editing ? cancelEdit : startEdit}
            className={`bg-surface-container text-on-surface shadow-sm hover:bg-surface-container-high ${btnBase}`}>
            <Icon name={editing ? 'close' : 'edit_note'} className="text-[20px]" />
            <span>{editing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa hồ sơ'}</span>
          </button>
          <button type="button" onClick={save} disabled={!editing || saving}
            className={`bg-primary-container text-on-primary shadow-[0_4px_16px_rgba(255,91,0,0.3)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${btnBase}`}>
            <Icon name="save" className="text-[20px]" />
            <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="relative rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"><div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-container/5 blur-3xl" /></div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-space-lg xl:flex-row xl:gap-space-xl">
          <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:gap-6">
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-surface-container shadow-md sm:h-32 sm:w-32">
              {m.cover_url || m.image_url ? (
                <img className="h-full w-full object-cover" alt={m.name} src={(m.cover_url ?? m.image_url)!} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[48px]">{m.emoji ?? <Icon name={m.icon ?? 'storefront'} className="text-[48px] text-primary" />}</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-on-background/80 to-transparent p-1.5 text-center">
                <span className="font-label-sm text-[10px] uppercase tracking-wider text-surface-container-lowest">F&amp;B {m.region}</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="rounded-lg bg-primary-container/10 px-3.5 py-1 font-headline-md text-headline-md font-bold tracking-tight text-primary-container">{hashCode(m.code)}</span>
                {m.branch_type && <span className="rounded-full bg-surface-container px-3 py-1 font-label-sm uppercase tracking-wide text-secondary">{m.branch_type}</span>}
                {m.partner_tier && (
                  <span className="flex items-center gap-1.5 rounded-full bg-tertiary/10 px-3 py-1 font-label-sm font-semibold text-tertiary">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" />
                    {m.partner_tier}
                  </span>
                )}
              </div>
              <h1 className="mt-1 min-w-0 break-words font-headline-xl text-[24px] font-bold tracking-tight text-on-surface sm:text-headline-xl">{editing ? ed('name', { className: '!text-[20px] font-bold' }) : m.name}</h1>
              <div className="flex flex-col gap-1 font-body-lg text-body-lg text-secondary sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon name={m.icon ?? 'storefront'} className="text-[20px] text-primary-container" />
                  <span className="font-semibold text-on-surface">Phân loại:</span> <span className="min-w-0 flex-1">{ed('category')}</span>
                </span>
                {m.business_license && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="verified" className="text-[20px] text-tertiary" />
                    Đã xác thực giấy phép KD ({m.business_license})
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-container-low px-3.5 py-2 font-body-md text-body-md text-secondary">
                <Icon name="calendar_today" className="text-[18px] text-secondary" />
                <span>Ngày tạo hồ sơ: <strong className="text-on-surface">{formatDateTime(m.created_at)}</strong></span>
                {m.created_by && (
                  <>
                    <span className="hidden text-outline-variant sm:inline">•</span>
                    <span>Bởi Chuyên viên Onboarding: <strong className="text-on-surface">{m.created_by.full_name}</strong> (ID: {m.created_by.code})</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-shrink-0 flex-col items-stretch gap-space-lg xl:w-auto xl:items-end">
            <div className="flex flex-col items-start gap-1.5 xl:items-end">
              <span className="font-label-sm uppercase tracking-wider text-secondary">Trạng thái vận hành hiện tại</span>
              <div className="relative inline-block text-left" ref={menuRef}>
                <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={menuOpen}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-5 py-2.5 font-label-lg text-label-lg shadow-sm transition-all ${meta.pill}`}>
                  <span className={`h-3 w-3 rounded-full ring-4 ${meta.pillDot}`} />
                  <span className="text-[15px] font-bold">{meta.label}</span>
                  <span className="material-symbols-outlined text-[22px] transition-transform duration-200" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }}>arrow_drop_down</span>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 z-50 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-xl bg-surface-container-lowest p-2 shadow-2xl xl:left-auto xl:right-0">
                    {MERCHANT_STATUSES.map((s) => (
                      <button key={s.value} type="button" onClick={() => changeStatus(s.value)}
                        className={`flex min-h-[40px] w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left transition-all hover:bg-surface-container ${s.value === m.status ? 'bg-surface-container/60' : ''}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                          <span className={`font-label-lg text-[14px] ${s.text} ${s.value === m.status ? 'font-bold' : ''}`}>{s.label}</span>
                        </div>
                        {s.value === m.status ? <Icon name="check" className={`text-[18px] ${s.text}`} /> : s.hint && <span className={`font-label-sm text-[11px] ${s.value === 'stopped' ? 'text-error' : 'text-secondary'}`}>{s.hint}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link to={contactsPath(m.code)}
                className="group flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-2.5 shadow-sm transition-all duration-200 hover:bg-primary-container hover:text-on-primary">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary-container shadow-sm transition-colors group-hover:bg-on-primary">
                  <Icon name="ring_volume" className="text-[20px]" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="font-label-lg text-[13px] font-bold leading-tight">Xem lịch sử liên hệ</span>
                  <span className="font-label-sm text-[11px] leading-tight text-secondary group-hover:text-on-primary/90">({hubQ.loading && !hub ? '…' : formatNumber(contactCount)} lượt liên hệ)</span>
                </div>
                <Icon name="open_in_new" className="text-[18px] transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to={activityPath(m.id)}
                className="group flex items-center gap-3 rounded-xl border border-surface-container-high bg-surface-container px-4 py-2.5 shadow-sm transition-all duration-200 hover:border-primary-container hover:bg-primary-container hover:text-on-primary">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary-container shadow-sm transition-colors group-hover:bg-on-primary">
                  <Icon name="history" className="text-[20px]" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="font-label-lg text-[13px] font-bold leading-tight">Xem lịch sử hoạt động</span>
                  <span className="font-label-sm text-[11px] leading-tight text-secondary group-hover:text-on-primary/90">(Nhật ký thao tác &amp; đơn)</span>
                </div>
                <Icon name="arrow_forward" className="text-[18px] transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hub: everything about this merchant, one card per module */}
      <HubSection m={m} hub={hub} loading={hubQ.loading && !hub} error={hubQ.error} onRetry={hubQ.reload} />

      {/* Main grid */}
      <div className="grid w-full grid-cols-1 gap-space-lg lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-space-lg lg:col-span-2">
          {/* Contact card */}
          <Card icon="contact_phone" iconBox="bg-primary-container/10 text-primary-container" title="Người liên hệ & Thông tin liên lạc"
            subtitle="Đại diện pháp luật cơ sở F&B và kênh tiếp nhận hỗ trợ đơn hàng"
            badge={<span className="rounded-full bg-surface-container px-3 py-1 font-label-sm font-semibold text-on-surface">Ưu tiên liên hệ: SĐT chính</span>}>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 sm:gap-y-6">
              <Cell icon="badge" iconCls="text-primary-container" label="Người liên hệ (Đại diện cơ sở)">
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="min-w-0 break-words font-headline-lg text-headline-lg font-bold text-on-surface">{ed('contact_name', { className: '!text-[18px]' })}</span>
                  {m.contact_verified && <span className="rounded bg-tertiary/10 px-2 py-0.5 font-label-sm font-semibold text-tertiary">Đã xác minh CCCD</span>}
                </div>
                <p className="mt-0.5 font-body-md text-body-md text-secondary">{ed('contact_title')}</p>
              </Cell>
              <Cell icon="call" iconCls="text-tertiary" label="Số điện thoại Hotline / Zalo">
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-headline-lg text-headline-lg font-bold tracking-tight text-primary-container">{ed('phone', { className: '!text-[18px]' })}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" title="Sao chép SĐT" aria-label="Sao chép SĐT" onClick={() => copy(m.phone, `Đã sao chép SĐT: ${m.phone}`)}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-surface-container-lowest p-2 text-secondary shadow-sm transition-all hover:bg-primary-container hover:text-on-primary">
                      <Icon name="content_copy" className="text-[18px]" />
                    </button>
                    <a href={`tel:${m.phone.replace(/\s/g, '')}`} className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-tertiary px-3 py-1.5 font-label-md text-label-md text-on-tertiary shadow-sm transition-all hover:opacity-90">
                      <Icon name="call" className="text-[18px]" />
                      <span>Gọi điện</span>
                    </a>
                  </div>
                </div>
                {m.call_hours && <p className="mt-0.5 font-body-md text-body-md text-secondary">Thời gian nghe máy phản hồi tốt: {m.call_hours}</p>}
              </Cell>
              <Cell icon="alternate_email" iconCls="text-primary-container" label="Email nhận hóa đơn & đối soát">
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 select-all break-all font-body-lg text-body-lg font-bold text-on-surface">{ed('email', { type: 'email' })}</span>
                  {m.email && !editing && (
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <a title="Gửi email" aria-label="Gửi email" href={`mailto:${m.email}?subject=${encodeURIComponent(`[Giaodoan] Trao đổi với ${m.name}`)}&body=${encodeURIComponent(`Chào ${m.contact_name ?? 'anh/chị'},\n\n`)}`}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-surface-container-lowest p-1.5 text-secondary transition-colors hover:text-primary-container">
                        <Icon name="mail" className="text-[18px]" />
                      </a>
                      <button type="button" title="Sao chép Email" aria-label="Sao chép Email" onClick={() => copy(m.email!, 'Đã sao chép Email')}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-surface-container-lowest p-1.5 text-secondary transition-colors hover:text-primary-container">
                        <Icon name="content_copy" className="text-[18px]" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-0.5 break-all font-body-md text-body-md text-secondary">Email cá nhân quản lý: {ed('personal_email', { type: 'email' })}</p>
              </Cell>
              <Cell icon="chat" iconCls="text-tertiary" label="Kênh nhắn tin tức thời">
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-body-lg text-body-lg font-bold text-on-surface">{m.zalo_group ? `Nhóm Zalo: ${m.zalo_group}` : 'Chưa kết nối nhóm Zalo'}</span>
                  {m.zalo_group && <span className="rounded bg-tertiary-container/20 px-2.5 py-1 font-label-sm font-semibold text-on-tertiary-container">Đã kết nối</span>}
                </div>
                {m.zalo_group_note && <p className="mt-0.5 font-body-md text-body-md text-secondary">{m.zalo_group_note}</p>}
              </Cell>
            </div>
            {hub && hub.people.length > 0 && (
              <div className="rounded-xl bg-surface-container-low p-4">
                <span className="font-label-sm uppercase tracking-wider text-secondary">Đầu mối liên hệ khác ({hub.people.length})</span>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {hub.people.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-[14px]">
                      <span className="min-w-0 truncate"><strong className="text-on-surface">{p.full_name}</strong>{p.title ? <span className="text-secondary"> · {p.title}</span> : null}</span>
                      {p.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="flex-shrink-0 font-semibold text-primary-container hover:underline">{p.phone}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Address card */}
          <Card icon="location_on" iconBox="bg-tertiary/10 text-tertiary" title="Địa chỉ cơ sở & Bán kính giao hàng"
            subtitle="Điểm lấy hàng chuẩn cho đội ngũ tài xế Giaodoan Express"
            badge={m.area_label ? <span className="rounded-full bg-surface-container px-3 py-1 font-label-sm font-semibold text-secondary">Khu vực: {m.area_label}</span> : undefined}>
            <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl bg-surface-container-low p-4 sm:p-5 md:flex-row md:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-md">
                  <Icon name="store" className="text-[28px]" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-label-sm uppercase tracking-wider text-secondary">Địa chỉ kinh doanh chính thức:</span>
                  <div className="break-words font-headline-md text-headline-md font-bold leading-snug text-on-surface">{ed('address_full')}</div>
                  {m.lat != null && m.lng != null && (
                    <div className="mt-1 flex items-center gap-4 text-body-md text-secondary">
                      <span>Toạ độ GPS: <strong className="text-on-surface">{m.lat.toFixed(5)}° N, {m.lng.toFixed(5)}° E</strong></span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                <a href={mapsHref} target="_blank" rel="noreferrer"
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg bg-surface-container-lowest px-4 py-2.5 font-label-md text-label-md text-on-surface shadow-sm transition-all hover:bg-primary-container hover:text-on-primary">
                  <Icon name="map" className="text-[18px] text-primary-container" />
                  <span>Mở Google Maps</span>
                </a>
                <button type="button" onClick={() => copy(m.address_full ?? m.address, 'Đã sao chép địa chỉ!')}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg bg-surface-container px-4 py-2 font-label-sm text-label-sm text-secondary transition-all hover:bg-surface-container-high">
                  <Icon name="content_copy" className="text-[16px]" />
                  <span>Sao chép địa chỉ</span>
                </button>
              </div>
            </div>
            <div className="relative h-56 w-full overflow-hidden rounded-xl bg-surface-container shadow-sm sm:h-64"
              style={m.map_url ? { backgroundImage: `url('${m.map_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-xl bg-surface-container-lowest/90 px-4 py-2.5 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-auto">
                <Icon name="pin_drop" className="flex-shrink-0 text-[24px] text-primary-container" />
                <div className="min-w-0">
                  <p className="font-label-lg text-[14px] font-bold text-on-surface">Bán kính giao hàng tối ưu: {ed('delivery_radius_km', { type: 'number', className: '!w-20', display: m.delivery_radius_km != null ? `${m.delivery_radius_km} km` : '—' })}{editing && ' km'}</p>
                  {m.pickup_time_label && <p className="font-body-sm text-[12px] text-secondary">Thời gian tài xế có mặt trung bình: {m.pickup_time_label}</p>}
                </div>
              </div>
              <div className="absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-surface-container-lowest/90 px-3 py-1.5 shadow-sm backdrop-blur-md sm:right-4 sm:top-4">
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${m.is_open ? 'animate-ping bg-tertiary' : 'bg-error'}`} />
                <span className="truncate font-label-sm text-[11px] font-semibold text-on-surface">{m.is_open ? 'Cửa hàng đang mở cửa nhận đơn' : 'Cửa hàng đang tạm ngưng nhận đơn'}</span>
              </div>
            </div>
          </Card>

          {/* Stats card */}
          <Card icon="analytics" iconBox="bg-primary-container/10 text-primary-container" title="Chỉ số vận hành & Kinh doanh F&B"
            subtitle="Thống kê 30 ngày gần nhất trên nền tảng Giaodoan"
            badge={<span className="font-label-sm text-secondary">Cập nhật: {relativeTime(m.stats_updated_at)}</span>}>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
              <Stat label="Doanh thu tháng (GMV)" value={formatVnd(m.gmv_month_vnd)} valueCls="text-primary"
                foot={m.gmv_growth_pct != null && <span className={`flex items-center gap-1 ${m.gmv_growth_pct >= 0 ? 'text-tertiary' : 'text-error'}`}><Icon name={m.gmv_growth_pct >= 0 ? 'trending_up' : 'trending_down'} className="text-[16px]" /> {m.gmv_growth_pct >= 0 ? '+' : ''}{m.gmv_growth_pct}% so tháng trước</span>} />
              <Stat label="Tổng đơn hàng giao" value={m.orders_month != null ? `${formatNumber(m.orders_month)} đơn` : '—'}
                foot={m.completion_rate_pct != null && <span className="flex items-center gap-1 text-tertiary"><Icon name="check_circle" className="text-[16px]" /> Tỉ lệ hoàn tất {m.completion_rate_pct}%</span>} />
              <Stat label="Giá trị đơn TB (AOV)" value={formatVnd(m.aov_vnd)} foot={m.best_seller && <span className="text-secondary">Món bán chạy: {m.best_seller}</span>} />
              <Stat label="Thời gian chuẩn bị món" value={m.prep_time_min != null ? `${m.prep_time_min} phút` : '—'} valueCls="text-tertiary"
                foot={m.prep_time_min != null && m.prep_time_min <= 8 && <span className="flex items-center gap-1 text-tertiary"><Icon name="bolt" className="text-[16px]" /> Xuất sắc trong phân khúc</span>} />
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-space-lg">
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-space-xs">
              <span className="font-label-sm uppercase tracking-wider text-secondary">Nhân sự phụ trách nội bộ</span>
              {am?.team && <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-[11px] text-secondary">{am.team}</span>}
            </div>
            {am ? (
              <>
                <div className="mt-1 flex items-center gap-3.5">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary-container font-headline-md text-headline-md text-on-primary shadow-sm ring-2 ring-primary-container/20">{initials(am.full_name)}</div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-headline-md text-headline-md font-bold text-on-surface">{am.full_name}</span>
                    <span className="font-body-md text-body-md text-secondary">{am.title}</span>
                    {am.email && <span className="mt-0.5 flex min-w-0 items-center gap-1 font-label-sm text-primary-container"><Icon name="mail" className="text-[15px]" /> <span className="truncate">{am.email}</span></span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-low p-3 text-body-md text-secondary">
                  <span>SĐT nội bộ: <strong className="text-on-surface">{am.ext ? `Ext ${am.ext}` : ''}{am.phone ? ` (${am.phone})` : ''}</strong></span>
                  {am.email && (
                    <a href={`mailto:${am.email}?subject=${encodeURIComponent(`[Merchant ${hashCode(m.code)}] ${m.name}`)}`} className="flex min-h-[40px] items-center font-label-sm font-semibold text-primary-container hover:underline">Nhắn tin</a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[14px] text-secondary">Chưa phân công nhân sự phụ trách.</p>
            )}
          </div>

          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-space-xs">
              <span className="font-label-sm uppercase tracking-wider text-secondary">Gói dịch vụ &amp; Chiết khấu</span>
              <span className="rounded bg-tertiary/15 px-2 py-0.5 font-label-sm text-[11px] font-bold text-tertiary">Hợp đồng điện tử</span>
            </div>
            <div className="mt-1 flex flex-col gap-3">
              <Row label="Mức chiết khấu đơn (Take-rate):">
                <span className="font-headline-md text-headline-md font-bold text-primary">{ed('take_rate_pct', { type: 'number', className: '!w-24', display: m.take_rate_pct != null ? `${m.take_rate_pct}%` : '—' })}</span>
              </Row>
              <Row label="Kỳ đối soát & Thanh toán:"><span className="text-right font-label-lg font-bold text-on-surface">{ed('payout_schedule')}</span></Row>
              <Row label="Tài khoản thụ hưởng:"><span className="break-all text-right font-label-lg font-bold text-on-surface">{ed('bank_account')}</span></Row>
              <Row label="Hạn hợp đồng hiện tại:">
                <span className="text-right font-label-lg font-bold text-on-surface">
                  {editing ? ed('contract_end', { type: 'date' }) : m.contract_end ? `${formatDate(m.contract_end)}${contractDays !== null ? (contractDays >= 0 ? ` (Còn ${contractDays} ngày)` : ' (Đã hết hạn)') : ''}` : '—'}
                </span>
              </Row>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link to={subscriptionPath(m.id)} className="flex min-h-[40px] items-center justify-center rounded-lg bg-surface-container px-3 py-2.5 text-center font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high">
                Hồ sơ hợp đồng &amp; gói
              </Link>
              <Link to={invoicePath(m.id, hub?.invoice?.number)} className="flex min-h-[40px] items-center justify-center rounded-lg bg-surface-container px-3 py-2.5 text-center font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high">
                Xem hóa đơn
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-space-md rounded-xl border border-surface-container bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-xs">
              <div className="flex items-center gap-2">
                <Icon name="history" className="text-[20px] text-primary-container" />
                <span className="font-label-sm font-bold uppercase tracking-wider text-on-surface">Lịch sử hoạt động gần đây</span>
              </div>
            </div>
            <div className="mt-1 flex flex-col gap-3">
              {activityQ.loading && !activityQ.data ? <Loading label="Đang tải..." /> : activityQ.error ? (
                <ErrorState message={activityQ.error} onRetry={activityQ.reload} />
              ) : activities.length === 0 ? (
                <p className="text-[13px] text-secondary">Chưa có hoạt động nào.</p>
              ) : activities.map((a) => (
                <Link key={a.id} to={activityPath(m.id)} className="flex items-start gap-3 rounded-lg bg-surface-container-low p-2.5 transition-colors hover:bg-surface-container">
                  <Icon name={a.icon ?? 'history'} className={`mt-0.5 flex-shrink-0 text-[18px] ${a.status === 'success' ? 'text-tertiary' : a.status === 'failed' ? 'text-error' : 'text-primary-container'}`} />
                  <div className="flex min-w-0 flex-1 flex-col text-left">
                    <p className="truncate font-label-md text-[13px] font-semibold text-on-surface">{a.action_label}</p>
                    <span className="font-body-sm text-[11px] text-secondary">{relativeTime(a.occurred_at)}{a.actor_name ? ` • ${a.actor_name}` : ''}</span>
                  </div>
                </Link>
              ))}
            </div>
            <Link to={activityPath(m.id)} className="flex min-h-[40px] items-center justify-center gap-1 pt-1 font-label-md text-[13px] font-semibold text-primary-container hover:underline">
              Xem toàn bộ lịch sử hoạt động <Icon name="arrow_forward" className="text-[16px]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Hub summary cards ---------- */

function HubSection({ m, hub, loading, error, onRetry }: { m: MerchantWithStaff; hub: Hub | null; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) return <Loading label="Đang tải liên kết hồ sơ..." />
  if (error || !hub) return <ErrorState message={error ?? 'Không tải được dữ liệu liên quan.'} onRetry={onRetry} />

  const { onboarding, tickets, sub, invoice, contacts, churn, promos } = hub
  const openTickets = tickets.filter((t) => OPEN_TICKET.includes(t.status))
  const shownTickets = [...openTickets, ...tickets.filter((t) => !OPEN_TICKET.includes(t.status))].slice(0, 3)
  const openRisks = churn.filter((c) => !c.handled)
  const callbacks = contacts.filter((c) => c.needs_callback).length
  const subDays = sub ? daysUntil(sub.end_date) : null
  const subState = expiryState(subDays)
  const stepsDone = onboarding ? Math.min(5, onboarding.steps_done) : 0
  const nextStep = onboarding && stepsDone < 5 ? ONBOARDING_STEPS[stepsDone] : null

  return (
    <section aria-label="Liên kết hồ sơ" className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
      <HubCard icon="rocket_launch" title="Onboarding" to={onboarding ? onboardingPath(m.id) : undefined} linkLabel="Xem tiến độ">
        {onboarding ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-headline-lg text-[22px] font-bold text-on-surface">{stepsDone}/5 bước</span>
              <StatusBadge tone={stepsDone >= 5 ? 'success' : 'primary'}>{stepsDone >= 5 ? 'Hoàn thành' : 'Đang thực hiện'}</StatusBadge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary-container" style={{ width: `${(stepsDone / 5) * 100}%` }} />
            </div>
            <p className="text-[13px] text-secondary">
              {nextStep ? <>Bước tiếp theo: <strong className="text-on-surface">{nextStep.title}</strong></> : 'Đã sẵn sàng mở bán.'}
              {onboarding.go_live_date ? <> · Go-live {formatDate(onboarding.go_live_date)}</> : null}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-secondary">Merchant chưa có hồ sơ onboarding.</p>
        )}
      </HubCard>

      <HubCard icon="headset_mic" title="Yêu cầu hỗ trợ" to={ROUTES.support} linkLabel="Tất cả yêu cầu" badge={openTickets.length > 0 ? <StatusBadge tone="danger">{openTickets.length} đang mở</StatusBadge> : undefined}>
        {shownTickets.length === 0 ? (
          <p className="text-[13px] text-secondary">Chưa có yêu cầu hỗ trợ nào.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-container">
            {shownTickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <Link to={supportPath(t.id)} className="-my-1 block truncate py-1 text-[14px] font-semibold text-on-surface hover:text-primary hover:underline">
                    <span className="text-primary">#{t.code}</span> {t.subject ?? 'Yêu cầu hỗ trợ'}
                  </Link>
                  <span className="text-[12px] text-secondary">{relativeTime(t.updated_at)}</span>
                </div>
                <StatusBadge tone={TICKET_TONE[t.status] ?? 'neutral'} className="flex-shrink-0">{TICKET_STATUSES[t.status]}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
        <Link to={newPath('support')} className="-my-1 py-2 text-[13px] font-semibold text-primary hover:underline">+ Tạo yêu cầu hỗ trợ mới</Link>
      </HubCard>

      <HubCard icon="workspace_premium" title="Gói dịch vụ & hóa đơn" to={subscriptionPath(m.id)} linkLabel="Xem hợp đồng">
        {sub ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-on-surface">{sub.plan_name}</p>
                <Link to={subscriptionPath(m.id)} className="text-[13px] font-semibold text-primary hover:underline">#{sub.code}</Link>
                <span className="text-[13px] text-secondary"> · {sub.cycle_label ?? `${sub.cycle_months ?? '—'} tháng`} · {formatVnd(sub.amount_vnd)}</span>
              </div>
              <StatusBadge tone={subState === 'ok' ? 'success' : subState === 'soon' ? 'warning' : 'danger'} className="flex-shrink-0">
                {subDays === null ? '—' : subDays >= 0 ? `Còn ${subDays} ngày` : 'Đã hết hạn'}
              </StatusBadge>
            </div>
            <p className="text-[13px] text-secondary">Hiệu lực {formatDate(sub.start_date)} → {formatDate(sub.end_date)}{sub.auto_renew ? ' · Tự động gia hạn' : ''}</p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-secondary">Merchant chưa có gói dịch vụ đang hiệu lực.</p>
            <Link to={newPath('subscriptions')} className="text-[13px] font-semibold text-primary hover:underline">+ Đăng ký gói</Link>
          </>
        )}
        {invoice ? (
          <p className="flex flex-wrap items-center gap-x-1.5 border-t border-surface-container pt-2 text-[13px] text-secondary">
            Hóa đơn gần nhất:
            <Link to={invoicePath(m.id, invoice.number)} className="font-bold text-primary hover:underline">#{invoice.number}</Link>
            · {formatVnd(invoice.total_vnd)}
            <StatusBadge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'pending' ? 'warning' : 'neutral'}>{invoice.status === 'paid' ? 'Đã thanh toán' : invoice.status === 'pending' ? 'Chờ thanh toán' : 'Đã hủy'}</StatusBadge>
          </p>
        ) : (
          <p className="border-t border-surface-container pt-2 text-[13px] text-secondary">Chưa có hóa đơn nào.</p>
        )}
      </HubCard>

      <HubCard icon="call" title="Lịch sử liên hệ" to={contactsPath(m.code)} linkLabel="Xem tất cả" badge={callbacks > 0 ? <StatusBadge tone="warning">{callbacks} cần gọi lại</StatusBadge> : undefined}>
        {contacts.length === 0 ? (
          <p className="text-[13px] text-secondary">Chưa có lượt liên hệ nào.</p>
        ) : (
          <>
            <p className="text-[13px] text-secondary"><strong className="text-on-surface">{formatNumber(contacts.length)}</strong> lượt liên hệ · gần nhất {relativeTime(contacts[0].occurred_at)}</p>
            <ul className="flex flex-col divide-y divide-surface-container">
              {contacts.slice(0, 3).map((c) => (
                <li key={c.id} className="py-1.5">
                  <Link to={contactsPath(m.code)} className="-my-1 block truncate py-1 text-[14px] font-semibold text-on-surface hover:text-primary hover:underline">{c.purpose ?? c.channel_label ?? 'Liên hệ'}</Link>
                  <p className="truncate text-[12px] text-secondary">{c.channel_label ?? 'Liên hệ'} · {relativeTime(c.occurred_at)} · {c.content}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </HubCard>

      <HubCard icon="warning" title="Tín hiệu rời bỏ" to={churnPath()} linkLabel="Bảng nguy cơ" badge={openRisks.length > 0 ? <StatusBadge tone="danger">{openRisks.length} chưa xử lý</StatusBadge> : undefined}>
        {churn.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[13px] text-tertiary"><Icon name="check_circle" className="text-[18px]" /> Không có tín hiệu rời bỏ nào.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-container">
            {churn.slice(0, 3).map((c) => {
              const days = daysUntil(c.expires_on)
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <Link to={churnPath()} className="-my-1 block truncate py-1 text-[14px] font-semibold text-on-surface hover:text-primary hover:underline">{c.alert_text ?? RISK_TYPES[c.risk_type]}</Link>
                    <span className="text-[12px] text-secondary">
                      {RISK_TYPES[c.risk_type]}{c.expires_on && days !== null ? ` · ${days >= 0 ? `còn ${days} ngày` : `quá hạn ${-days} ngày`}` : ''}{c.handled ? ' · Đã xử lý' : ''}
                    </span>
                  </div>
                  <StatusBadge tone={c.handled ? 'neutral' : RISK_TONE[c.risk_level]} className="flex-shrink-0">{RISK_LEVELS[c.risk_level].replace(/ \(.*\)/, '')}</StatusBadge>
                </li>
              )
            })}
          </ul>
        )}
      </HubCard>

      <HubCard icon="sell" title="Chương trình khuyến mãi" to={promotionsPath()} linkLabel="Xem CTKM">
        {promos.length === 0 ? (
          <p className="text-[13px] text-secondary">Merchant chưa tham gia CTKM nào.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-container">
            {promos.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <Link to={promotionsPath()} className="-my-1 block truncate py-1 text-[14px] font-semibold text-on-surface hover:text-primary hover:underline">{p.promotion?.name ?? 'CTKM'}</Link>
                  <span className="text-[12px] text-secondary">{formatNumber(p.orders_count)} đơn · +{formatVnd(p.revenue_gain_vnd)}</span>
                </div>
                {p.promotion?.discount_label && <StatusBadge tone="primary" className="flex-shrink-0">{p.promotion.discount_label}</StatusBadge>}
              </li>
            ))}
          </ul>
        )}
      </HubCard>
    </section>
  )
}

function HubCard({ icon, title, to, linkLabel, badge, children }: { icon: string; title: string; to?: string; linkLabel?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 font-headline-md text-[16px] font-bold text-on-surface">
          <Icon name={icon} className="text-[22px] text-primary-container" />
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex flex-shrink-0 items-center gap-2">
          {badge}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
      {to && (
        <Link to={to} className="flex min-h-[40px] items-center gap-1 font-label-md text-[13px] font-bold text-primary hover:underline">
          {linkLabel ?? 'Xem tất cả'} <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      )}
    </div>
  )
}

function Card({ icon, iconBox, title, subtitle, badge, children }: { icon: string; iconBox: string; title: string; subtitle: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-xl">
      <div className="flex flex-col gap-2 border-b border-surface-container pb-space-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBox}`}><Icon name={icon} className="text-[24px]" /></div>
          <div className="min-w-0">
            <h2 className="font-headline-lg text-[18px] font-bold text-on-surface sm:text-headline-lg">{title}</h2>
            <p className="font-body-md text-body-md text-secondary">{subtitle}</p>
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

function Cell({ icon, iconCls, label, children }: { icon: string; iconCls: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
      <span className="flex items-center gap-1.5 font-label-sm uppercase tracking-wider text-secondary">
        <Icon name={icon} className={`text-[16px] ${iconCls}`} />
        {label}
      </span>
      {children}
    </div>
  )
}

function Stat({ label, value, valueCls = 'text-on-surface', foot }: { label: string; value: string; valueCls?: string; foot?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-surface-container-low p-3 sm:p-4">
      <span className="font-label-sm uppercase text-secondary">{label}</span>
      <span className={`break-words font-headline-xl text-[20px] font-bold sm:text-headline-xl ${valueCls}`}>{value}</span>
      <span className="mt-1 font-label-sm">{foot}</span>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <span className="font-body-md text-secondary">{label}</span>
      {children}
    </div>
  )
}
