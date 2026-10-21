import { useEffect, useState, type FormEvent } from 'react'
import Icon from '../../components/Icon'
import { PROMO_SPONSORS, PROMO_TYPES } from '../../lib/constants'
import { supabase } from '../../lib/supabase'
import { useScrollLock } from '../../lib/useScrollLock'
import type { Promotion } from '../../lib/types'
import { AUDIENCES, REGION_OPTIONS, TYPE_ICON, statusFromDates } from './shared'

const fieldCls =
  'w-full rounded-lg bg-surface-container-low px-4 py-2.5 font-body-lg text-[16px] text-on-surface outline-none focus:ring-2 focus:ring-primary-container sm:text-body-lg'
const labelCls = 'mb-1 block font-label-md text-label-md font-bold text-on-surface'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function emptyForm(): Form {
  const start = new Date()
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 24)
  return {
    code: 'KM-XMAS-2025', name: '', promo_type: 'percent', discount_label: '', sponsor: 'giaodoan_100', budget_vnd: '',
    start_date: iso(start), end_date: iso(end), region: 'Toàn quốc', audience: 'all', description: '', terms: '',
  }
}

interface Form {
  code: string
  name: string
  promo_type: Promotion['promo_type']
  discount_label: string
  sponsor: Promotion['sponsor']
  budget_vnd: string
  start_date: string
  end_date: string
  region: string
  audience: Promotion['audience']
  description: string
  terms: string
}

function fromPromo(p: Promotion): Form {
  return {
    code: p.code, name: p.name, promo_type: p.promo_type, discount_label: p.discount_label ?? '', sponsor: p.sponsor,
    budget_vnd: String(p.budget_vnd ?? ''), start_date: p.start_date, end_date: p.end_date, region: p.region, audience: p.audience,
    description: p.description ?? '', terms: p.terms ?? '',
  }
}

