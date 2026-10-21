import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import ReminderLinks from '../components/ReminderLinks'
import ResponsiveTable from '../components/ResponsiveTable'
import { btnPrimary, btnSecondary } from '../components/Form'
import { EmptyState, ErrorState, Loading } from '../components/Loading'
import { COMPANY } from '../lib/company'
import { insertContactLogs, REMIND_TOAST } from '../lib/contactLog'
import { TICKET_STATUSES } from '../lib/constants'
import { daysUntil, formatDate, formatNumber, formatVnd, hashCode, initials, parseDate } from '../lib/format'
import { useBreadcrumb, useToast } from '../lib/layoutContext'
import { activityPath, churnPath, contactsPath, invoicePath, merchantPath, onboardingPath, ROUTES, supportPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import type { ChurnRisk, Invoice, MerchantWithStaff, ServicePlan, Subscription, SupportTicket } from '../lib/types'
import { useQuery } from '../lib/useQuery'
import SubscriptionFormModal from './subscriptions/SubscriptionFormModal'
import { TIER_META, currentOf } from './subscriptions/shared'

const TIER_SHORT = { silver: 'Bạc', gold: 'Vàng', diamond: 'Kim Cương', trial: 'Dùng thử' } as const
const TIER_GRADIENT = {
  silver: 'from-slate-500 to-slate-400',
  gold: 'from-amber-500 to-amber-400',
  diamond: 'from-emerald-600 to-teal-400',
  trial: 'from-sky-500 to-sky-400',
} as const

const STATUS_TEXT = { active: 'Đang hiệu lực', completed: 'Đã hoàn thành', cancelled: 'Đã hủy' } as const

const OPEN_TICKET = ['new', 'processing', 'waiting_merchant']
const chipCls = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-primary'

export default function SubscriptionDetail() {
  const { merchantId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const [renewing, setRenewing] = useState(params.get('renew') === '1')
  const [reminding, setReminding] = useState(false)
  const [reminded, setReminded] = useState<string | null>(null)

  const merchantQ = useQuery<MerchantWithStaff | null>(
    () => supabase.from('merchants').select('*, account_manager:staff!account_manager_id(*), created_by:staff!created_by_id(*)').eq('id', merchantId).maybeSingle(),
    [merchantId],
  )
  const subsQ = useQuery<Subscription[]>(
    () => supabase.from('subscriptions').select('*').eq('merchant_id', merchantId).order('start_date', { ascending: false }),
    [merchantId],
  )
  const invQ = useQuery<Invoice[]>(() => supabase.from('invoices').select('*').eq('merchant_id', merchantId).order('issued_at', { ascending: false }), [merchantId])
  const plansQ = useQuery<ServicePlan[]>(() => supabase.from('service_plans').select('*').order('sort_order'), [])
  // related records shown as quick links (failures here are non-fatal: the chips simply show no counts)
  const ticketsQ = useQuery<Pick<SupportTicket, 'id' | 'code' | 'subject' | 'status'>[]>(
    () => supabase.from('support_tickets').select('id,code,subject,status').eq('merchant_id', merchantId).in('status', OPEN_TICKET).order('updated_at', { ascending: false }),
    [merchantId],
  )
  const contactsQ = useQuery<{ id: string }[]>(() => supabase.from('contact_logs').select('id').eq('merchant_id', merchantId), [merchantId])
  const churnQ = useQuery<Pick<ChurnRisk, 'id' | 'risk_type'>[]>(() => supabase.from('churn_risks').select('id,risk_type').eq('merchant_id', merchantId).eq('handled', false), [merchantId])
  const onbQ = useQuery<{ id: string }[]>(() => supabase.from('onboardings').select('id').eq('merchant_id', merchantId), [merchantId])

  const merchant = merchantQ.data
  const subs = subsQ.data ?? []
  const invoices = invQ.data ?? []
  const sub = currentOf(subs)

  useBreadcrumb([{ label: 'Thời hạn & gia hạn', to: ROUTES.subscriptions }, merchant ? `${merchant.name}${sub ? ` · #${sub.code}` : ''}` : 'Chi tiết gói'])

  const invoiceBySub = useMemo(() => {
    const map = new Map<string, Invoice>()
    for (const i of invoices) if (i.subscription_id && !map.has(i.subscription_id)) map.set(i.subscription_id, i)
    return map
  }, [invoices])

  const loading = (merchantQ.loading && !merchantQ.data) || (subsQ.loading && !subsQ.data)
  const error = merchantQ.error ?? subsQ.error
  if (loading) return <div className="px-margin py-space-lg"><Loading /></div>
  if (error) return <div className="px-margin py-space-lg"><ErrorState message={error} onRetry={() => { merchantQ.reload(); subsQ.reload() }} /></div>
  if (!merchant) {
    return (
      <div className="flex flex-col items-center gap-3 px-margin py-space-lg">
        <EmptyState message="Không tìm thấy merchant này." />
        <Link to={ROUTES.subscriptions} className={btnPrimary}>Quay lại danh sách gói</Link>
      </div>
    )
  }

  const closeRenew = () => {
    setRenewing(false)
    if (params.has('renew')) { params.delete('renew'); setParams(params, { replace: true }) }
  }

  async function toggleAutoRenew() {
    if (!sub) return
    const next = !sub.auto_renew
    subsQ.setData((cur) => (cur ?? []).map((s) => (s.id === sub.id ? { ...s, auto_renew: next } : s)))
    const { error: err } = await supabase.from('subscriptions').update({ auto_renew: next }).eq('id', sub.id)
    if (err) {
      subsQ.setData((cur) => (cur ?? []).map((s) => (s.id === sub.id ? { ...s, auto_renew: !next } : s)))
      toast(`Không cập nhật được: ${err.message}`)
    } else toast(next ? 'Đã bật tự động gia hạn' : 'Đã tắt tự động gia hạn')
  }

  // "Ghi nhận nhắc Zalo/SMS": logs a pending contact_logs row (nothing is sent; the Zalo / SMS links open the real apps)
  const left = sub ? daysUntil(sub.end_date) : null
  const when = left === null ? '' : left < 0 ? `đã hết hạn ${-left} ngày` : `còn ${left} ngày`
  const reminderText = sub ? `Nhắc gia hạn gói ${sub.plan_name} (${hashCode(sub.code)}), hết hạn ${formatDate(sub.end_date)}${when ? ` (${when})` : ''}.` : ''

  async function sendReminder() {
    if (!sub || !merchant || reminding) return
    setReminding(true)
    const res = await insertContactLogs(
      [{
        merchantId: merchant.id,
        contactPerson: [merchant.contact_name, merchant.contact_title && `(${merchant.contact_title})`].filter(Boolean).join(' ') || null,
        channel: 'zalo',
        channelLabel: 'Zalo/SMS',
        purpose: 'Tư vấn gia hạn gói',
        content: `Cần nhắc qua Zalo/SMS: ${reminderText}`,
        tags: ['nhắc gia hạn'],
      }],
      settings.name,
    )
    setReminding(false)
    if (res.error) return toast(`Không ghi nhận được lượt nhắc: ${res.error}`)
    setReminded(res.codes[0] ?? '')
    contactsQ.reload()
    toast(REMIND_TOAST(1))
  }

  // --- derived values for the current contract ---
  const currentInvoice = sub ? invoiceBySub.get(sub.id) : undefined
  const days = sub ? daysUntil(sub.end_date) : null
  const start = sub ? parseDate(sub.start_date) : null
  const end = sub ? parseDate(sub.end_date) : null
  const totalDays = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1) : 0
  const usedDays = sub && totalDays ? Math.min(totalDays, Math.max(0, totalDays - Math.max(0, days ?? 0))) : 0
  const usedPct = totalDays ? Math.round((usedDays / totalDays) * 100) : 0
  const expired = days !== null && days < 0
  const warning = days !== null && days >= 0 && days < 15
  const monthly = sub?.cycle_months ? Math.round(sub.amount_vnd / sub.cycle_months) : sub?.amount_vnd ?? 0
  const savePct = sub?.discount_pct ?? 0
  const planFeatures = (plansQ.data ?? []).find((p) => p.code === sub?.plan_tier)?.features ?? []
  const benefits = sub && sub.benefits.length > 0 ? sub.benefits : planFeatures.map((f) => ({ icon: 'check_circle', title: f, description: '' }))
  const tierMeta = sub ? TIER_META[sub.plan_tier] : null
  const amName = merchant.account_manager?.full_name ?? '—'
  const openTickets = ticketsQ.data ?? []
  const contactCount = contactsQ.data?.length
  const churnCount = churnQ.data?.length ?? 0
  const hasOnboarding = (onbQ.data?.length ?? 0) > 0

  const statusBadge = !sub ? null : expired
    ? { cls: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500', text: 'Đã hết hạn' }
    : sub.status === 'cancelled'
      ? { cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', text: 'Đã hủy' }
      : { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500 animate-pulse', text: 'Đang hiệu lực' }

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      {/* Top strip */}
      <div className="flex flex-col gap-space-md rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <PageHeader
          eyebrow={sub ? <span className="font-mono normal-case tracking-normal text-primary">{hashCode(sub.code)}</span> : undefined}
          title={`Chi Tiết Gói Dịch Vụ - ${merchant.name}`}
          actions={
            <>
              <Link to={ROUTES.subscriptions} className={btnSecondary}>
                <Icon name="arrow_back" className="text-[18px]" />
                <span>Quay lại</span>
              </Link>
              {currentInvoice ? (
                <Link to={invoicePath(merchantId, currentInvoice.number)} className={btnSecondary}>
                  <Icon name="description" className="text-[18px]" />
                  <span>Xuất hợp đồng / VAT</span>
                </Link>
              ) : (
                <button type="button" disabled title="Gói hiện tại chưa có hóa đơn VAT" className={btnSecondary}>
                  <Icon name="description" className="text-[18px]" />
                  <span>Xuất hợp đồng / VAT</span>
                </button>
              )}
              <button type="button" onClick={sendReminder} disabled={!sub || reminding} title={sub ? 'Chỉ ghi nhận vào lịch sử liên hệ - không tự gửi tin nhắn' : 'Chưa có gói để nhắc gia hạn'}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-5 py-2.5 text-[14px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50">
                <Icon name="send" className="text-[18px]" />
                <span>{reminding ? 'Đang ghi nhận...' : 'Ghi nhận nhắc Zalo/SMS'}</span>
              </button>
              <button type="button" onClick={() => setRenewing(true)} className={`${btnPrimary} shadow-[0_4px_14px_rgba(255,91,0,0.3)]`}>
                <Icon name="autorenew" className="text-[20px]" />
                <span>Gia hạn gói ngay</span>
              </button>
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link to={merchantPath(merchant.id)} className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-semibold text-slate-600 hover:text-primary">{hashCode(merchant.code)}</Link>
          {statusBadge && (
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[14px] font-bold ${statusBadge.cls}`}>
              <span className={`h-2 w-2 rounded-full ${statusBadge.dot}`} />
              <span>{statusBadge.text}</span>
            </div>
          )}
          {sub && days !== null && days >= 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3.5 py-1 text-[14px] font-bold text-amber-800">
              <Icon name="hourglass_bottom" className="text-[16px] text-primary-container" />
              <span>Còn {days} ngày</span>
            </div>
          )}
        </div>
        {reminded !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[14px] text-emerald-800" role="status">
            <span className="flex items-center gap-2"><Icon name="check_circle" className="text-[18px]" />Đã ghi nhận lượt nhắc gia hạn{reminded ? ` ${hashCode(reminded)}` : ''} vào lịch sử liên hệ — cần gửi tin thủ công.</span>
            {merchant && sub && <ReminderLinks phone={merchant.phone} text={reminderText} />}
            <Link to={contactsPath(merchant.code)} className="font-bold text-emerald-900 underline">Xem lịch sử liên hệ</Link>
          </div>
        )}
      </div>

      {/* Merchant card */}
      <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary-container/5 blur-2xl" />
        <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100 shadow-sm">
                {merchant.image_url ? <img alt={merchant.name} className="h-full w-full object-cover" src={merchant.image_url} />
                  : merchant.emoji ? <span className="text-[36px]">{merchant.emoji}</span>
                  : <Icon name={merchant.icon ?? 'storefront'} className="text-[36px] text-primary" />}
              </div>
              {sub?.status === 'active' && !expired && (
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <Icon name="check" className="text-[14px]" />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link to={merchantPath(merchant.id)} className="min-w-0 break-words text-[22px] font-bold leading-tight text-slate-900 hover:text-primary sm:text-[24px]">{merchant.name}</Link>
                {sub && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-bold text-amber-900">
                    <Icon name="verified" className="text-[14px] text-amber-600" />
                    Đối tác {TIER_SHORT[sub.plan_tier]} F&amp;B
                  </span>
                )}
                <span className="rounded bg-slate-100 px-2.5 py-0.5 text-[12px] font-semibold text-slate-500">{hashCode(merchant.code)}</span>
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-2 text-[14px] text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex min-w-0 items-center gap-1.5"><Icon name="storefront" className="text-[17px] text-slate-400" /><span className="truncate">{merchant.category ?? '—'}</span></div>
                <div className="flex min-w-0 items-center gap-1.5"><Icon name="call" className="text-[17px] text-slate-400" /><a href={`tel:${merchant.phone}`} className="truncate font-semibold text-slate-900 hover:text-primary">{merchant.phone}</a></div>
                <div className="flex min-w-0 items-center gap-1.5"><Icon name="mail" className="text-[17px] text-slate-400" />{merchant.email ? <a href={`mailto:${merchant.email}`} className="truncate hover:text-primary">{merchant.email}</a> : <span>—</span>}</div>
                <div className="flex items-start gap-1.5 font-medium text-slate-800 sm:col-span-2 xl:col-span-3">
                  <Icon name="location_on" className="mt-0.5 text-[17px] text-primary-container" />
                  <span className="min-w-0">{merchant.address_full ?? merchant.address}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-base font-bold text-white shadow-sm">{initials(amName)}</div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Account Manager phụ trách</span>
              <span className="text-[15px] font-bold text-slate-900">{amName}</span>
              <span className="text-[12px] text-slate-500">{merchant.account_manager?.team ?? 'Phòng Quản lý & Phát triển Đối tác F&B'}</span>
            </div>
          </div>
        </div>

        {/* Related pages */}
        <div className="relative z-10 mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Link to={merchantPath(merchant.id)} className={chipCls}><Icon name="storefront" className="text-[18px]" />Hồ sơ Merchant</Link>
          {hasOnboarding && <Link to={onboardingPath(merchant.id)} className={chipCls}><Icon name="rocket_launch" className="text-[18px]" />Onboarding</Link>}
          <Link to={activityPath(merchant.id)} className={chipCls}><Icon name="history" className="text-[18px]" />Lịch sử hoạt động</Link>
          <Link to={contactsPath(merchant.code)} className={chipCls}><Icon name="call" className="text-[18px]" />Lịch sử liên hệ{contactCount !== undefined ? ` (${contactCount})` : ''}</Link>
          {invoices.length > 0 && <Link to={invoicePath(merchant.id)} className={chipCls}><Icon name="receipt_long" className="text-[18px]" />Hóa đơn ({invoices.length})</Link>}
          {churnCount > 0 && <Link to={churnPath()} className={`${chipCls} !bg-red-50 !text-red-700 hover:!bg-red-100`}><Icon name="warning" className="text-[18px]" />Cảnh báo rời bỏ ({churnCount})</Link>}
        </div>
        {openTickets.length > 0 && (
          <div className="relative z-10 mt-3 flex flex-col gap-1.5 text-[13px]">
            <span className="font-semibold uppercase tracking-wider text-slate-500">Yêu cầu hỗ trợ đang mở ({openTickets.length})</span>
            <ul className="flex flex-col gap-1">
              {openTickets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link to={supportPath(t.id)} className="font-bold text-primary hover:underline">{hashCode(t.code)}</Link>
                  <span className="min-w-0 truncate text-slate-700">{t.subject}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{TICKET_STATUSES[t.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Current subscription */}
      {sub && tierMeta ? (
        <div className="flex flex-col gap-6 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr text-white shadow-sm ${TIER_GRADIENT[sub.plan_tier]}`}>
                <Icon name={tierMeta.icon === 'stars' ? 'workspace_premium' : tierMeta.icon} className="text-[36px]" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-[22px] font-bold tracking-tight text-slate-900 sm:text-[26px]">{sub.plan_name}</span>
                  {sub.plan_tier === 'gold' && <span className="rounded-full bg-primary-fixed px-3 py-1 text-[13px] font-bold text-primary">Khuyên Dùng</span>}
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[13px] font-semibold text-slate-700">
                    <input type="checkbox" className="h-4 w-4 accent-primary-container" checked={sub.auto_renew} onChange={toggleAutoRenew} />
                    Tự động gia hạn
                  </label>
                </div>
                <span className="text-[14px] text-slate-500 sm:text-[15px]">
                  Mã hợp đồng điện tử: <strong className="font-mono text-[15px] text-slate-900 sm:text-[16px]">{hashCode(sub.code)}</strong> • Chu kỳ thanh toán: <span className="font-bold text-slate-800">{sub.cycle_label ?? '—'}</span>
                </span>
              </div>
            </div>
            <div className="text-left md:text-right">
              <span className="block text-[14px] font-semibold text-slate-500">Tổng chi phí gói {sub.cycle_label?.toLowerCase() ?? ''}</span>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 md:justify-end">
                <span className="text-[28px] font-extrabold leading-none tracking-tight text-primary-container sm:text-[34px]">{formatVnd(sub.amount_vnd)}</span>
                {sub.list_price_vnd != null && sub.list_price_vnd > sub.amount_vnd && (
                  <span className="text-[16px] font-medium text-slate-400 line-through sm:text-[18px]">{formatVnd(sub.list_price_vnd)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            <div className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <span className="text-[14px] font-medium text-slate-500">Đơn giá quy đổi / tháng</span>
              <span className="text-[20px] font-bold text-slate-900 sm:text-[22px]">{formatVnd(monthly)} / tháng</span>
              <span className="mt-1 flex items-start gap-1.5 text-[13px] font-semibold text-emerald-700">
                <Icon name="savings" className="text-[18px]" />
                <span className="min-w-0">{savePct > 0 ? `Tiết kiệm ${savePct}% thanh toán trọn kỳ (${formatVnd(sub.amount_vnd)})` : `Thanh toán trọn kỳ (${formatVnd(sub.amount_vnd)})`}</span>
              </span>
            </div>
            <div className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <span className="text-[14px] font-medium text-slate-500">Hình thức thanh toán</span>
              <span className="break-words text-[20px] font-bold text-slate-900 sm:text-[22px]">{sub.payment_method ?? '—'}</span>
              <span className="mt-1 break-all font-mono text-[13px] font-medium text-slate-500">Mã GD: {sub.payment_ref ?? '—'}</span>
            </div>
            <div className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <span className="text-[14px] font-medium text-slate-500">Thời hạn hiệu lực</span>
              <span className="text-[18px] font-bold text-slate-900 sm:text-[20px] xl:text-[22px]">{formatDate(sub.start_date)} - {formatDate(sub.end_date)}</span>
              <span className="mt-1 flex items-start gap-1 text-[13px] font-bold text-primary">
                <Icon name="calendar_today" className="text-[16px]" />
                <span className="min-w-0">Tổng thời gian: {formatNumber(totalDays)} ngày ({expired ? `Đã hết hạn ${-(days ?? 0)} ngày` : `Còn ${days} ngày`})</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2.5">
                <Icon name="timelapse" className="text-[24px] text-primary-container" />
                <span className="text-[16px] font-bold text-slate-900 sm:text-[18px]">Tiến độ thời gian sử dụng gói</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] sm:text-[15px]">
                <span className="text-slate-600">Đã dùng: <strong className="text-slate-900">{formatNumber(usedDays)} / {formatNumber(totalDays)} ngày ({usedPct}%)</strong></span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-slate-400 sm:block" />
                <span className={`font-bold ${expired ? 'text-red-600' : 'text-emerald-700'}`}>{expired ? 'Đã hết hạn' : `Còn lại: ${days} ngày`}</span>
              </div>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full transition-all duration-700 ${warning || expired ? 'bg-error' : 'bg-primary-container'}`} style={{ width: `${usedPct}%` }} />
            </div>
            <div className="flex flex-col justify-between gap-2 pt-0.5 text-[14px] text-slate-500 sm:flex-row sm:items-center">
              <span className="font-medium">Ngày kích hoạt: <strong className="text-slate-800">{formatDate(sub.start_date)}</strong></span>
              <span className={`rounded-full px-3 py-1 text-center text-[13px] font-bold ${warning || expired ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {expired ? 'Hợp đồng đã hết hạn • Cần gia hạn ngay' : warning ? 'Sắp hết hạn • Đã chạm ngưỡng cảnh báo (<15 ngày)' : 'Trạng thái ổn định • Chưa chạm ngưỡng cảnh báo (<15 ngày)'}
              </span>
              <span className="font-medium">Ngày hết hạn: <strong className="text-slate-800">{formatDate(sub.end_date)}</strong></span>
            </div>
          </div>

          {benefits.length > 0 && (
            <div className="flex flex-col gap-4 pt-2">
              <span className="flex items-center gap-2 text-[18px] font-bold text-slate-900 sm:text-[20px]">
                <Icon name="stars" className="text-[24px] text-primary-container" />
                Quyền lợi độc quyền {sub.plan_name.replace(/\s*\(.*\)/, '')} đang kích hoạt:
              </span>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {benefits.map((b) => (
                  <div key={b.title} className="flex items-start gap-3.5 rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-slate-100/70">
                    <Icon name={b.icon} className="mt-0.5 shrink-0 text-[26px] text-emerald-600" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-[16px] font-bold text-slate-900 sm:text-[17px]">{b.title}</span>
                      {b.description && <span className="text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">{b.description}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <p className="text-[15px] text-slate-500">Merchant này chưa đăng ký gói dịch vụ nào.</p>
          <button type="button" onClick={() => setRenewing(true)} className={`${btnPrimary} mt-4`}>
            <Icon name="add_circle" className="text-[20px]" />
            Đăng ký gói ngay
          </button>
        </div>
      )}

      {/* History */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <Icon name="history" className="text-[26px] text-primary-container" />
            <h2 className="text-[18px] font-bold text-slate-900 sm:text-[20px]">Bảng Lịch Sử Gia Hạn Dịch Vụ</h2>
          </div>
          <span className="text-[14px] font-medium text-slate-500 sm:text-[15px]">Tổng cộng: <strong className="text-[16px] text-slate-900">{String(subs.length).padStart(2, '0')} lần đăng ký / gia hạn</strong></span>
        </div>
        <ResponsiveTable minWidth={980}>
          <table className="w-full whitespace-nowrap border-collapse text-left">
            <thead>
              <tr className="bg-primary-container text-[15px] font-bold text-white">
                <th className="px-5 py-4">Mã HĐ</th>
                <th className="px-5 py-4">Gói Dịch Vụ</th>
                <th className="px-5 py-4">Chu Kỳ</th>
                <th className="px-5 py-4">Ngày Ký</th>
                <th className="px-5 py-4">Thời Hạn Hiệu Lực</th>
                <th className="px-5 py-4 text-right">Giá Trị Thanh Toán</th>
                <th className="px-5 py-4 text-center">Trạng Thái</th>
                <th className="px-5 py-4 text-center">Thao Tác (Hóa Đơn / VAT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[15px] text-slate-800">
              {subs.map((s) => {
                const isCur = s.id === sub?.id
                const inv = invoiceBySub.get(s.id)
                const free = s.amount_vnd === 0
                const noInvTitle = free ? 'Gói miễn phí - không có hóa đơn' : 'Gói này chưa có hóa đơn VAT'
                const act = 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary'
                return (
                  <tr key={s.id} className={`transition-colors ${isCur ? 'hover:bg-amber-50/40' : 'hover:bg-slate-50'}`}>
                    <td className={`px-5 py-4 font-mono text-[16px] ${isCur ? 'font-bold text-primary' : 'font-medium text-slate-500'}`}>
                      {inv ? <Link to={invoicePath(merchantId, inv.number)} className="hover:underline" title={`Xem hóa đơn ${inv.number}`}>{hashCode(s.code)}</Link> : hashCode(s.code)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${TIER_META[s.plan_tier].dot}`} />
                        <span className={`text-[16px] ${isCur ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>{s.plan_name}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-4 ${isCur ? 'font-semibold' : ''}`}>{s.cycle_label ?? '—'}</td>
                    <td className="px-5 py-4 font-mono text-slate-500">{formatDate(s.signed_at ?? s.start_date)}</td>
                    <td className={`px-5 py-4 font-mono font-medium ${isCur ? 'text-slate-900' : 'text-slate-600'}`}>{formatDate(s.start_date)} - {formatDate(s.end_date)}</td>
                    <td className={`px-5 py-4 text-right font-mono text-[17px] font-bold ${free ? 'text-emerald-700' : 'text-slate-900'}`}>{free ? 'Miễn phí (0 đ)' : formatVnd(s.amount_vnd)}</td>
                    <td className="px-5 py-4 text-center">
                      {s.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[14px] font-bold text-emerald-800">
                          <Icon name="check_circle" className="text-[16px]" />
                          {STATUS_TEXT.active}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[14px] font-medium text-slate-700">{STATUS_TEXT[s.status]}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {inv ? (
                          <>
                            <Link to={invoicePath(merchantId, inv.number)} title="Xem hóa đơn / hợp đồng" aria-label="Xem hóa đơn / hợp đồng" className={act}>
                              <Icon name="visibility" className="text-[20px]" />
                            </Link>
                            <Link to={`${invoicePath(merchantId, inv.number)}&print=1`} title="Tải PDF hóa đơn VAT" aria-label="Tải PDF hóa đơn VAT" className={act}>
                              <Icon name="download" className="text-[20px]" />
                            </Link>
                          </>
                        ) : (
                          <span className="text-[13px] text-slate-400" title={noInvTitle}>{free ? 'Không có HĐ' : 'Chưa có HĐ'}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {subs.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">Chưa có lịch sử đăng ký.</td></tr>
              )}
            </tbody>
          </table>
        </ResponsiveTable>
        <div className="flex flex-col items-start justify-between gap-2 border-t border-slate-100 bg-slate-50 p-4 text-[14px] text-slate-500 sm:flex-row sm:items-center">
          <span>Dữ liệu hóa đơn điện tử GTGT kết nối trực tiếp cơ quan thuế qua hệ thống Giaodoan e-Invoice</span>
          <a href={`https://${COMPANY.lookupUrl}`} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 text-[14px] font-bold text-primary hover:underline">
            <span>Tra cứu cổng hóa đơn điện tử</span>
            <Icon name="open_in_new" className="text-[16px]" />
          </a>
        </div>
      </div>

      {renewing && subsQ.data && (
        <SubscriptionFormModal
          title={sub ? 'Gia hạn gói dịch vụ' : 'Đăng ký gói dịch vụ'}
          merchantId={merchantId}
          subs={subs}
          defaultPlanCode={sub && sub.plan_tier !== 'trial' ? sub.plan_tier : undefined}
          onClose={closeRenew}
          onDone={({ subscription, invoice }) => {
            toast(`Đã gia hạn #${subscription.code} - Hóa đơn ${invoice.number}`)
            navigate(invoicePath(merchantId, invoice.number))
          }}
        />
      )}
    </div>
  )
}
