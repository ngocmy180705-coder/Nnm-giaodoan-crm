import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import ResponsiveTable from '../components/ResponsiveTable'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, Loading } from '../components/Loading'
import { btnPrimary, btnSecondary } from '../components/Form'
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, merchantStatus } from '../lib/constants'
import { exportCsv } from '../lib/csv'
import { formatDate, formatDateTime, formatTime, hashCode, initials } from '../lib/format'
import { useBreadcrumb, useToast } from '../lib/layoutContext'
import { ROUTES, contactsPath, merchantPath, onboardingPath, subscriptionPath, supportPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { ReplyTemplate, Staff, Subscription, SupportTicket, TicketAttachment, TicketCategory, TicketMessage, TicketStatus } from '../lib/types'
import { useQuery } from '../lib/useQuery'
import { MERCHANT_LITE_COLS, MerchantAvatar, slaInfo, type MerchantLite } from './support/ticketUi'

type TicketFull = SupportTicket & { merchant: MerchantLite | null; assignee: Staff | null }
type AfterStatus = 'keep' | 'resolved' | 'waiting_merchant' | 'closed'
type Channel = TicketMessage['channel']
type TicketLite = Pick<SupportTicket, 'id' | 'code' | 'subject' | 'status'>
type SubLite = Pick<Subscription, 'id' | 'code' | 'plan_name' | 'end_date'>

const STATUS_ORDER: TicketStatus[] = ['new', 'processing', 'waiting_merchant', 'resolved', 'closed']
const STATUS_ICON: Partial<Record<TicketStatus, string>> = { processing: '⏳ ' }

const CHANNELS: Record<Channel, { select: string; label: string; icon: string; iconCls: string; pill: string }> = {
  app: { select: 'App Giaodoan Merchant (Thông báo đẩy)', label: 'App Merchant', icon: 'smartphone', iconCls: 'text-tertiary', pill: 'bg-surface-container' },
  zalo_sms: { select: 'Zalo ZNS / SMS số hotline', label: 'SMS / Zalo ZNS', icon: 'chat', iconCls: 'text-primary', pill: 'bg-surface-container-high' },
  email: { select: 'Email doanh nghiệp đối tác', label: 'Email', icon: 'mail', iconCls: 'text-primary', pill: 'bg-surface-container' },
  internal: { select: 'Chỉ ghi chú nội bộ (Không gửi đối tác)', label: 'Ghi chú nội bộ', icon: 'lock', iconCls: 'text-secondary', pill: 'bg-surface-container-high' },
}

const ATTACH_ICON: Record<TicketAttachment['kind'], { icon: string; box: string; text: string }> = {
  xlsx: { icon: 'description', box: 'bg-tertiary-container/20', text: 'text-tertiary' },
  pdf: { icon: 'picture_as_pdf', box: 'bg-error-container/40', text: 'text-error' },
  image: { icon: 'image', box: 'bg-primary-fixed', text: 'text-primary' },
  other: { icon: 'attach_file', box: 'bg-surface-container-high', text: 'text-secondary' },
}

const AVATAR_BG = ['bg-primary text-on-primary', 'bg-secondary text-on-secondary', 'bg-tertiary text-on-tertiary']
const avatarCls = (name: string | null) => AVATAR_BG[Array.from(name ?? '').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length]

function statusSelectCls(s: TicketStatus) {
  if (s === 'resolved') return 'bg-tertiary-container/30 text-tertiary'
  if (s === 'closed') return 'bg-surface-container-high text-secondary'
  return 'bg-primary-fixed/40 text-on-primary-fixed'
}

const selectBase =
  'min-h-10 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-low px-3 py-2 font-label-lg text-label-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container'

export default function SupportDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { settings } = useSettings()

  const ticketQ = useQuery<TicketFull>(
    () => supabase.from('support_tickets').select(`*, merchant:merchants(${MERCHANT_LITE_COLS}), assignee:staff!assignee_id(*)`).eq('id', id!).single(),
    [id],
  )
  const messagesQ = useQuery<TicketMessage[]>(() => supabase.from('ticket_messages').select('*').eq('ticket_id', id!).order('created_at', { ascending: true }), [id])
  const attachmentsQ = useQuery<TicketAttachment[]>(() => supabase.from('ticket_attachments').select('*').eq('ticket_id', id!).order('created_at'), [id])
  const templatesQ = useQuery<ReplyTemplate[]>(() => supabase.from('reply_templates').select('*').order('sort_order'), [])
  const staffQ = useQuery<Staff[]>(() => supabase.from('staff').select('*').order('code'), [])

  const t = ticketQ.data
  const merchantId = t?.merchant_id ?? null
  // Related data for the "Liên kết nhanh" card (only fetched once the ticket (and so the merchant) is known)
  const otherQ = useQuery<TicketLite[]>(
    () => merchantId ? supabase.from('support_tickets').select('id,code,subject,status').eq('merchant_id', merchantId).neq('id', id!).order('created_at', { ascending: false }).limit(4) : Promise.resolve({ data: [], error: null }),
    [merchantId, id],
  )
  const subQ = useQuery<SubLite | null>(
    () => merchantId ? supabase.from('subscriptions').select('id,code,plan_name,end_date').eq('merchant_id', merchantId).eq('is_current', true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    [merchantId],
  )
  const onbQ = useQuery<{ id: string; steps_done: number } | null>(
    () => merchantId ? supabase.from('onboardings').select('id,steps_done').eq('merchant_id', merchantId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    [merchantId],
  )
  useBreadcrumb(t ? [{ label: 'Yêu cầu hỗ trợ', to: ROUTES.support }, hashCode(t.code)] : null)

  // The signed-in operator is not modelled (no auth): replies as the operator name from Cài đặt, matched to a staff row when possible.
  const me = staffQ.data?.find((s) => s.full_name === settings.name) ?? staffQ.data?.find((s) => s.full_name === 'Nguyễn Văn A') ?? staffQ.data?.[0] ?? null

  const replyRef = useRef<HTMLDivElement>(null)
  const draftKey = `crm-ticket-draft-${id}`
  const [channel, setChannel] = useState<Channel>('app')
  const [templateId, setTemplateId] = useState('')
  const [afterStatus, setAfterStatus] = useState<AfterStatus>('keep')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { setContent(localStorage.getItem(draftKey) ?? '') }, [draftKey])

  if (ticketQ.loading && !t) return <Loading />
  if (ticketQ.error || !t) {
    return (
      <div className="flex flex-col gap-space-md px-margin py-space-lg">
        <ErrorState message={ticketQ.error ?? 'Không tìm thấy yêu cầu hỗ trợ.'} onRetry={ticketQ.reload} />
        <div className="flex justify-center"><Link to={ROUTES.support} className={btnSecondary}><Icon name="arrow_back" className="text-[20px]" />Quay lại danh sách</Link></div>
      </div>
    )
  }

  const m = t.merchant
  const messages = messagesQ.data ?? []
  const attachments = attachmentsQ.data ?? []
  const templates = templatesQ.data ?? []
  const staff = staffQ.data ?? []
  const mMeta = merchantStatus(m?.status)
  const sla = slaInfo(t)

  /** Patch the ticket and stamp "Cập nhật lần cuối". */
  async function patch(fields: Partial<SupportTicket>, okMsg: string): Promise<boolean> {
    const { error } = await supabase
      .from('support_tickets')
      .update({ ...fields, updated_at: new Date().toISOString(), updated_by: me?.full_name ?? t!.updated_by })
      .eq('id', t!.id)
    if (error) {
      toast(`Không cập nhật được: ${error.message}`)
      return false
    }
    toast(okMsg)
    ticketQ.reload()
    return true
  }

  const gotoReply = () => replyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  function closeTicket() {
    if (window.confirm(`Đóng ticket ${hashCode(t!.code)}? Yêu cầu sẽ chuyển sang trạng thái "Đã đóng".`)) patch({ status: 'closed' }, `Đã đóng ticket ${hashCode(t!.code)}`)
  }

  function pickTemplate(tid: string) {
    setTemplateId(tid)
    const tpl = templates.find((x) => x.id === tid)
    if (tpl) setContent(tpl.body)
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = content.trim()
    if (!text) return toast('Vui lòng nhập nội dung phản hồi')
    setSending(true)
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: t!.id,
      handler_id: me?.id ?? null,
      handler_name: me?.full_name ?? null,
      handler_role: me?.title ?? null,
      responder_name: me?.full_name ?? null,
      content: text,
      channel,
    })
    if (error) {
      setSending(false)
      return toast(`Không gửi được phản hồi: ${error.message}`)
    }
    const fields: Partial<SupportTicket> = {}
    if (afterStatus !== 'keep') fields.status = afterStatus
    if (channel !== 'internal' && !t!.responded_at) fields.responded_at = new Date().toISOString()
    if (Object.keys(fields).length) {
      const { error: upErr } = await supabase
        .from('support_tickets')
        .update({ ...fields, updated_at: new Date().toISOString(), updated_by: me?.full_name ?? t!.updated_by })
        .eq('id', t!.id)
      if (upErr) toast(`Đã lưu phản hồi nhưng chưa cập nhật được ticket: ${upErr.message}`)
      else toast(channel === 'internal' ? 'Đã lưu ghi chú nội bộ' : `Đã gửi phản hồi đến Merchant ${m?.name ?? ''}`)
    } else {
      toast(channel === 'internal' ? 'Đã lưu ghi chú nội bộ' : `Đã gửi phản hồi đến Merchant ${m?.name ?? ''}`)
    }
    localStorage.removeItem(draftKey)
    setContent('')
    setTemplateId('')
    setAfterStatus('keep')
    setSending(false)
    messagesQ.reload()
    ticketQ.reload()
  }

  function saveDraft() {
    if (content.trim()) {
      localStorage.setItem(draftKey, content)
      toast('Đã lưu bản nháp')
    } else {
      localStorage.removeItem(draftKey)
      toast('Chưa có nội dung để lưu')
    }
  }

  function exportTicket() {
    exportCsv(
      `phieu-${t!.code}.csv`,
      [
        { header: 'Mã yêu cầu', value: (x: TicketFull) => x.code },
        { header: 'Mã Merchant', value: (x) => x.merchant?.code },
        { header: 'Tên Merchant', value: (x) => x.merchant?.name },
        { header: 'Loại YCHT', value: (x) => TICKET_CATEGORIES[x.category].long },
        { header: 'Mức độ ưu tiên', value: (x) => TICKET_PRIORITIES[x.priority] },
        { header: 'Trạng thái', value: (x) => TICKET_STATUSES[x.status] },
        { header: 'Phụ trách', value: (x) => x.assignee?.full_name },
        { header: 'Tiêu đề', value: (x) => x.subject },
        { header: 'Nội dung', value: (x) => x.body },
        { header: 'Ngày tạo', value: (x) => formatDateTime(x.created_at) },
        { header: 'Phản hồi gần nhất', value: () => messages.map((x) => `${hashCode(x.code)} ${formatDateTime(x.created_at)} ${x.handler_name ?? ''}: ${x.content}`).join(' | ') },
      ],
      [t!],
    )
  }

  const priorityCls = t.priority === 'high' ? 'bg-error-container text-on-error-container' : t.priority === 'low' ? 'bg-surface-container-high text-secondary' : 'bg-primary-fixed text-on-primary-fixed-variant'
  const created = new Date(t.created_at)
  const pad = (n: number) => String(n).padStart(2, '0')
  const statusTone = t.status === 'resolved' ? 'success' : t.status === 'closed' ? 'neutral' : t.status === 'waiting_merchant' ? 'info' : 'warning'
  const others = otherQ.data ?? []
  const linkRow = 'flex min-h-10 items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 hover:bg-surface-container'

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        title={`Chi tiết yêu cầu ${hashCode(t.code)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge tone={statusTone}>{TICKET_STATUSES[t.status]}</StatusBadge>
            {m && <Link to={merchantPath(m.id)} className="font-semibold text-on-surface hover:text-primary hover:underline">{m.name}</Link>}
            <span className={`inline-flex items-center gap-1 text-[13px] ${sla.cls}`}><Icon name={sla.icon} className="text-[16px]" />{sla.text}</span>
          </span>
        }
        actions={
          <>
            <Link to={ROUTES.support} className={`${btnSecondary} max-sm:min-w-[45%]`}>
              <Icon name="arrow_back" className="text-[20px]" />
              <span>Quay lại</span>
            </Link>
            <button type="button" onClick={exportTicket} className={`${btnSecondary} max-sm:min-w-[45%]`}>
              <Icon name="file_download" className="text-[20px] text-secondary" />
              <span>Xuất phiếu</span>
            </button>
            <button type="button" disabled={t.status === 'closed'} onClick={closeTicket}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-error-container px-5 py-2.5 max-sm:min-w-[45%] font-label-lg text-[14px] font-semibold text-on-error-container shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50">
              <Icon name="cancel" className="text-[20px]" />
              <span>{t.status === 'closed' ? 'Ticket đã đóng' : 'Đóng ticket'}</span>
            </button>
            <button type="button" onClick={gotoReply} className={`${btnPrimary} max-sm:min-w-[45%]`}>
              <Icon name="reply" className="text-[20px]" />
              <span>Gửi phản hồi</span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
        {/* Request content */}
        <div className="flex min-w-0 flex-col gap-space-lg xl:col-span-8">
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <span className="h-6 w-2.5 rounded-full bg-primary-container" />
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Nội dung chi tiết yêu cầu hỗ trợ</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 font-label-md text-label-md text-secondary">
                <Icon name="schedule" className="text-[16px]" />
                <span>Gửi lúc {formatTime(created)}:{pad(created.getSeconds())} - {formatDate(created)}</span>
              </div>
            </div>
            <div className="break-words rounded-xl bg-surface-container-low p-space-md font-body-lg text-body-lg leading-relaxed text-on-surface shadow-inner">
              {t.subject && <p className="mb-2 font-label-lg text-label-lg font-bold text-primary">{t.subject}</p>}
              {t.body ? <p className="whitespace-pre-line">{t.body}</p> : <p className="text-secondary">Merchant không để lại nội dung chi tiết.</p>}
            </div>
            <div className="mt-1 flex flex-col gap-space-xs">
              <div className="flex items-center gap-2 font-label-lg text-label-lg text-secondary">
                <Icon name="attachment" className="text-[20px] text-primary" />
                <span>Tệp đính kèm từ Merchant ({attachments.length} tệp):</span>
              </div>
              {attachmentsQ.loading && !attachmentsQ.data ? (
                <Loading label="Đang tải tệp đính kèm..." />
              ) : attachments.length === 0 ? (
                <p className="text-[14px] text-secondary">Merchant không đính kèm tệp nào.</p>
              ) : (
                <div className="mt-1 grid grid-cols-1 gap-space-md md:grid-cols-2">
                  {attachments.map((a) => {
                    const ic = ATTACH_ICON[a.kind] ?? ATTACH_ICON.other
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-container-low p-space-md shadow-sm transition-colors hover:bg-surface-container">
                        <div className="flex min-w-0 items-center gap-space-sm">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ic.box}`}>
                            <Icon name={ic.icon} className={`text-[24px] ${ic.text}`} />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-label-lg text-label-lg text-on-surface">{a.file_name}</span>
                            <span className="font-body-sm text-body-sm text-secondary">{[a.size_label, a.kind_label].filter(Boolean).join(' • ')}</span>
                          </div>
                        </div>
                        {a.url ? (
                          <a href={a.url} target="_blank" rel="noreferrer" title="Tải xuống" aria-label={`Tải xuống ${a.file_name}`} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary-fixed/30">
                            <Icon name="download" className="text-[20px]" />
                          </a>
                        ) : (
                          <button type="button" disabled title="Tệp mẫu, chưa có đường dẫn tải xuống" aria-label="Chưa có đường dẫn tải xuống" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-secondary opacity-50">
                            <Icon name="download" className="text-[20px]" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Partner info & classification */}
        <div className="flex min-w-0 flex-col gap-space-md xl:col-span-4">
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
            <div className="flex items-center gap-space-sm pb-space-xs">
              <span className="h-6 w-2.5 rounded-full bg-primary-container" />
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Thông tin đối tác &amp; Phân loại</h2>
            </div>
            <div className="flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md">
              <MerchantAvatar m={m} className="h-16 w-16 rounded-xl" iconSize="text-[32px]" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  {m ? <Link to={merchantPath(m.id)} className="font-label-md text-label-md font-bold text-primary hover:underline">{hashCode(m.code)}</Link> : <span>—</span>}
                  <span className={`flex items-center gap-1 rounded border px-2 py-0.5 font-label-sm text-label-sm font-bold ${mMeta.select}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${mMeta.dot}`} />
                    {mMeta.label}
                  </span>
                </div>
                <h3 className="mt-0.5 truncate font-headline-md text-headline-md text-on-surface">
                  {m ? <Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">{m.name}</Link> : '—'}
                </h3>
                <p className="mt-0.5 flex items-center gap-1 font-body-sm text-body-sm text-secondary"><Icon name="location_on" className="text-[15px]" /><span className="min-w-0 truncate">{m?.address}</span></p>
                {m?.phone && <a href={`tel:${m.phone.replace(/\s/g, '')}`} className="mt-0.5 flex items-center gap-1 font-body-sm text-body-sm text-secondary hover:text-primary"><Icon name="call" className="text-[15px]" />{m.phone}</a>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-space-sm pt-space-xs sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="sd-category" className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Phân loại YCHT</label>
                <div className="relative">
                  <select id="sd-category" value={t.category} onChange={(e) => patch({ category: e.target.value as TicketCategory }, 'Đã cập nhật phân loại YCHT')} className={selectBase}>
                    {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => <option key={c} value={c}>{TICKET_CATEGORIES[c].long}</option>)}
                  </select>
                  <Icon name="arrow_drop_down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[20px] text-secondary" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="sd-priority" className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Mức độ ưu tiên</label>
                <div className="relative">
                  <select id="sd-priority" value={t.priority} onChange={(e) => patch({ priority: e.target.value as SupportTicket['priority'] }, 'Đã cập nhật mức độ ưu tiên')}
                    className={`min-h-10 w-full cursor-pointer appearance-none rounded-lg py-2 pl-9 pr-8 font-label-lg text-label-lg focus:outline-none focus:ring-2 focus:ring-primary-container ${priorityCls}`}>
                    <option value="high">{TICKET_PRIORITIES.high}</option>
                    <option value="normal">{TICKET_PRIORITIES.normal}</option>
                    <option value="low">{TICKET_PRIORITIES.low}</option>
                  </select>
                  <Icon name="priority_high" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px]" />
                  <Icon name="arrow_drop_down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[20px]" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-space-xs">
              <label htmlFor="sd-assignee" className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Nhân sự phụ trách</label>
              <div className="relative">
                <select id="sd-assignee" value={t.assignee_id ?? ''} onChange={(e) => patch({ assignee_id: e.target.value || null }, 'Đã cập nhật nhân sự phụ trách')} className={selectBase}>
                  <option value="">-- Chưa phân công --</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.title ? ` • ${s.title}` : ''}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[20px] text-secondary" />
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-space-xs">
              <label htmlFor="status-selector" className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Tiến độ xử lý hiện tại</label>
              <div className="relative">
                <select id="status-selector" value={t.status} onChange={(e) => patch({ status: e.target.value as TicketStatus }, `Đã chuyển trạng thái → ${TICKET_STATUSES[e.target.value as TicketStatus]}`)}
                  className={`min-h-11 w-full cursor-pointer appearance-none rounded-lg px-4 py-2.5 font-headline-md text-headline-md font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container ${statusSelectCls(t.status)}`}>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_ICON[s] ?? ''}{TICKET_STATUSES[s]}</option>)}
                </select>
                <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[24px]" />
              </div>
              <span className="mt-1 font-body-sm text-body-sm text-secondary">
                Cập nhật lần cuối: {formatDateTime(t.updated_at)}{t.updated_by ? ` bởi ${t.updated_by}` : ''}
              </span>
            </div>
          </div>

          {m && (
            <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
              <h4 className="flex items-center gap-2 font-headline-md text-headline-md text-on-surface"><Icon name="hub" className="text-primary" /> Liên kết nhanh</h4>
              <div className="flex flex-col gap-2 font-body-md text-body-md">
                <Link to={merchantPath(m.id)} className={linkRow}>
                  <span className="flex items-center gap-2"><Icon name="storefront" className="text-[20px] text-primary" /> Hồ sơ merchant</span>
                  <Icon name="chevron_right" className="text-[20px] text-secondary" />
                </Link>
                <Link to={subscriptionPath(m.id)} className={linkRow}>
                  <span className="flex min-w-0 items-center gap-2"><Icon name="workspace_premium" className="text-[20px] text-primary" /><span className="truncate">{subQ.data ? `${subQ.data.plan_name} · #${subQ.data.code} (đến ${formatDate(subQ.data.end_date)})` : 'Gói dịch vụ & hợp đồng'}</span></span>
                  <Icon name="chevron_right" className="flex-shrink-0 text-[20px] text-secondary" />
                </Link>
                {onbQ.data && (
                  <Link to={onboardingPath(m.id)} className={linkRow}>
                    <span className="flex items-center gap-2"><Icon name="fact_check" className="text-[20px] text-primary" /> Tiến độ onboarding ({onbQ.data.steps_done}/5)</span>
                    <Icon name="chevron_right" className="text-[20px] text-secondary" />
                  </Link>
                )}
                <Link to={contactsPath(m.code)} className={linkRow}>
                  <span className="flex items-center gap-2"><Icon name="call" className="text-[20px] text-primary" /> Lịch sử liên hệ</span>
                  <Icon name="chevron_right" className="text-[20px] text-secondary" />
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">Yêu cầu khác của merchant ({others.length})</span>
                {others.length === 0 ? (
                  <p className="text-[13px] text-secondary">Merchant này không có yêu cầu nào khác.</p>
                ) : others.map((o) => (
                  <Link key={o.id} to={supportPath(o.id)} className="flex min-h-10 flex-col gap-0.5 rounded-lg bg-surface-container-low px-3 py-2 hover:bg-surface-container">
                    <span className="flex items-center justify-between gap-2"><span className="font-label-lg text-label-lg font-bold text-primary">{hashCode(o.code)}</span><span className="text-[12px] text-secondary">{TICKET_STATUSES[o.status]}</span></span>
                    <span className="truncate text-[13px] text-on-surface">{o.subject}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply log */}
      <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-space-md p-4 sm:p-space-lg">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="h-6 w-2.5 rounded-full bg-primary-container" />
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Lịch sử &amp; Nhật ký phản hồi</h2>
            <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-md text-label-md font-bold text-on-surface">{messages.length} phản hồi</span>
          </div>
          <button type="button" onClick={gotoReply}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-surface-container px-space-md py-2 font-label-lg text-label-lg text-primary transition-colors hover:bg-primary hover:text-on-primary">
            <Icon name="add_comment" className="text-[18px]" />
            <span>Thêm phản hồi</span>
          </button>
        </div>
        {messagesQ.loading && !messagesQ.data ? (
          <Loading />
        ) : messagesQ.error ? (
          <div className="p-6"><ErrorState message={messagesQ.error} onRetry={messagesQ.reload} /></div>
        ) : messages.length === 0 ? (
          <p className="px-4 pb-4 text-[14px] text-secondary sm:px-space-lg sm:pb-space-lg">Chưa có phản hồi nào cho yêu cầu này.</p>
        ) : (
          <div className="px-3 pb-3 md:p-0">
            <ResponsiveTable
              minWidth={1100}
              cards={messages.map((r) => {
                const ch = CHANNELS[r.channel] ?? CHANNELS.app
                return (
                  <div key={r.id} className="rounded-xl bg-surface-container-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${avatarCls(r.handler_name)}`}>{initials(r.handler_name)}</div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-label-lg text-label-lg font-semibold text-on-surface">{r.handler_name ?? '—'}</span>
                          <span className="truncate font-body-sm text-body-sm text-secondary">{r.handler_role}</span>
                        </div>
                      </div>
                      <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-label-md text-[12px] text-on-surface ${ch.pill}`}>
                        <Icon name={ch.icon} className={`text-[15px] ${ch.iconCls}`} />
                        {ch.label}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-line break-words font-body-md text-body-md text-on-surface">{r.content}</p>
                    <p className="mt-2 text-[12px] text-secondary">{hashCode(r.code)} · {formatDateTime(r.created_at)}</p>
                  </div>
                )
              })}
            >
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-primary-container font-headline-md text-[14px] text-on-primary">
                    <th className="w-28 px-space-md py-3 text-center font-semibold">Mã PH</th>
                    <th className="w-40 px-space-md py-3 font-semibold">Ngày phản hồi</th>
                    <th className="w-52 px-space-md py-3 font-semibold">Người xử lý</th>
                    <th className="w-44 px-space-md py-3 font-semibold">Người phản hồi</th>
                    <th className="px-space-md py-3 font-semibold">Nội dung phản hồi</th>
                    <th className="w-40 px-space-md py-3 text-center font-semibold">Kênh phản hồi</th>
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface">
                  {messages.map((r, i) => {
                    const ch = CHANNELS[r.channel] ?? CHANNELS.app
                    return (
                      <tr key={r.id} className={`transition-colors hover:bg-primary-fixed/20 ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                        <td className="px-space-md py-3.5 text-center font-label-md text-label-md font-bold text-primary">{hashCode(r.code)}</td>
                        <td className="px-space-md py-3.5 font-label-md text-label-md text-secondary">{formatDateTime(r.created_at)}</td>
                        <td className="px-space-md py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${avatarCls(r.handler_name)}`}>{initials(r.handler_name)}</div>
                            <div className="flex flex-col">
                              <span className="font-label-lg text-label-lg font-semibold text-on-surface">{r.handler_name ?? '—'}</span>
                              <span className="font-body-sm text-body-sm text-secondary">{r.handler_role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-space-md py-3.5 font-label-md text-label-md text-on-surface">{r.responder_name ?? r.handler_name ?? '—'}</td>
                        <td className="whitespace-pre-line break-words px-space-md py-3.5 font-body-lg text-body-lg text-on-surface">{r.content}</td>
                        <td className="px-space-md py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-label-md text-label-md text-on-surface ${ch.pill}`}>
                            <Icon name={ch.icon} className={`text-[15px] ${ch.iconCls}`} />
                            {ch.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        )}
      </div>

      {/* Quick reply */}
      <div ref={replyRef} id="quick-reply-box" className="flex scroll-mt-20 flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-space-xs">
          <div className="flex items-center gap-space-sm">
            <span className="h-6 w-2.5 rounded-full bg-primary-container" />
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Khung soạn phản hồi nhanh cho Merchant</h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-space-sm font-label-md text-label-md text-secondary">
            <span>Đang trả lời với tư cách:</span>
            <span className="font-bold text-on-surface">{me ? `${me.full_name}${me.full_name === settings.name ? ` (${settings.role})` : ''}` : settings.name}</span>
          </div>
        </div>
        <form onSubmit={send} className="flex flex-col gap-space-md">
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="sd-channel" className="font-label-md text-label-md text-secondary">Kênh gửi thông báo</label>
              <div className="relative">
                <select id="sd-channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className={`${selectBase} py-2.5`}>
                  {(Object.keys(CHANNELS) as Channel[]).map((c) => <option key={c} value={c}>{CHANNELS[c].select}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-secondary" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sd-template" className="font-label-md text-label-md text-secondary">Mẫu phản hồi nhanh (Template)</label>
              <div className="relative">
                <select id="sd-template" value={templateId} onChange={(e) => pickTemplate(e.target.value)} className={`${selectBase} py-2.5`}>
                  <option value="">-- Chọn mẫu câu trả lời nhanh --</option>
                  {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.title}</option>)}
                </select>
                <Icon name="arrow_drop_down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-secondary" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sd-after" className="font-label-md text-label-md text-secondary">Cập nhật luôn trạng thái Ticket</label>
              <div className="relative">
                <select id="sd-after" value={afterStatus} onChange={(e) => setAfterStatus(e.target.value as AfterStatus)} className={`${selectBase} py-2.5`}>
                  <option value="keep">Giữ nguyên: {TICKET_STATUSES[t.status]}</option>
                  <option value="resolved">Chuyển thành: Đã giải quyết</option>
                  <option value="waiting_merchant">Chuyển thành: Đợi Merchant bổ sung</option>
                  <option value="closed">Đóng ticket ngay sau khi gửi</option>
                </select>
                <Icon name="arrow_drop_down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-secondary" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sd-content" className="font-label-md text-label-md text-secondary">Nội dung phản hồi gửi đến đối tác</label>
            <textarea id="sd-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={`Nhập chi tiết nội dung phản hồi hướng dẫn hoặc cập nhật tiến độ cho Merchant ${m?.name ?? ''}...`}
              className="w-full rounded-xl bg-surface-container-low p-space-md font-body-lg text-[16px] text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary-container sm:text-body-lg" />
          </div>
          <div className="flex flex-col-reverse gap-space-sm pt-space-xs sm:flex-row sm:justify-end">
            <button type="button" onClick={saveDraft} className={btnSecondary}>Lưu bản nháp</button>
            <button type="submit" disabled={sending} className={`${btnPrimary} sm:px-space-xl`}>
              <Icon name="send" className="text-[20px]" />
              <span>{sending ? 'Đang gửi...' : 'Gửi phản hồi ngay'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
