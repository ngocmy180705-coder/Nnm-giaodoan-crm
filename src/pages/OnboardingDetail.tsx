import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import ReminderLinks from '../components/ReminderLinks'
import StatusBadge from '../components/StatusBadge'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { Field, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { ONBOARDING_STEPS, TICKET_STATUSES } from '../lib/constants'
import { REMIND_TOAST } from '../lib/contactLog'
import { daysUntil, formatDate, formatTime, hashCode, initials, parseDate, relativeTime } from '../lib/format'
import { useBreadcrumb, useToast } from '../lib/layoutContext'
import { ROUTES, activityPath, churnPath, contactsPath, merchantPath, newPath, subscriptionPath, supportPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { ChurnRisk, ContactLog, Merchant, MerchantContact, Onboarding, OnboardingStep, OnboardingTask, Staff, Subscription, SupportTicket } from '../lib/types'
import { useQuery } from '../lib/useQuery'
import { applyProgress } from './onboarding/progress'
import { logReminders } from './onboarding/remind'

type StepFull = OnboardingStep & { tasks: OnboardingTask[] }
type OnboardingFull = Onboarding & { assignee: Staff | null; steps: StepFull[] }
type LogRow = ContactLog & { staff: Pick<Staff, 'full_name'> | null }
type TicketLite = Pick<SupportTicket, 'id' | 'code' | 'subject' | 'status'>
type SubLite = Pick<Subscription, 'id' | 'code' | 'plan_name' | 'end_date'>
type ChurnLite = Pick<ChurnRisk, 'id' | 'alert_text' | 'risk_level'>

const smallBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-label-md transition-all'

const LOG_ICON: Record<ContactLog['channel'], { icon: string; cls: string }> = {
  voip: { icon: 'call_received', cls: 'text-tertiary' },
  zalo: { icon: 'mark_chat_read', cls: 'text-primary' },
  visit: { icon: 'storefront', cls: 'text-primary' },
  meet: { icon: 'videocam', cls: 'text-primary' },
  note: { icon: 'edit_note', cls: 'text-secondary' },
}

const stamp = (v: string | null) => (v ? `${formatDate(v)} - ${formatTime(v)}` : '—')
const meta = (s: OnboardingStep, k: string): string | null => {
  const v = s.meta?.[k]
  return v == null || v === '' ? null : String(v)
}

export default function OnboardingDetail() {
  const { merchantId } = useParams()
  const toast = useToast()
  const { settings } = useSettings()

  const merchantQ = useQuery<Merchant>(() => supabase.from('merchants').select('*').eq('id', merchantId!).single(), [merchantId])
  const obQ = useQuery<OnboardingFull | null>(
    () =>
      supabase
        .from('onboardings')
        .select('*, assignee:staff(*), steps:onboarding_steps(*, tasks:onboarding_tasks(*))')
        .eq('merchant_id', merchantId!)
        .maybeSingle(),
    [merchantId],
  )
  const peopleQ = useQuery<MerchantContact[]>(() => supabase.from('merchant_contacts').select('*').eq('merchant_id', merchantId!).order('sort_order'), [merchantId])
  const logsQ = useQuery<LogRow[]>(
    () => supabase.from('contact_logs').select('*, staff:staff(full_name)').eq('merchant_id', merchantId!).order('occurred_at', { ascending: false }).limit(3),
    [merchantId],
  )
  const ticketsQ = useQuery<TicketLite[]>(
    () => supabase.from('support_tickets').select('id,code,subject,status').eq('merchant_id', merchantId!).in('status', ['new', 'processing', 'waiting_merchant']).order('created_at', { ascending: false }).limit(4),
    [merchantId],
  )
  const subQ = useQuery<SubLite | null>(
    () => supabase.from('subscriptions').select('id,code,plan_name,end_date').eq('merchant_id', merchantId!).eq('is_current', true).maybeSingle(),
    [merchantId],
  )
  const churnQ = useQuery<ChurnLite[]>(() => supabase.from('churn_risks').select('id,alert_text,risk_level').eq('merchant_id', merchantId!).eq('handled', false), [merchantId])

  const [busy, setBusy] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [editing, setEditing] = useState<StepFull | null>(null)

  const m = merchantQ.data
  const ob = obQ.data
  useBreadcrumb(m ? [{ label: 'Tiến độ onboarding', to: ROUTES.onboarding }, m.name] : null)

  const steps = useMemo(() => [...(ob?.steps ?? [])].sort((a, b) => a.step_no - b.step_no).map((s) => ({ ...s, tasks: [...(s.tasks ?? [])].sort((a, b) => a.sort_order - b.sort_order) })), [ob])

  if ((merchantQ.loading && !m) || (obQ.loading && ob === null && !obQ.error)) return <Loading />
  if (merchantQ.error || !m) return <div className="px-margin py-space-lg"><ErrorState message={merchantQ.error ?? 'Không tìm thấy merchant.'} onRetry={merchantQ.reload} /></div>
  if (obQ.error) return <div className="px-margin py-space-lg"><ErrorState message={obQ.error} onRetry={obQ.reload} /></div>
  if (!ob) {
    return (
      <div className="px-margin py-space-lg">
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm sm:p-space-xl">
          <EmptyState message={`${m.name} chưa có hồ sơ onboarding.`} />
          <div className="flex flex-wrap justify-center gap-space-sm pb-4">
            <Link to={ROUTES.onboarding} className={btnSecondary}><Icon name="arrow_back" className="text-[20px]" />Quay lại danh sách</Link>
            <Link to={newPath('onboarding')} className={btnPrimary}><Icon name="add_circle" className="text-[20px]" />Bắt đầu onboarding</Link>
            <Link to={merchantPath(m.id)} className={btnSecondary}><Icon name="storefront" className="text-[20px]" />Xem hồ sơ merchant</Link>
          </div>
        </div>
      </div>
    )
  }

  const k = Math.min(5, Math.max(0, ob.steps_done))
  const pct = k * 20
  const assignee = ob.assignee
  const current = steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.step_no === k + 1)
  const guideStep = current ?? steps[steps.length - 1]
  const start = ob.started_at ? new Date(ob.started_at) : null
  const totalDays = start && ob.go_live_date ? Math.max(1, Math.round((parseDate(ob.go_live_date)!.getTime() - start.getTime()) / 86400000)) : null
  const elapsed = start ? Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000)) : null
  const goLiveLeft = daysUntil(ob.go_live_date)

  const reloadAll = () => { obQ.reload(); merchantQ.reload(); logsQ.reload(); peopleQ.reload(); ticketsQ.reload(); subQ.reload(); churnQ.reload() }

  async function setProgress(next: number, okMsg: string) {
    if (busy || !ob) return
    setBusy(true)
    const err = await applyProgress(ob.id, next, assignee?.full_name ?? null)
    setBusy(false)
    if (err) return toast(`Không cập nhật được tiến độ: ${err}`)
    toast(okMsg)
    obQ.reload()
  }

  const completeStep = (s: StepFull) =>
    s.step_no === k + 1
      ? setProgress(s.step_no, s.step_no === 5 ? 'Đã hoàn tất toàn bộ quy trình onboarding' : `Đã hoàn thành Bước ${String(s.step_no).padStart(2, '0')}`)
      : toast('Hãy hoàn thành các bước trước đó trước.')

  const revertStep = (s: StepFull) => {
    if (s.step_no !== k) return toast('Chỉ có thể hoàn tác bước hoàn thành gần nhất.')
    if (window.confirm(`Hoàn tác Bước ${String(s.step_no).padStart(2, '0')} về trạng thái "Đang xử lý"?`)) setProgress(s.step_no - 1, `Đã hoàn tác Bước ${String(s.step_no).padStart(2, '0')}`)
  }

  async function toggleTask(t: OnboardingTask) {
    const next = !t.done
    const patch = (done: boolean) => obQ.setData((cur) => cur && { ...cur, steps: cur.steps.map((s) => ({ ...s, tasks: (s.tasks ?? []).map((x) => (x.id === t.id ? { ...x, done } : x)) })) })
    patch(next)
    const { error } = await supabase.from('onboarding_tasks').update({ done: next }).eq('id', t.id)
    if (error) {
      patch(t.done)
      toast(`Không cập nhật được nhiệm vụ: ${error.message}`)
    }
  }

  const stepTitle = guideStep ? `Bước ${String(guideStep.step_no).padStart(2, '0')}: ${guideStep.title}` : 'các bước còn lại'
  const reminderText = k >= 5 ? 'Thông báo merchant đã hoàn tất onboarding.' : `Nhắc nhở merchant hoàn thành ${stepTitle} (tiến độ ${k}/5 bước).`

  /** "Ghi nhận nhắc Zalo/SMS": logs a pending contact_logs row (nothing is sent; use the Zalo / SMS links to message the merchant). */
  async function remind() {
    if (reminding || !m) return
    setReminding(true)
    const err = await logReminders([{ merchantId: m.id, contactPerson: ob!.owner_label ?? m.contact_name, content: reminderText }], settings.name)
    setReminding(false)
    if (err) return toast(`Không ghi nhận được nhắc nhở: ${err}`)
    toast(REMIND_TOAST(1))
    logsQ.reload()
  }

  const mailto = m.email
    ? `mailto:${m.email}?subject=${encodeURIComponent(`[Giaodoan] Tiến độ onboarding ${m.name} (${hashCode(m.code)})`)}&body=${encodeURIComponent(
        `Chào ${m.contact_name ?? 'anh/chị'},\n\nTiến độ onboarding của ${m.name} hiện đạt ${k}/5 bước (${pct}%).\n${k < 5 && guideStep ? `Bước tiếp theo: ${guideStep.title}.\n` : ''}${ob.go_live_date ? `Hạn Go-Live dự kiến: ${formatDate(ob.go_live_date)}.\n` : ''}\nNếu cần hỗ trợ, anh/chị vui lòng phản hồi email này.\n\nTrân trọng,\n${settings.name}\nGiaodoan`,
      )}`
    : null

  const statusPill = k >= 5
    ? { text: 'Đã hoàn tất onboarding', dot: 'bg-tertiary', cls: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' }
    : { text: `Đang thực hiện Bước ${String(k + 1).padStart(2, '0')}: ${ONBOARDING_STEPS[k].title}`, dot: 'bg-primary-container animate-pulse', cls: 'bg-surface-container-high text-primary' }

  const openTickets = ticketsQ.data ?? []
  const risks = churnQ.data ?? []

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        eyebrow={<Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">Merchant {hashCode(m.code)}</Link>}
        title={`Onboarding - ${m.name}`}
        subtitle={
          <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 font-label-md text-label-md ${statusPill.cls}`}>
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusPill.dot}`} /> <span className="min-w-0 break-words">{statusPill.text}</span>
          </span>
        }
        actions={
          <>
            <Link to={ROUTES.onboarding} className={`${btnSecondary} max-sm:min-w-[45%]`}>
              <Icon name="arrow_back" className="text-[20px]" /><span>Quay lại danh sách</span>
            </Link>
            {mailto ? (
              <a href={mailto} className={`${btnSecondary} max-sm:min-w-[45%]`} title={`Soạn email gửi ${m.email}`}>
                <Icon name="mail" className="text-[20px] text-tertiary" /><span>Gửi Email tiến độ</span>
              </a>
            ) : (
              <button type="button" disabled className={`${btnSecondary} max-sm:min-w-[45%]`} title="Merchant chưa có địa chỉ email">
                <Icon name="mail" className="text-[20px] text-tertiary" /><span>Gửi Email tiến độ</span>
              </button>
            )}
            <button type="button" onClick={() => { reloadAll(); toast('Đã cập nhật tiến độ mới nhất') }} className={`${btnPrimary} max-sm:min-w-[45%]`}>
              <Icon name="sync" className="text-[20px]" /><span>Cập nhật tiến độ</span>
            </button>
          </>
        }
      />

      {/* Merchant banner */}
      <div className="flex flex-col justify-between gap-space-lg rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg 2xl:flex-row 2xl:items-center">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-space-md sm:flex-row sm:items-center sm:gap-space-lg">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-surface-container shadow-sm sm:h-20 sm:w-20">
              {m.image_url ? <img className="h-full w-full object-cover" alt={m.name} src={m.image_url} /> : <span className="text-[34px]">{m.emoji ?? <Icon name={m.icon ?? 'storefront'} className="text-[34px] text-primary" />}</span>}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-tertiary text-[14px] text-on-tertiary shadow-sm">
              <Icon name="verified" className="text-[16px]" />
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="min-w-0 break-words font-headline-lg text-headline-lg text-on-surface">
                <Link to={merchantPath(m.id)} className="hover:text-primary hover:underline">{m.name}</Link>
              </h2>
              <Link to={merchantPath(m.id)} className="rounded-md bg-surface-container px-2.5 py-0.5 font-label-md text-label-md text-secondary hover:text-primary">Mã: {hashCode(m.code)}</Link>
              <span className="rounded-md bg-tertiary/10 px-2.5 py-0.5 font-label-md text-label-md font-bold text-tertiary">{m.partner_tier ?? 'F&B'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 font-body-md text-body-md text-secondary">
              <div className="flex items-center gap-1.5"><Icon name={m.icon ?? 'storefront'} className="text-[18px] text-primary" /><span>{m.category ?? '—'}</span></div>
              <a href={`tel:${m.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:text-primary"><Icon name="call" className="text-[18px] text-secondary" /><span className="font-medium text-on-surface">{m.phone}</span></a>
              {m.email && <a href={`mailto:${m.email}`} className="flex min-w-0 items-center gap-1.5 hover:text-primary"><Icon name="mail" className="text-[18px] text-secondary" /><span className="truncate">{m.email}</span></a>}
              <div className="flex min-w-0 items-center gap-1.5"><Icon name="location_on" className="text-[18px] text-secondary" /><span className="min-w-0 break-words sm:max-w-sm sm:truncate">{m.address_full ?? m.address}</span></div>
            </div>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-1 gap-4 rounded-xl bg-surface-container-low px-4 py-space-md sm:grid-cols-3 sm:gap-6 sm:px-space-lg xl:gap-8">
          <div className="flex min-w-0 flex-col">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Chuyên viên phụ trách</span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-container font-label-sm text-label-sm font-bold text-on-primary">{assignee ? initials(assignee.full_name).slice(-1) : '?'}</div>
              <span className="font-label-lg text-label-lg font-semibold text-on-surface">{assignee?.full_name ?? 'Chưa phân công'}</span>
              {assignee?.role_label && <span className="font-label-sm text-label-sm text-secondary">({assignee.role_label})</span>}
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Thời gian Onboard</span>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 font-label-md text-label-md text-on-surface">
              <span className="font-bold">{formatDate(ob.started_at)}</span>
              <span className="text-secondary">→</span>
              <span className="font-bold text-primary">{formatDate(ob.go_live_date)}</span>
              {elapsed !== null && totalDays !== null && <span className="font-normal text-secondary">(Ngày {Math.min(elapsed, totalDays)}/{totalDays})</span>}
            </div>
            {goLiveLeft !== null && k < 5 && (
              <span className={`pt-0.5 font-label-sm text-label-sm ${goLiveLeft < 0 ? 'text-error' : 'text-secondary'}`}>
                {goLiveLeft < 0 ? `Quá hạn Go-Live ${-goLiveLeft} ngày` : goLiveLeft === 0 ? 'Go-Live hôm nay' : `Còn ${goLiveLeft} ngày đến Go-Live`}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col sm:min-w-[180px]">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Tiến độ quy trình</span>
              <span className="font-headline-md text-headline-md font-bold text-primary">{pct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary-container transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="pt-1 font-label-sm text-label-sm font-medium text-tertiary">{k}/5 bước đã hoàn tất</span>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-12">
        {/* LEFT: checklist */}
        <div className="flex min-w-0 flex-col gap-space-md xl:col-span-8">
          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest px-4 py-space-md shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-space-lg">
            <div className="flex items-center gap-space-sm">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container"><Icon name="fact_check" className="text-[20px]" /></div>
              <div className="flex min-w-0 flex-col">
                <h3 className="font-headline-md text-headline-md text-on-surface">5 Bước Chuẩn Quy Trình Onboarding Giaodoan</h3>
                <span className="font-body-sm text-body-sm text-secondary">Đánh dấu tích để cập nhật trạng thái các giai đoạn triển khai</span>
              </div>
            </div>
          </div>

          {steps.map((s) => {
            const no = String(s.step_no).padStart(2, '0')
            if (s.status === 'done') {
              return (
                <div key={s.id} className="rounded-xl bg-surface-container-lowest p-4 shadow-sm transition-all hover:bg-surface-container-low/40 sm:p-space-lg">
                  <div className="flex items-start gap-space-md">
                    <button type="button" title="Bấm để hoàn tác bước này" aria-label="Hoàn tác bước này" onClick={() => revertStep(s)} disabled={busy}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary text-on-tertiary shadow-sm sm:mt-1 sm:h-7 sm:w-7">
                      <Icon name="check" className="text-[20px] font-bold" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-space-sm">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm font-bold text-secondary">BƯỚC {no}</span>
                          <h4 className="min-w-0 font-headline-md text-headline-md text-on-surface">{s.title}</h4>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 font-label-md text-label-md font-bold text-tertiary">
                          <Icon name="check_circle" className="text-[16px]" /> Đã hoàn thành
                        </span>
                      </div>
                      <p className="mt-1 font-body-md text-body-md text-secondary">{s.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-label-sm text-label-sm text-secondary">
                        <div className="flex items-center gap-1"><Icon name="event_available" className="text-[16px]" /><span>Hoàn tất: <strong>{stamp(s.completed_at)}</strong></span></div>
                        {s.completed_by && <div className="flex items-center gap-1"><Icon name="person" className="text-[16px]" /><span>{s.step_no === 1 ? 'Người duyệt' : 'Thực hiện'}: <strong>{s.completed_by}</strong></span></div>}
                        {meta(s, 'bank') && <div className="flex items-center gap-1 font-bold text-tertiary"><Icon name="account_balance" className="text-[16px]" /><span>{meta(s, 'bank')}</span></div>}
                        {meta(s, 'menu_label') && <div className="flex items-center gap-1"><Icon name="restaurant_menu" className="text-[16px]" /><span>Số lượng: <strong className="text-on-surface">{meta(s, 'menu_label')}</strong></span></div>}
                        {meta(s, 'document') && <div className="flex items-center gap-1"><Icon name="description" className="text-[16px]" /><span>{meta(s, 'document')}</span></div>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            if (s.status === 'in_progress') {
              const canComplete = s.step_no === k + 1
              return (
                <div key={s.id} className="rounded-xl bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest to-surface-container-low p-4 shadow-md transition-all sm:p-space-lg">
                  <div className="flex items-start gap-space-md">
                    <button type="button" title="Đánh dấu hoàn thành bước này" aria-label="Đánh dấu hoàn thành bước này" onClick={() => completeStep(s)} disabled={busy || !canComplete}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary-container transition-all hover:bg-primary-container hover:text-on-primary sm:mt-1 sm:h-7 sm:w-7">
                      <span className="h-3 w-3 rounded-full bg-primary-container" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-space-sm">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded bg-primary-container px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-primary">BƯỚC {no}</span>
                          <h4 className="min-w-0 font-headline-md text-headline-md font-bold text-on-surface">{s.title}</h4>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 font-label-md text-label-md font-bold text-on-primary shadow-sm">
                          <Icon name="progress_activity" className="animate-spin text-[16px]" /> Đang xử lý
                        </span>
                      </div>
                      <p className="mt-2 font-body-md text-body-md text-on-surface">{s.description}</p>
                      {s.tasks.length > 0 && (
                        <div className="mt-space-md flex flex-col gap-2.5 rounded-xl bg-surface-container-low p-space-md">
                          <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">Nhiệm vụ trực tiếp tại quầy:</span>
                          <div className="grid grid-cols-1 gap-1 font-body-sm text-body-sm md:grid-cols-2">
                            {s.tasks.map((t) => (
                              <button key={t.id} type="button" onClick={() => toggleTask(t)} className={`flex min-h-10 items-center gap-2 text-left transition-colors hover:text-primary ${t.done ? 'text-on-surface' : 'text-secondary'}`}>
                                <Icon name={t.done ? 'task_alt' : 'radio_button_unchecked'} className={`text-[18px] ${t.done ? 'text-tertiary' : 'text-primary'}`} />
                                <span>{t.title}</span>
                              </button>
                            ))}
                          </div>
                          <span className="font-label-sm text-label-sm text-secondary">{s.tasks.filter((t) => t.done).length}/{s.tasks.length} nhiệm vụ đã xong</span>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-space-md">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-sm text-label-sm text-secondary">
                          {s.planned_label && <div className="flex items-center gap-1"><Icon name="schedule" className="text-[16px]" /><span><strong>{s.planned_label}</strong></span></div>}
                          {(meta(s, 'tech_owner') ?? assignee?.full_name) && (
                            <div className="flex items-center gap-1"><Icon name="support_agent" className="text-[16px]" /><span>Phụ trách kỹ thuật: <strong>{meta(s, 'tech_owner') ?? assignee?.full_name}</strong></span></div>
                          )}
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                          <button type="button" onClick={() => setEditing(s)} className={`${smallBtn} bg-surface-container text-on-surface hover:bg-surface-container-high max-sm:flex-1`}>Chỉnh sửa chi tiết</button>
                          <button type="button" onClick={() => completeStep(s)} disabled={busy || !canComplete}
                            className={`${smallBtn} bg-primary-container font-bold text-on-primary shadow-sm hover:opacity-90 disabled:opacity-50 max-sm:flex-1`}>
                            <Icon name="done_all" className="text-[18px]" /> Xác nhận hoàn thành bước này
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div key={s.id} className="rounded-xl bg-surface-container-lowest/80 p-4 opacity-80 shadow-sm sm:p-space-lg">
                <div className="flex items-start gap-space-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-secondary sm:mt-1 sm:h-7 sm:w-7"><Icon name="lock" className="text-[20px]" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-space-sm">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm font-bold text-secondary">BƯỚC {no}</span>
                        <h4 className="min-w-0 font-headline-md text-headline-md text-secondary">{s.title}</h4>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 font-label-md text-label-md text-secondary"><Icon name="hourglass_empty" className="text-[16px]" /> Chờ bước trước</span>
                    </div>
                    <p className="mt-1 font-body-md text-body-md text-secondary">{s.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-label-sm text-label-sm text-secondary">
                      {s.planned_label && <div className="flex items-center gap-1"><Icon name="event_repeat" className="text-[16px]" /><span><strong>{s.planned_label}</strong></span></div>}
                      {meta(s, 'target_status') && <div className="flex items-center gap-1"><Icon name="storefront" className="text-[16px]" /><span>Trạng thái đích: <strong>{meta(s, 'target_status')}</strong></span></div>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {steps.length === 0 && <div className="rounded-xl bg-surface-container-lowest shadow-sm"><EmptyState message="Chưa có checklist cho onboarding này." /></div>}

          {ob.sla_note && (
            <div className="flex items-center gap-space-md rounded-xl bg-surface-container-low p-4 sm:p-space-lg">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-container/20 text-tertiary"><Icon name="speed" className="text-[28px]" /></div>
              <div className="flex min-w-0 flex-col">
                <span className="font-headline-md text-headline-md text-on-surface">{ob.sla_note}</span>
                {ob.sla_detail && <span className="font-body-sm text-body-sm text-secondary">{ob.sla_detail}</span>}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: guide + related + contacts + history */}
        <div className="flex min-w-0 flex-col gap-space-md xl:col-span-4">
          {guideStep && (
            <div className="rounded-xl bg-gradient-to-b from-surface-container-lowest to-surface-container-low/40 p-4 shadow-md sm:p-space-lg">
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-container" />
                  <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">Hướng dẫn trọng tâm</span>
                </div>
                <span className="rounded bg-primary-container/10 px-2 py-0.5 font-label-sm text-label-sm font-bold text-primary">Bước {String(guideStep.step_no).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-1 font-headline-lg text-headline-lg text-on-surface">{guideStep.title}</h3>
              <div className="mt-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
                <div className="flex items-center gap-2 text-primary"><Icon name="flag" className="text-[20px]" /><span className="font-label-lg text-label-lg font-bold">Mục tiêu cần đạt:</span></div>
                <p className="mt-1.5 font-body-md text-body-md leading-relaxed text-on-surface">{guideStep.guide_goal ?? guideStep.description}</p>
              </div>
              {guideStep.guide_checklist.length > 0 && (
                <div className="mt-space-md flex flex-col gap-3">
                  <span className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface">Checklist công việc cần hướng dẫn:</span>
                  {guideStep.guide_checklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-surface-container-lowest p-3 shadow-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container/20 font-label-sm text-label-sm font-bold text-primary">{i + 1}</span>
                      <p className="font-body-md text-body-md text-on-surface">{item}</p>
                    </div>
                  ))}
                </div>
              )}
              {guideStep.step_no === 4 && (
                <div className="mt-space-md flex items-start gap-3 rounded-xl bg-error-container/40 p-space-md">
                  <Icon name="info" className="mt-0.5 shrink-0 text-[20px] text-error" />
                  <p className="font-body-sm text-body-sm leading-snug text-on-surface"><strong>Lưu ý kỹ thuật:</strong> Nếu merchant gặp lỗi không nhận diện máy in Sunmi, liên hệ ngay <strong>Hotline Kỹ thuật nội bộ nhánh 2 (Ext: 104)</strong> để hỗ trợ kết nối từ xa.</p>
                </div>
              )}
              <div className="mt-space-lg flex flex-col gap-2.5">
                {current && current.step_no === k + 1 ? (
                  <button type="button" onClick={() => completeStep(current)} disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3.5 text-center font-headline-md text-headline-md text-on-primary shadow-md transition-all hover:opacity-95 disabled:opacity-50">
                    <Icon name="check_circle" className="text-[22px]" />
                    <span>{current.step_no < 5 ? `Hoàn thành bước này & chuyển sang Bước ${current.step_no + 1}` : 'Hoàn thành & kết thúc onboarding'}</span>
                  </button>
                ) : (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-tertiary-fixed px-4 py-3.5 font-headline-md text-headline-md text-on-tertiary-fixed-variant">
                    <Icon name="check_circle" className="text-[22px]" /><span>Đã hoàn tất toàn bộ quy trình</span>
                  </div>
                )}
                <button type="button" onClick={remind} disabled={reminding} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-surface-container px-4 py-2.5 font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-60">
                  <Icon name="send_to_mobile" className="text-[20px] text-primary" /><span>{reminding ? 'Đang ghi nhận...' : 'Ghi nhận nhắc Zalo/SMS'}</span>
                </button>
                <ReminderLinks phone={m.phone} text={reminderText} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
            <h4 className="flex items-center gap-2 font-headline-md text-headline-md text-on-surface"><Icon name="hub" className="text-primary" /> Liên kết nhanh</h4>
            <div className="flex flex-col gap-2 font-body-md text-body-md">
              <Link to={merchantPath(m.id)} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 hover:bg-surface-container">
                <span className="flex items-center gap-2"><Icon name="storefront" className="text-[20px] text-primary" /> Hồ sơ merchant</span>
                <Icon name="chevron_right" className="text-[20px] text-secondary" />
              </Link>
              <Link to={subscriptionPath(m.id)} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 hover:bg-surface-container">
                <span className="flex min-w-0 items-center gap-2"><Icon name="workspace_premium" className="text-[20px] text-primary" /><span className="truncate">{subQ.data ? `${subQ.data.plan_name} · #${subQ.data.code} (đến ${formatDate(subQ.data.end_date)})` : 'Gói dịch vụ & hợp đồng'}</span></span>
                <Icon name="chevron_right" className="flex-shrink-0 text-[20px] text-secondary" />
              </Link>
              <Link to={activityPath(m.id)} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 hover:bg-surface-container">
                <span className="flex items-center gap-2"><Icon name="history" className="text-[20px] text-primary" /> Lịch sử hoạt động</span>
                <Icon name="chevron_right" className="text-[20px] text-secondary" />
              </Link>
              {risks.length > 0 && (
                <Link to={churnPath()} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-error-container/40 px-3 py-2 hover:bg-error-container/60">
                  <span className="flex min-w-0 items-center gap-2"><Icon name="warning" className="text-[20px] text-error" /><span className="truncate">{risks[0].alert_text ?? 'Có nguy cơ rời bỏ'}{risks.length > 1 ? ` (+${risks.length - 1})` : ''}</span></span>
                  <Icon name="chevron_right" className="flex-shrink-0 text-[20px] text-secondary" />
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">Yêu cầu hỗ trợ đang mở ({openTickets.length})</span>
              {openTickets.length === 0 ? (
                <p className="text-[13px] text-secondary">Không có yêu cầu hỗ trợ nào đang mở.</p>
              ) : openTickets.map((t) => (
                <Link key={t.id} to={supportPath(t.id)} className="flex min-h-10 flex-col gap-0.5 rounded-lg bg-surface-container-low px-3 py-2 hover:bg-surface-container">
                  <span className="flex items-center justify-between gap-2"><span className="font-label-lg text-label-lg font-bold text-primary">{hashCode(t.code)}</span><StatusBadge tone={t.status === 'waiting_merchant' ? 'neutral' : 'warning'}>{TICKET_STATUSES[t.status]}</StatusBadge></span>
                  <span className="truncate text-[13px] text-on-surface">{t.subject}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-headline-md text-headline-md text-on-surface"><Icon name="contacts" className="text-primary" /> Đầu Mối Liên Hệ Cửa Hàng</h4>
              <span className="flex-shrink-0 rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm font-bold text-secondary">{peopleQ.data?.length ?? 0} nhân sự</span>
            </div>
            <div className="flex flex-col gap-3">
              {peopleQ.loading && !peopleQ.data ? <Loading label="Đang tải..." /> : (peopleQ.data ?? []).length === 0 ? (
                <p className="text-[13px] text-secondary">Chưa có đầu mối liên hệ{m.contact_name ? ` (liên hệ chính: ${m.contact_name})` : ''}.</p>
              ) : (peopleQ.data ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container font-bold text-on-surface">{initials(p.full_name)}</div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-label-lg text-label-lg font-bold text-on-surface">{p.full_name}</span>
                      <span className="truncate font-body-sm text-body-sm text-secondary">{p.title}</span>
                    </div>
                  </div>
                  {p.phone && (
                    <a href={`tel:${p.phone.replace(/\s/g, '')}`} title={`Gọi ${p.phone}`} aria-label={`Gọi ${p.full_name}`} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm transition-all hover:bg-primary-container hover:text-on-primary">
                      <Icon name="phone" className="text-[20px]" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-headline-md text-headline-md text-on-surface"><Icon name="timeline" className="text-secondary" /> Lịch Sử Tương Tác Gần Nhất</h4>
              <Link to={contactsPath(m.code)} className="flex-shrink-0 font-label-md text-label-md text-primary hover:underline">Xem tất cả</Link>
            </div>
            <div className="flex flex-col gap-3 font-body-sm text-body-sm">
              {logsQ.loading && !logsQ.data ? <Loading label="Đang tải..." /> : (logsQ.data ?? []).length === 0 ? (
                <p className="text-[13px] text-secondary">Chưa có lượt liên hệ nào.</p>
              ) : (logsQ.data ?? []).map((l) => (
                <div key={l.id} className="flex items-start gap-2.5 pb-2">
                  <Icon name={LOG_ICON[l.channel].icon} className={`mt-0.5 text-[18px] ${LOG_ICON[l.channel].cls}`} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-on-surface">{l.content}</p>
                    <span className="text-[11px] text-secondary">{relativeTime(l.occurred_at)}, {formatDate(l.occurred_at)} lúc {formatTime(l.occurred_at)} • {l.staff?.full_name ? `Thực hiện bởi ${l.staff.full_name}` : (l.actor_name ?? '—')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && <EditStepModal key={editing.id} step={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast('Đã lưu chi tiết bước'); obQ.reload() }} />}
    </div>
  )
}

function EditStepModal({ step, onClose, onSaved }: { step: StepFull; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ title: step.title, description: step.description ?? '', planned_label: step.planned_label ?? '' })
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('onboarding_steps')
      .update({ title: f.title.trim(), description: f.description.trim() || null, planned_label: f.planned_label.trim() || null })
      .eq('id', step.id)
    setSaving(false)
    if (error) return toast(`Không lưu được: ${error.message}`)
    onSaved()
  }

  return (
    <Modal open title={`Chỉnh sửa Bước ${String(step.step_no).padStart(2, '0')}`} onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="edit-step-form" className={btnPrimary} disabled={saving || !f.title.trim()}>
            <Icon name="save" className="text-[20px]" />{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </>
      }>
      <form id="edit-step-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Tiêu đề bước" required><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Mô tả"><textarea rows={4} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Kế hoạch / Dự kiến hoàn thành"><input className={inputCls} value={f.planned_label} onChange={(e) => setF({ ...f, planned_label: e.target.value })} placeholder="Dự kiến xong: Hôm nay" /></Field>
      </form>
    </Modal>
  )
}
