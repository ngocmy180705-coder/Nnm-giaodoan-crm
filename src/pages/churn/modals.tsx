import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { Field, btnPrimary, btnSecondary, inputCls } from '../../components/Form'
import { RISK_LEVELS, RISK_TYPES } from '../../lib/constants'
import { hashCode } from '../../lib/format'
import { contactsPath, merchantPath, subscriptionPath } from '../../lib/links'
import { supabase } from '../../lib/supabase'
import type { Staff } from '../../lib/types'
import type { RiskRow } from './types'

/** "Chăm sóc" / "Gọi ngay": log the outcome (note, assignee, handled flag) on the churn_risks row. */
export function CareModal({ row, staff, onClose, onSaved }: { row: RiskRow | null; staff: Staff[]; onClose: () => void; onSaved: (msg: string) => void }) {
  return (
    <Modal open={!!row} title="Chăm sóc đối tác" onClose={onClose} width="max-w-xl"
      footer={
        row && (
          <>
            <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
            <button type="submit" form="care-churn-form" className={btnPrimary}>
              <Icon name="save" className="text-[20px]" />
              Lưu
            </button>
          </>
        )
      }>
      {/* Re-key the form on the row so its state is initialised from the selected row each time it opens. */}
      {row && <CareForm key={row.id} row={row} staff={staff} onSaved={onSaved} />}
    </Modal>
  )
}

function CareForm({ row, staff, onSaved }: { row: RiskRow; staff: Staff[]; onSaved: (msg: string) => void }) {
  const m = row.merchant
  const [assignee, setAssignee] = useState(row.assignee_id ?? '')
  const [note, setNote] = useState(row.note ?? '')
  const [handled, setHandled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const { error } = await supabase
      .from('churn_risks')
      .update({
        assignee_id: assignee || null,
        note: note.trim() || null,
        handled,
        handled_at: handled ? (row.handled ? row.handled_at ?? new Date().toISOString() : new Date().toISOString()) : null,
      })
      .eq('id', row.id)
    setSaving(false)
    if (error) return setErr(error.message)
    onSaved(handled ? `Đã ghi nhận chăm sóc ${m?.name ?? ''}` : `Đã cập nhật ${m?.name ?? ''}`)
  }

  return (
    <form id="care-churn-form" onSubmit={submit} className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface-container-low p-space-md">
        {m ? (
          <Link to={merchantPath(m.id)} className="block font-headline-md text-body-lg font-bold text-on-surface hover:text-primary hover:underline">
            <span className="mr-2 font-label-md text-label-md text-primary">{hashCode(m.code)}</span>
            {m.name}
          </Link>
        ) : (
          <div className="font-headline-md text-body-lg font-bold text-on-surface">—</div>
        )}
        <div className="mt-1 text-[13px] text-secondary">
          {RISK_TYPES[row.risk_type]} • {RISK_LEVELS[row.risk_level]}
          {row.alert_text ? ` • ${row.alert_text}` : ''}
          {m?.phone ? <> • <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="font-semibold text-primary hover:underline">{m.phone}</a></> : null}
        </div>
        {m && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
            <Link to={merchantPath(m.id)} className="inline-flex min-h-[32px] items-center gap-1 text-primary hover:underline"><Icon name="store" className="text-[16px]" />Hồ sơ</Link>
            <Link to={subscriptionPath(m.id)} className="inline-flex min-h-[32px] items-center gap-1 text-primary hover:underline"><Icon name="calendar_today" className="text-[16px]" />Gói &amp; gia hạn</Link>
            <Link to={contactsPath(m.code)} className="inline-flex min-h-[32px] items-center gap-1 text-primary hover:underline"><Icon name="history" className="text-[16px]" />Lịch sử liên hệ</Link>
          </div>
        )}
      </div>
      <Field label="Nhân sự CSKH phụ trách">
        <select className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">-- Chưa phân công --</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.title ? ` • ${s.title}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Ghi chú chăm sóc">
        <textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Đã gọi hẹn tái ký trong tuần" />
      </Field>
      <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[14px] font-semibold text-on-surface">
        <input type="checkbox" className="h-4 w-4 accent-primary-container" checked={handled} onChange={(e) => setHandled(e.target.checked)} />
        Đã liên hệ xử lý
      </label>
      {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
      {saving && <p className="text-[13px] text-secondary">Đang lưu...</p>}
    </form>
  )
}

/** "+ Phân công nhân sự CSKH": set assignee_id on every ticked row. */
export function AssignModal({ open, ids, staff, onClose, onSaved }: { open: boolean; ids: string[]; staff: Staff[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [staffId, setStaffId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('churn_risks').update({ assignee_id: staffId }).in('id', ids)
    setSaving(false)
    if (error) return setErr(error.message)
    const name = staff.find((s) => s.id === staffId)?.full_name ?? ''
    setStaffId('')
    onSaved(`Đã phân công ${ids.length} merchant cho ${name}`)
  }

  return (
    <Modal open={open} title="Phân công nhân sự CSKH" onClose={onClose} width="max-w-md"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" form="assign-churn-form" className={btnPrimary} disabled={saving || !staffId}>
            <Icon name="person_add" className="text-[20px]" />
            {saving ? 'Đang lưu...' : 'Phân công'}
          </button>
        </>
      }>
      <form id="assign-churn-form" onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[14px] text-secondary">Giao <b className="text-on-surface">{ids.length}</b> merchant đã chọn cho một nhân sự chăm sóc.</p>
        <Field label="Nhân sự CSKH" required>
          <select required className={inputCls} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">-- Chọn nhân sự --</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.title ? ` • ${s.title}` : ''}</option>)}
          </select>
        </Field>
        {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
      </form>
    </Modal>
  )
}