/** Right-hand slide-over used to create ("Khởi Tạo Chiến Dịch CTKM Mới") and edit a promotion. */
export default function PromoDrawer({
  open,
  promo,
  onClose,
  onSaved,
}: {
  open: boolean
  /** null = create */
  promo: Promotion | null
  onClose: () => void
  onSaved: (p: Promotion, created: boolean) => void
}) {
  const [f, setF] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setF(promo ? fromPromo(promo) : emptyForm())
      setErr(null)
    }
  }, [open, promo])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useScrollLock(open)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.end_date < f.start_date) return setErr('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.')
    setSaving(true)
    setErr(null)
    const payload = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      promo_type: f.promo_type,
      discount_label: f.discount_label.trim() || PROMO_TYPES[f.promo_type],
      icon: TYPE_ICON[f.promo_type],
      sponsor: f.sponsor,
      budget_vnd: Math.max(0, Number(f.budget_vnd) || 0),
      start_date: f.start_date,
      end_date: f.end_date,
      status: statusFromDates(f.start_date, f.end_date),
      region: f.region,
      audience: f.audience,
      terms: f.terms.trim() || null,
    }
    const code = f.code.trim().replace(/^#/, '')
    const q = promo
      ? supabase.from('promotions').update(payload).eq('id', promo.id)
      : supabase.from('promotions').insert({ ...payload, code })
    const { data, error } = await q.select().single()
    setSaving(false)
    if (error) return setErr(error.code === '23505' ? `Mã CTKM "${code}" đã tồn tại.` : error.message)
    onSaved(data as Promotion, !promo)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex justify-end bg-inverse-surface/40 backdrop-blur-sm transition-opacity duration-300 print:hidden ${open ? 'opacity-100' : 'pointer-events-none invisible opacity-0'}`}
      onMouseDown={onClose}
      aria-hidden={!open}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex h-full w-full max-w-2xl transform flex-col justify-between bg-surface-container-lowest shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-surface-container bg-surface-container-low px-4 py-space-md sm:px-space-xl sm:py-space-lg">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary">
              <Icon name={promo ? 'edit' : 'add'} className="text-[20px]" />
            </div>
            <h2 className="min-w-0 truncate font-headline-md text-headline-md font-bold text-on-surface">{promo ? 'Chỉnh Sửa Chiến Dịch CTKM' : 'Khởi Tạo Chiến Dịch CTKM Mới'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-secondary transition-colors hover:bg-surface-container hover:text-on-surface" aria-label="Đóng">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-space-lg overflow-y-auto overscroll-contain p-4 sm:p-space-xl">
          <div>
            <label className={labelCls}>Tên chương trình khuyến mãi *</label>
            <input required className={fieldCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ví dụ: Giáng Sinh Rộn Ràng - Giảm 40% Toàn Đơn" />
          </div>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <div>
              <label className={labelCls}>Mã chương trình (Hệ thống) *</label>
              <input required readOnly={!!promo} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())}
                className={`w-full rounded-lg px-4 py-2.5 font-mono text-[16px] font-bold outline-none sm:text-[14px] ${promo ? 'cursor-not-allowed bg-surface-container text-secondary' : 'bg-surface-container-low text-on-surface focus:ring-2 focus:ring-primary-container'}`} />
            </div>
            <div>
              <label className={labelCls}>Hình thức ưu đãi *</label>
              <select className={fieldCls} value={f.promo_type} onChange={(e) => set('promo_type', e.target.value as Form['promo_type'])}>
                {Object.entries(PROMO_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <div>
              <label className={labelCls}>Mức giảm hiển thị *</label>
              <input required className={fieldCls} value={f.discount_label} onChange={(e) => set('discount_label', e.target.value)} placeholder="Giảm 40% (Max 60K)" />
            </div>
            <div>
              <label className={labelCls}>Ngân sách dự kiến (VNĐ)</label>
              <input type="number" min={0} className={fieldCls} value={f.budget_vnd} onChange={(e) => set('budget_vnd', e.target.value)} placeholder="50000000" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nguồn tài trợ *</label>
              <select className={fieldCls} value={f.sponsor} onChange={(e) => set('sponsor', e.target.value as Form['sponsor'])}>
                {Object.entries(PROMO_SPONSORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Khu vực áp dụng</label>
              <select className={fieldCls} value={f.region} onChange={(e) => set('region', e.target.value)}>
                {Array.from(new Set([...REGION_OPTIONS, f.region])).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <div>
              <label className={labelCls}>Thời gian bắt đầu *</label>
              <input required type="date" className={fieldCls} value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Thời gian kết thúc *</label>
              <input required type="date" className={fieldCls} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Áp dụng cho Merchant nào?</label>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
              {(Object.keys(AUDIENCES) as Form['audience'][]).map((k) => (
                <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2 font-label-md text-label-md text-on-surface">
                  <input type="radio" name="promo-scope" className="accent-primary-container" checked={f.audience === k} onChange={() => set('audience', k)} />
                  <span>{AUDIENCES[k]}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Mô tả ngắn</label>
            <input className={fieldCls} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Áp dụng toàn bộ menu đồ ăn chính, tối thiểu 2 món" />
          </div>
          <div>
            <label className={labelCls}>Ghi chú điều khoản &amp; điều kiện</label>
            <textarea rows={3} className={fieldCls} value={f.terms} onChange={(e) => set('terms', e.target.value)} placeholder="Điều khoản thanh toán, đối soát và trách nhiệm hủy đơn..." />
          </div>
          {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-space-md border-t border-surface-container bg-surface-container-low px-4 py-space-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-space-xl max-sm:[&>button]:flex-1">
          <button type="button" onClick={onClose} className="min-h-10 rounded-lg px-space-lg py-2.5 font-label-lg text-label-lg font-semibold text-secondary transition-colors hover:bg-surface-container hover:text-on-surface">
            Hủy bỏ
          </button>
          <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-primary-container px-space-xl py-2.5 font-label-lg text-label-lg font-bold text-on-primary shadow-md transition-all hover:bg-primary hover:shadow-lg disabled:opacity-50">
            {saving ? 'Đang lưu...' : promo ? 'Lưu thay đổi' : 'Kích hoạt & Phát hành CTKM'}
          </button>
        </div>
      </form>
    </div>
  )
}
