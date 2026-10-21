import { useMemo, useState, type FormEvent } from 'react'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { Field, btnPrimary, btnSecondary, inputCls } from '../../components/Form'
import { formatDate, formatVnd } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Invoice, Merchant, ServicePlan, Subscription } from '../../lib/types'
import { useQuery } from '../../lib/useQuery'
import { CYCLES, TIER_META, addDays, amountInWords, contractEnd, listPrice, todayIso } from './shared'

export interface MerchantOption {
  id: string
  code: string
  name: string
}

export interface CreatedSubscription {
  subscription: Subscription
  invoice: Invoice
}

/**
 * "Đăng ký gói mới" (list) and "Gia hạn gói" (detail): inserts a new subscription (+ its invoice), flips the
 * merchant's previous current contract to completed. Contract code (GDV-n) and invoice number come from DB sequences.
 */
export default function SubscriptionFormModal({
  merchants,
  merchantId,
  subs,
  defaultPlanCode,
  title,
  onClose,
  onDone,
}: {
  /** choices when the merchant is not fixed (list screen) */
  merchants?: MerchantOption[]
  /** fixed merchant (detail screen "Gia hạn") */
  merchantId?: string
  /** known subscriptions, used to default the start date to the day after the current contract ends */
  subs: Subscription[]
  defaultPlanCode?: string
  title: string
  onClose: () => void
  onDone: (created: CreatedSubscription) => void
}) {
  const { data: plans } = useQuery<ServicePlan[]>(() => supabase.from('service_plans').select('*').order('sort_order'), [])
  const [mid, setMid] = useState(merchantId ?? '')
  const [planCode, setPlanCode] = useState(defaultPlanCode ?? '')
  const [months, setMonths] = useState<number>(12)
  const [start, setStart] = useState('')
  const [discount, setDiscount] = useState('0')
  const [payment, setPayment] = useState('Chuyển khoản Vietcombank')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const plan = (plans ?? []).find((p) => p.code === planCode) ?? (plans ?? []).find((p) => p.code === 'gold') ?? (plans ?? [])[0]

  // default start: day after the merchant's current contract ends (if still running), otherwise today
  const defaultStart = useMemo(() => {
    const cur = subs.find((s) => s.merchant_id === mid && s.is_current)
    const t = todayIso()
    return cur && cur.end_date >= t ? addDays(cur.end_date, 1) : t
  }, [subs, mid])
  const startDate = start || defaultStart

  const pct = Math.min(100, Math.max(0, Number(discount) || 0))
  const list = plan ? listPrice(plan, months) : 0
  const amount = Math.round(list * (1 - pct / 100))
  const end = contractEnd(startDate, months)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!plan || !mid) return
    setSaving(true)
    setErr(null)
    let subId: string | null = null
    let invId: string | null = null
    let prevRows: Subscription[] = [] // original current contracts, restored if a later step fails
    let flipped = false
    try {
      const { data: m, error: me } = await supabase.from('merchants').select('*').eq('id', mid).single()
      if (me) throw me
      const merchant = m as Merchant
      const { data: prevData, error: pe } = await supabase.from('subscriptions').select('*').eq('merchant_id', mid).eq('is_current', true)
      if (pe) throw pe
      prevRows = (prevData ?? []) as Subscription[]
      const prev = [...prevRows].sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
      const cycleLabel = CYCLES.find((c) => c.months === months)?.label ?? `${months} Tháng`

      // 1. new contract (not current yet so a failure later leaves the old one intact)
      const { data: sub, error: se } = await supabase.from('subscriptions').insert({
        merchant_id: mid,
        plan_id: plan.id,
        plan_name: plan.name,
        plan_tier: plan.code,
        cycle_months: months,
        cycle_label: cycleLabel,
        contract_note: note.trim() || `Hợp đồng ${months === 12 ? '1 năm' : `${months} tháng`}${prev ? ' (Gia hạn)' : ' (Đăng ký mới)'}`,
        list_price_vnd: list,
        discount_pct: pct,
        amount_vnd: amount,
        signed_at: todayIso(),
        start_date: startDate,
        end_date: end,
        status: 'active',
        is_current: false,
        auto_renew: false,
        payment_method: payment.trim() || null,
        account_manager_id: prev?.account_manager_id ?? merchant.account_manager_id,
      }).select().single()
      if (se) throw se
      subId = (sub as Subscription).id

      // 2. its invoice
      const { data: inv, error: ie } = await supabase.from('invoices').insert({
        merchant_id: mid,
        subscription_id: subId,
        issued_at: new Date().toISOString(),
        einvoice_series: `1C${String(new Date().getFullYear()).slice(2)}TGD`,
        status: 'paid',
        line_title: `${plan.name.replace('Gói ', 'Gói Dịch Vụ ')} - Quản Trị Merchant Chuyên Nghiệp`,
        term_months: months,
        list_price_vnd: list,
        discount_vnd: list - amount,
        discount_pct: pct,
        total_vnd: amount,
        amount_in_words: amountInWords(amount),
        vat_note: '(VAT 0% phần mềm)',
        previous_contract_code: prev?.code ?? null,
        previous_end_date: prev?.end_date ?? null,
        new_start_date: startDate,
        new_end_date: end,
        payment_method: payment.trim() || null,
        merchant_rep_name: merchant.contact_name,
        merchant_rep_phone: merchant.phone,
        issuer_unit: 'Phòng Quản lý & Phát triển Đối tác Giaodoan',
        issuer_staff_id: prev?.account_manager_id ?? merchant.account_manager_id,
      }).select().single()
      if (ie) throw ie
      invId = (inv as Invoice).id

      // 3. switch the "current" flag
      flipped = true
      const { error: ue } = await supabase.from('subscriptions').update({ is_current: false, status: 'completed' }).eq('merchant_id', mid).eq('is_current', true)
      if (ue) throw ue
      const { data: cur, error: ce } = await supabase.from('subscriptions').update({ is_current: true }).eq('id', subId).select().single()
      if (ce) throw ce

      onDone({ subscription: cur as Subscription, invoice: inv as Invoice })
    } catch (ex) {
      // roll back what was created so the data stays consistent
      if (invId) await supabase.from('invoices').delete().eq('id', invId)
      if (subId) await supabase.from('subscriptions').delete().eq('id', subId)
      if (flipped) {
        for (const p of prevRows) await supabase.from('subscriptions').update({ is_current: p.is_current, status: p.status }).eq('id', p.id)
      }
      setErr(ex instanceof Error ? ex.message : (ex as { message?: string })?.message ?? String(ex))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="subscription-form" className={btnPrimary} disabled={saving || !plan || !mid}>
            <Icon name="autorenew" className="text-[20px]" />
            {saving ? 'Đang lưu...' : 'Xác nhận & lập hóa đơn'}
          </button>
        </>
      }
    >
      <form id="subscription-form" onSubmit={submit} className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        {!merchantId && (
          <Field label="Merchant" required className="sm:col-span-2">
            <select required className={inputCls} value={mid} onChange={(e) => { setMid(e.target.value); setStart('') }}>
              <option value="">-- Chọn merchant --</option>
              {(merchants ?? []).map((m) => <option key={m.id} value={m.id}>#{m.code} - {m.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Gói dịch vụ" required>
          <select className={inputCls} value={plan?.code ?? ''} onChange={(e) => setPlanCode(e.target.value)}>
            {(plans ?? []).map((p) => <option key={p.code} value={p.code}>{TIER_META[p.code].label}</option>)}
          </select>
        </Field>
        <Field label="Chu kỳ thanh toán" required>
          <select className={inputCls} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {CYCLES.map((c) => <option key={c.months} value={c.months}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Ngày bắt đầu hiệu lực" required>
          <input type="date" required className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Chiết khấu trả trước (%)">
          <input type="number" min={0} max={100} step={0.5} className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Hình thức thanh toán">
          <input className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value)} />
        </Field>
        <Field label="Ghi chú hợp đồng">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hợp đồng 1 năm (Sunmi POS)" />
        </Field>
        <div className="flex flex-col justify-between gap-2 rounded-xl bg-surface-container-low p-4 text-[14px] sm:col-span-2 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-0.5 text-secondary">
            <span>Thời hạn: <strong className="text-on-surface">{formatDate(startDate)} → {formatDate(end)}</strong></span>
            <span>Niêm yết: {formatVnd(list)}{pct > 0 && <> • Chiết khấu {pct}% (-{formatVnd(list - amount)})</>}</span>
          </div>
          <div className="sm:text-right">
            <span className="block text-[12px] font-semibold uppercase text-secondary">Thành tiền</span>
            <span className="text-[22px] font-extrabold text-primary-container">{formatVnd(amount)}</span>
          </div>
        </div>
        {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container sm:col-span-2">{err}</p>}
      </form>
    </Modal>
  )
}
