import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import Modal from './Modal'
import { Field, btnPrimary, btnSecondary, inputCls } from './Form'
import { insertContactLogs, MANUAL_TAG, REMIND_TOAST, type ContactActor } from '../lib/contactLog'
import { CONTACT_CHANNELS, CONTACT_PURPOSES } from '../lib/constants'
import { contactsPath, merchantPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import type { ContactLog, Staff } from '../lib/types'

export interface CampaignTarget { id: string; name: string; contact_name?: string | null }

type Channel = ContactLog['channel']
const CHANNEL_LABEL: Record<Channel, string> = { voip: 'Gọi điện', zalo: 'Zalo/SMS', visit: 'Gặp trực tiếp', meet: 'Google Meet', note: 'Ghi chú' }
const VERB: Record<Channel, string> = { zalo: 'Cần nhắc qua Zalo/SMS', voip: 'Cần gọi điện', visit: 'Cần ghé thăm', meet: 'Cần họp online', note: 'Cần chăm sóc' }

/**
 * Bulk "Tạo chiến dịch chăm sóc": logs one pending contact_logs row per merchant (nothing is sent).
 * State is reset every time the modal opens; a save that finishes after the modal was closed is ignored.
 */
export default function CampaignModal({
  open, merchants, staff, tag, defaultContent = '', defaultPurpose = CONTACT_PURPOSES[3], contentPlaceholder, markHandledLabel, onMarkHandled, onClose, onDone,
}: {
  open: boolean
  merchants: CampaignTarget[]
  /** When given, shows the "Nhân sự thực hiện" picker (otherwise the operator from Settings is used). */
  staff?: Staff[]
  tag: string
  defaultContent?: string
  defaultPurpose?: string
  contentPlaceholder?: string
  /** When set, shows a checkbox that calls onMarkHandled(ids of merchants that really got a log). */
  markHandledLabel?: string
  onMarkHandled?: (loggedMerchantIds: string[]) => Promise<string | null>
  onClose: () => void
  onDone: (n: number) => void
}) {
  const { settings } = useSettings()
  const [channel, setChannel] = useState<Channel>('zalo')
  const [purpose, setPurpose] = useState<string>(defaultPurpose)
  const [content, setContent] = useState(defaultContent)
  const [staffId, setStaffId] = useState('')
  const [markHandled, setMarkHandled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  // bumped on every open/close; a submit only applies its result while its ticket is still current
  const ticket = useRef(0)

  useEffect(() => {
    ticket.current++
    if (!open) return
    setChannel('zalo'); setPurpose(defaultPurpose); setContent(defaultContent); setStaffId(''); setMarkHandled(false)
    setSaving(false); setErr(null); setDone(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    if (done !== null) onDone(done)
    else onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving || merchants.length === 0) return
    const mine = ++ticket.current
    setSaving(true)
    setErr(null)
    const picked = staff?.find((s) => s.id === staffId)
    const actor: ContactActor | undefined = picked ? { staffId: picked.id, name: picked.full_name } : undefined
    const res = await insertContactLogs(
      merchants.map((m) => ({
        merchantId: m.id,
        contactPerson: m.contact_name,
        channel,
        channelLabel: CHANNEL_LABEL[channel],
        purpose,
        content: `${VERB[channel]}: ${content.trim()}`,
        tags: [tag],
      })),
      settings.name,
      actor,
    )
    if (ticket.current !== mine) return
    if (res.error) {
      setSaving(false)
      return setErr(res.error)
    }
    let handledErr: string | null = null
    if (markHandled && onMarkHandled) {
      handledErr = await onMarkHandled(merchants.map((m) => m.id))
      if (ticket.current !== mine) return
    }
    setSaving(false)
    setDone(merchants.length)
    if (handledErr) setErr(`Đã ghi nhận lượt nhắc nhưng chưa đánh dấu xử lý được: ${handledErr}`)
  }

  return (
    <Modal open={open} title="Tạo chiến dịch chăm sóc" onClose={close} width="max-w-xl"
      footer={
        done !== null ? (
          <>
            <button type="button" className={btnSecondary} onClick={close}>Đóng</button>
            <Link to={contactsPath()} className={btnPrimary}><Icon name="history" className="text-[20px]" />Xem lịch sử liên hệ</Link>
          </>
        ) : (
          <>
            <button type="button" className={btnSecondary} onClick={close}>Hủy bỏ</button>
            <button type="submit" form="campaign-form" className={btnPrimary} disabled={saving || merchants.length === 0 || !content.trim()}>
              <Icon name="campaign" className="text-[20px]" />
              {saving ? 'Đang ghi nhận...' : `Ghi nhận ${merchants.length} lượt chăm sóc`}
            </button>
          </>
        )
      }>
      {done !== null ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Icon name="task_alt" className="text-[44px] text-tertiary" />
          <p className="font-headline-md text-[17px] font-bold text-on-surface">{REMIND_TOAST(done)}</p>
          <p className="text-[13px] text-secondary">Các lượt này nằm trong Lịch sử liên hệ (gắn thẻ &quot;{MANUAL_TAG}&quot;, cần gọi lại). Hệ thống chưa gửi tin nhắn nào.</p>
          {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
        </div>
      ) : (
        <form id="campaign-form" onSubmit={submit} className="flex flex-col gap-4">
          <p className="rounded-lg bg-surface-container-low p-3 text-[13px] text-secondary">
            Chỉ <b className="text-on-surface">ghi nhận</b> việc cần chăm sóc vào Lịch sử liên hệ — hệ thống không tự gửi tin nhắn hay gọi điện.
          </p>
          <div className="rounded-xl bg-surface-container-low p-space-md text-[13px] text-secondary">
            <b className="text-on-surface">{merchants.length}</b> merchant:{' '}
            {merchants.slice(0, 6).map((m, i) => (
              <span key={m.id}>{i > 0 && ', '}<Link to={merchantPath(m.id)} className="font-semibold text-on-surface hover:text-primary hover:underline">{m.name}</Link></span>
            ))}
            {merchants.length > 6 && ` và ${merchants.length - 6} merchant khác`}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kênh cần liên hệ">
              <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {(Object.keys(CONTACT_CHANNELS) as Channel[]).map((c) => <option key={c} value={c}>{CONTACT_CHANNELS[c]}</option>)}
              </select>
            </Field>
            <Field label="Mục đích">
              <select className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {CONTACT_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            {staff && (
              <Field label="Nhân sự thực hiện" className="sm:col-span-2">
                <select className={inputCls} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">-- {settings.name} --</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.title ? ` • ${s.title}` : ''}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Nội dung cần nhắc / chăm sóc" required>
            <textarea required rows={3} className={inputCls} value={content} onChange={(e) => setContent(e.target.value)} placeholder={contentPlaceholder} />
          </Field>
          {markHandledLabel && (
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[14px] font-semibold text-on-surface">
              <input type="checkbox" className="h-4 w-4 accent-primary-container" checked={markHandled} onChange={(e) => setMarkHandled(e.target.checked)} />
              {markHandledLabel}
            </label>
          )}
          {err && <p className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">{err}</p>}
        </form>
      )}
    </Modal>
  )
}
