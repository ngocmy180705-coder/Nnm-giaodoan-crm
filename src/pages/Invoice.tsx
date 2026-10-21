import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { btnPrimary, btnSecondary } from '../components/Form'
import { ErrorState, Loading } from '../components/Loading'
import { COMPANY } from '../lib/company'
import { formatDate, formatVnd, hashCode } from '../lib/format'
import { useBreadcrumb, useToast } from '../lib/layoutContext'
import { invoicePath, merchantPath, ROUTES, subscriptionPath } from '../lib/links'
import { supabase } from '../lib/supabase'
import type { Invoice as InvoiceRow, Merchant, Staff, Subscription } from '../lib/types'
import { useQuery } from '../lib/useQuery'
import './invoice/invoice-print.css'

type InvoiceWithIssuer = InvoiceRow & { issuer: Staff | null }

/** 25/12/2024 - 14:35:20 (GMT+7) */
function fullStamp(value: string | null | undefined, sep = ' - '): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  )
  return `${parts.day}/${parts.month}/${parts.year}${sep}${parts.hour}:${parts.minute}:${parts.second}`
}

const STATUS_BADGE = {
  paid: { text: 'ĐÃ THANH TOÁN THÀNH CÔNG - HỢP LỆ', cls: 'bg-emerald-50 text-tertiary', dot: 'bg-tertiary' },
  pending: { text: 'CHỜ THANH TOÁN', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  void: { text: 'HÓA ĐƠN ĐÃ HỦY', cls: 'bg-error-container text-error', dot: 'bg-error' },
} as const

export default function Invoice() {
  const { merchantId = '' } = useParams()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const no = params.get('no')
  const wantPrint = params.get('print') === '1'

  const merchantQ = useQuery<Merchant | null>(() => supabase.from('merchants').select('*').eq('id', merchantId).maybeSingle(), [merchantId])
  const subsQ = useQuery<Subscription[]>(() => supabase.from('subscriptions').select('*').eq('merchant_id', merchantId).order('start_date', { ascending: false }), [merchantId])
  const invQ = useQuery<InvoiceWithIssuer[]>(
    () => supabase.from('invoices').select('*, issuer:staff!issuer_staff_id(*)').eq('merchant_id', merchantId).order('issued_at', { ascending: false }),
    [merchantId],
  )

  const invoices = invQ.data ?? []
  const subs = subsQ.data ?? []
  const inv = useMemo(() => {
    if (no) return invoices.find((i) => i.number === no) ?? null
    const cur = subs.find((s) => s.is_current)
    return (cur && invoices.find((i) => i.subscription_id === cur.id)) ?? invoices[0] ?? null
  }, [invoices, subs, no])
  const sub = inv ? subs.find((s) => s.id === inv.subscription_id) : undefined

  useBreadcrumb([
    { label: 'Thời hạn & gia hạn', to: ROUTES.subscriptions },
    { label: `Chi tiết gói #${sub?.code ?? '—'}`, to: subscriptionPath(merchantId) },
    inv ? `Hóa đơn #${inv.number}` : 'Hóa đơn',
  ])

  // ?print=1 (the "download" icon on the subscription history): open the print dialog once the invoice is on screen
  const printed = useRef(false)
  useEffect(() => {
    if (!wantPrint || !inv || printed.current) return
    printed.current = true
    const next = new URLSearchParams(params)
    next.delete('print')
    setParams(next, { replace: true })
    toast('Chọn "Lưu dưới dạng PDF" trong hộp thoại in')
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPrint, inv?.id])

  const loading = (merchantQ.loading && !merchantQ.data) || (invQ.loading && !invQ.data) || (subsQ.loading && !subsQ.data)
  const error = merchantQ.error ?? invQ.error ?? subsQ.error
  if (loading) return <div className="px-margin py-space-lg"><Loading /></div>
  if (error) return <div className="px-margin py-space-lg"><ErrorState message={error} onRetry={() => { merchantQ.reload(); invQ.reload(); subsQ.reload() }} /></div>

  const merchant = merchantQ.data
  if (!merchant || !inv) {
    return (
      <div className="px-margin py-space-lg">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-lowest p-8 text-center shadow-sm sm:p-12">
          <Icon name="receipt_long" className="text-[40px] text-outline-variant" />
          <p className="text-[15px] text-secondary">{merchant ? 'Không tìm thấy hóa đơn cho gói dịch vụ này.' : 'Không tìm thấy merchant này.'}</p>
          <Link to={merchant ? subscriptionPath(merchantId) : ROUTES.subscriptions} className={btnPrimary}>{merchant ? 'Quay lại chi tiết gói' : 'Quay lại danh sách gói'}</Link>
        </div>
      </div>
    )
  }

  const badge = STATUS_BADGE[inv.status]
  const repName = inv.merchant_rep_name ?? merchant.contact_name
  const repPhone = inv.merchant_rep_phone ?? merchant.phone
  const hasDiscount = inv.discount_vnd > 0
  const listPrice = inv.list_price_vnd ?? inv.total_vnd + inv.discount_vnd
  const bank = (inv.payment_method ?? '').replace(/^Chuyển khoản\s*/i, '')
  const lookupHref = `https://${COMPANY.lookupUrl}`
  const termText = inv.term_months != null ? `${inv.term_months} Tháng` : sub?.cycle_label ?? '—'
  const mailTo = merchant.email ?? merchant.personal_email
  const mailHref = mailTo
    ? `mailto:${mailTo}?subject=${encodeURIComponent(`Hóa đơn ${inv.number} - ${merchant.name}`)}&body=${encodeURIComponent(
        `Kính gửi ${repName ?? merchant.name},\n\nGiaodoan gửi anh/chị hóa đơn ${inv.number} (${inv.line_title ?? 'Gia hạn dịch vụ'}), tổng thanh toán ${formatVnd(inv.total_vnd)}, hiệu lực ${formatDate(inv.new_start_date)} - ${formatDate(inv.new_end_date)}.\nTra cứu hóa đơn điện tử: ${lookupHref}\nXem chi tiết: ${window.location.origin}${invoicePath(merchantId, inv.number)}\n\nTrân trọng,\n${COMPANY.name}\nHotline: ${COMPANY.hotline}`,
      )}`
    : null
  const toolBtn = `${btnSecondary} min-h-10 whitespace-nowrap !px-3 !py-1.5 text-xs max-sm:min-w-[42%]`

  return (
    <div className="invoice-page flex flex-col gap-space-md px-margin py-space-lg print:p-0">
      {/* Toolbar (not printed) */}
      <div className="flex flex-col gap-space-sm print:hidden">
        <PageHeader
          title="Hóa đơn gia hạn dịch vụ"
          subtitle={
            <>
              <Link to={merchantPath(merchant.id)} className="font-semibold text-on-surface hover:text-primary hover:underline">{merchant.name}</Link>
              {' • '}
              {sub ? <Link to={subscriptionPath(merchantId)} className="font-semibold text-primary hover:underline">Gói {hashCode(sub.code)}</Link> : 'Chưa gắn gói'}
              {' • '}
              <span className="font-semibold text-primary">{hashCode(inv.number)}</span>
            </>
          }
          actions={
            <>
              <button type="button" onClick={() => window.print()} className={toolBtn}>
                <Icon name="print" className="text-[16px] text-secondary" /> In hóa đơn
              </button>
              <button type="button" onClick={() => { toast('Chọn "Lưu dưới dạng PDF" trong hộp thoại in'); window.print() }} className={toolBtn}>
                <Icon name="download" className="text-[16px] text-secondary" /> Tải PDF
              </button>
              {mailHref ? (
                <a href={mailHref} className={toolBtn}>
                  <Icon name="mail" className="text-[16px] text-secondary" /> Gửi Email
                </a>
              ) : (
                <button type="button" disabled title="Merchant chưa có email" className={toolBtn}>
                  <Icon name="mail" className="text-[16px] text-secondary" /> Gửi Email
                </button>
              )}
              <Link to={subscriptionPath(merchantId)} className={`${btnPrimary} min-h-10 whitespace-nowrap !px-3 !py-1.5 text-xs max-sm:min-w-[42%]`}>
                <Icon name="arrow_back" className="text-[16px]" /> Quay lại
              </Link>
            </>
          }
        />
        {invoices.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-secondary">
            <label htmlFor="invoice-switch" className="font-semibold">Hóa đơn của merchant:</label>
            <select
              id="invoice-switch"
              value={inv.number}
              onChange={(e) => setParams({ no: e.target.value })}
              className="min-h-10 w-full rounded-lg bg-surface-container-low px-3 py-2 text-[16px] font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container sm:w-auto sm:text-[14px]"
            >
              {invoices.map((i) => <option key={i.id} value={i.number}>{hashCode(i.number)} • {formatDate(i.issued_at)} • {formatVnd(i.total_vnd)}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Invoice document (laid out in its desktop form whenever printed: print: variants) */}
      <div id="invoice-printable" className="relative flex flex-col justify-between gap-3 overflow-hidden rounded-xl border border-slate-200/80 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
        <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-primary-container via-primary to-primary-fixed" />

        {/* 1. Header */}
        <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-200/80 pb-2 pt-1 sm:flex-row sm:gap-4 print:flex-row print:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-lg font-bold text-on-primary shadow-sm">G</div>
            <div className="flex min-w-0 flex-col">
              <h2 className="text-sm font-bold uppercase leading-snug tracking-tight text-on-surface">{COMPANY.name}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-secondary sm:text-xs print:text-xs">
                <span>MST: <strong className="font-semibold text-on-surface">{COMPANY.taxCode}</strong></span>
                <span>•</span>
                <span>Hotline: <strong className="font-semibold text-primary">{COMPANY.hotline}</strong></span>
                <span className="hidden sm:inline print:inline">•</span>
                <span className="break-all">{COMPANY.email}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-tight text-secondary sm:text-xs print:text-xs">{COMPANY.address}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end sm:text-right print:items-end print:text-right">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {badge.text}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h1 className="text-base font-bold uppercase tracking-tight text-on-surface">HÓA ĐƠN GIA HẠN DỊCH VỤ</h1>
              <span className="text-xs font-bold text-primary">Số: {hashCode(inv.number)}</span>
            </div>
            <div className="text-xs text-secondary sm:text-[11px] print:text-[11px]">
              <span>Thời gian lập: <strong className="font-medium text-on-surface">{fullStamp(inv.issued_at)} (GMT+7)</strong></span>
              <span className="mx-1 hidden sm:inline print:inline">•</span>
              <span className="block sm:inline print:inline">HĐĐT: <strong className="font-mono font-medium text-on-surface">{inv.einvoice_series ?? '—'}</strong> {inv.einvoice_no ? `#${inv.einvoice_no}` : ''}</span>
            </div>
          </div>
        </div>

        {/* 2. Both parties */}
        <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-container-low p-2 text-[13px] sm:grid-cols-2 sm:p-3 sm:text-xs print:grid-cols-2 print:p-3 print:text-xs">
          <div className="flex min-w-0 flex-col gap-1.5 rounded border border-slate-200/80 bg-surface-container-lowest p-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1.5">
                <Icon name="storefront" className="text-[16px] text-primary-container" />
                <span className="text-xs font-bold uppercase text-on-surface">ĐƠN VỊ THUÊ DỊCH VỤ (MERCHANT)</span>
              </div>
              <Link to={merchantPath(merchant.id)} className="flex-shrink-0 rounded bg-primary-fixed px-1.5 py-0.5 text-[11px] font-bold text-primary hover:underline">{hashCode(merchant.code)}</Link>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-secondary">Thương hiệu:</span>
              <Link to={merchantPath(merchant.id)} className="col-span-2 font-bold text-on-surface hover:text-primary">{merchant.name}</Link>
              <span className="text-secondary">Mã số thuế:</span>
              <span className="col-span-2 font-mono font-medium text-on-surface">{merchant.tax_code ?? '—'}</span>
              <span className="text-secondary">Địa chỉ:</span>
              <span className="col-span-2 text-on-surface">{merchant.address_full ?? merchant.address}</span>
              <span className="text-secondary">Đại diện &amp; LH:</span>
              <span className="col-span-2 font-medium text-on-surface">{repName ?? '—'} {repPhone && <span className="font-normal text-secondary">({repPhone})</span>}</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 rounded border border-slate-200/80 bg-surface-container-lowest p-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1.5">
                <Icon name="verified_user" className="text-[16px] text-primary-container" />
                <span className="text-xs font-bold uppercase text-on-surface">ĐƠN VỊ THỰC HIỆN GIA HẠN</span>
              </div>
              <span className="flex-shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-bold text-secondary">GIAODOAN HUB</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-secondary">Đơn vị nhận:</span>
              <span className="col-span-2 font-medium text-on-surface">{inv.issuer_unit ?? '—'}</span>
              <span className="text-secondary">Chuyên viên:</span>
              <span className="col-span-2 font-bold text-on-surface">
                {inv.issuer?.full_name ?? '—'}
                {inv.issuer && <span className="font-normal text-secondary"> ({[inv.issuer.code, inv.issuer.title].filter(Boolean).join(' • ')})</span>}
              </span>
              <span className="text-secondary">Phương thức:</span>
              <span className="col-span-2 font-medium text-on-surface">{inv.payment_method ?? '—'} {inv.payment_ref && <span className="break-all font-mono font-bold text-primary">({inv.payment_ref})</span>}</span>
              <span className="text-secondary">Trạng thái:</span>
              <span className={`col-span-2 flex items-center gap-1 font-bold ${inv.status === 'paid' ? 'text-tertiary' : 'text-secondary'}`}>
                <Icon name={inv.status === 'paid' ? 'check_circle' : 'schedule'} className="text-[14px]" /> {inv.payment_note ?? (inv.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán')}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Term strip */}
        <div className="grid grid-cols-2 gap-2.5 rounded-lg bg-surface-container-low p-2.5 sm:grid-cols-4 print:grid-cols-4">
          <div className="flex flex-col rounded border border-slate-200/80 bg-surface-container-lowest p-2">
            <span className="text-[11px] uppercase tracking-wider text-secondary">Ngày gia hạn</span>
            <span className="text-sm font-bold text-on-surface">{formatDate(inv.issued_at)}</span>
            <span className="text-[10px] text-secondary">Xác nhận thanh toán</span>
          </div>
          <div className="flex flex-col rounded border border-slate-200/80 bg-surface-container-lowest p-2">
            <span className="text-[11px] uppercase tracking-wider text-secondary">Hạn hợp đồng cũ</span>
            <span className={`text-sm font-bold text-secondary ${inv.previous_end_date ? 'line-through' : ''}`}>{inv.previous_end_date ? formatDate(inv.previous_end_date) : '—'}</span>
            <span className="text-[10px] text-secondary">
              {inv.previous_contract_code ? <>Hợp đồng <Link to={subscriptionPath(merchantId)} className="hover:text-primary hover:underline">{hashCode(inv.previous_contract_code)}</Link></> : 'Đăng ký mới'}
            </span>
          </div>
          <div className="flex flex-col rounded border border-primary/30 bg-primary-fixed/10 p-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Ngày hiệu lực mới</span>
            <span className="text-sm font-bold text-primary">{formatDate(inv.new_start_date)}</span>
            <span className="text-[10px] font-medium text-tertiary">Kích hoạt 00:00:00</span>
          </div>
          <div className="flex flex-col rounded border border-slate-200/80 bg-surface-container-lowest p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">Ngày hết hạn mới</span>
              {inv.term_months != null && <span className="rounded bg-primary px-1.5 text-[9px] font-bold text-white">{inv.term_months} Tháng</span>}
            </div>
            <span className="text-sm font-bold text-on-surface">{formatDate(inv.new_end_date)}</span>
            <span className="text-[10px] text-secondary">Kết thúc kỳ 23:59:59</span>
          </div>
        </div>

        {/* 4. Cost table (phones: a stacked line item; sm+ and print: the table) */}
        <div className="shrink-0 overflow-hidden rounded-lg border border-slate-200/80 text-xs">
          <div className="flex flex-col gap-2 bg-surface-container-lowest p-3 text-[13px] sm:hidden print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-on-surface">{inv.line_title ?? sub?.plan_name ?? 'Gói dịch vụ'}</span>
              {sub && <Link to={subscriptionPath(merchantId)} className="rounded bg-primary-fixed px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{hashCode(sub.code)}</Link>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <dt className="text-secondary">Thời hạn</dt><dd className="text-right font-bold text-on-surface">{termText}</dd>
              <dt className="text-secondary">Đơn giá niêm yết</dt><dd className="text-right font-medium text-on-surface">{formatVnd(listPrice)}</dd>
              <dt className="text-secondary">Chiết khấu trả trước</dt>
              <dd className={`text-right font-semibold ${hasDiscount ? 'text-emerald-600' : 'text-secondary'}`}>{hasDiscount ? `-${formatVnd(inv.discount_vnd)} (${inv.discount_pct}%)` : '—'}</dd>
              <dt className="font-bold text-on-surface">Thành tiền</dt><dd className="text-right font-bold text-on-surface">{formatVnd(inv.total_vnd)}</dd>
            </dl>
          </div>
          <div className="hidden overflow-x-auto sm:block print:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-primary-container text-white">
                  <th className="w-12 px-3 py-2 text-center text-[11px] font-semibold tracking-wide">STT</th>
                  <th className="px-3 py-2 text-[11px] font-semibold tracking-wide">Danh mục dịch vụ &amp; Mã gói</th>
                  <th className="w-24 px-3 py-2 text-center text-[11px] font-semibold tracking-wide">Thời hạn</th>
                  <th className="w-28 px-3 py-2 text-right text-[11px] font-semibold tracking-wide">Đơn giá niêm yết</th>
                  <th className="w-36 px-3 py-2 text-right text-[11px] font-semibold tracking-wide">Chiết khấu trả trước</th>
                  <th className="w-32 px-3 py-2 text-right text-[11px] font-semibold tracking-wide">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-surface-container-lowest">
                <tr>
                  <td className="px-3 py-2.5 text-center font-bold text-secondary">01</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-surface">{inv.line_title ?? sub?.plan_name ?? 'Gói dịch vụ'}</span>
                      {sub && <Link to={subscriptionPath(merchantId)} className="rounded bg-primary-fixed px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary hover:underline">{hashCode(sub.code)}</Link>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-on-surface">{termText}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-secondary">{formatVnd(listPrice)}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${hasDiscount ? 'text-emerald-600' : 'text-secondary'}`}>
                    {hasDiscount ? `-${formatVnd(inv.discount_vnd)} (${inv.discount_pct}%)` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-on-surface">{formatVnd(inv.total_vnd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col justify-between gap-2 border-t border-slate-200/80 bg-surface-container-low px-3 py-2 sm:flex-row sm:items-center sm:px-4 print:flex-row print:items-center print:px-4">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] sm:text-xs print:text-xs">
              <span className="italic text-secondary">Số tiền bằng chữ:</span>
              <span className="font-bold text-primary">{inv.amount_in_words ?? '—'}</span>
              {inv.vat_note && <span className="text-[11px] text-secondary">{inv.vat_note}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs font-bold uppercase text-on-surface">{inv.status === 'paid' ? 'Tổng tiền đã thanh toán:' : 'Tổng tiền cần thanh toán:'}</span>
              <span className="text-lg font-bold leading-none text-primary-container">{formatVnd(inv.total_vnd)}</span>
              {inv.status === 'paid' && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-tertiary">Đã hạch toán đủ{bank ? ` qua ${bank}` : ''}</span>
              )}
            </div>
          </div>
        </div>

        {/* 5. Signatures + lookup */}
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3 print:grid-cols-3">
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200/80 bg-surface-container-low p-2.5 text-xs">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${inv.merchant_signed_at ? 'bg-emerald-50 text-tertiary' : 'bg-surface-container text-secondary'}`}>
              <Icon name={inv.merchant_signed_at ? 'verified' : 'pending'} className="text-[18px]" />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">ĐẠI DIỆN ĐỐI TÁC (MERCHANT)</span>
              <span className="truncate text-xs font-bold text-on-surface">{(repName ?? '—').toUpperCase()}</span>
              <span className="truncate text-[10px] text-secondary">
                {inv.merchant_signed_at ? `Ký số ${inv.merchant_sign_provider ?? ''} • ${fullStamp(inv.merchant_signed_at, ' ')}` : 'Chưa ký số'}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200/80 bg-surface-container-low p-2.5 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <Icon name="domain_verification" className="text-[18px]" />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">ĐẠI DIỆN CÔNG TY GIAODOAN</span>
              <span className="truncate text-xs font-bold text-on-surface">{(inv.issuer?.full_name ?? '—').toUpperCase()}</span>
              <span className="truncate text-[10px] text-secondary">{inv.issuer_sign_note ?? 'Chưa ký số'}</span>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200/80 bg-surface-container-low p-2.5 text-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-container-lowest p-0.5 shadow-sm">
              <svg className="h-full w-full text-on-surface" fill="currentColor" viewBox="0 0 100 100">
                <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z" />
                <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z" />
                <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z" />
                <rect height="15" width="8" x="45" y="15" />
                <rect height="8" width="8" x="45" y="35" />
                <rect height="8" width="10" x="15" y="45" />
                <rect height="8" width="18" x="35" y="45" />
                <rect height="12" width="12" x="60" y="45" />
                <rect height="8" width="10" x="80" y="45" />
                <rect height="20" width="8" x="45" y="60" />
                <rect height="8" width="15" x="60" y="65" />
                <rect height="20" width="10" x="80" y="60" />
                <rect height="10" width="12" x="60" y="80" />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[10px] font-bold uppercase text-on-surface">TRA CỨU HÓA ĐƠN TRỰC TUYẾN</span>
              <a className="flex items-center gap-0.5 truncate text-[11px] font-bold text-primary hover:underline" href={lookupHref} target="_blank" rel="noreferrer">
                {COMPANY.lookupUrl}
                <Icon name="open_in_new" className="text-[13px]" />
              </a>
              <span className="truncate text-[10px] text-secondary">NĐ 123/2020/NĐ-CP • 256-bit SSL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
