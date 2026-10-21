// Single place that writes contact_logs rows.
// IMPORTANT: "remind" / "campaign" actions only LOG a contact to follow up - nothing is sent to the merchant.
// Reminders are stored with status 'pending' ("Chờ gửi", migration 0002) + needs_callback = true,
// so they surface under "Cần gọi lại" without skewing the success / no-answer stats.
import { supabase } from './supabase'
import type { ContactLog, ContactStatus } from './types'

export const PENDING_STATUS: ContactStatus = 'pending'
export const MANUAL_TAG = 'Cần gửi thủ công'

export interface ContactActor { staffId: string | null; name: string }

export interface ContactLogDraft {
  merchantId: string
  contactPerson?: string | null
  channel: ContactLog['channel']
  channelLabel?: string | null
  purpose: string | null
  content: string
  tags?: string[]
  /** default: pending (reminder). Contacts' manual create passes the operator's choice. */
  status?: ContactStatus
  needsCallback?: boolean
  callbackAt?: string | null
  durationSeconds?: number
  occurredAt?: string
}

/** Current operator (Settings name) -> matching staff row when one exists. */
export async function resolveActor(operatorName: string): Promise<ContactActor> {
  const name = operatorName.trim()
  const { data } = await supabase.from('staff').select('id,full_name')
  const hit = (data ?? []).find((s: { id: string; full_name: string }) => s.full_name.trim().toLowerCase() === name.toLowerCase())
  return { staffId: hit?.id ?? null, name: hit?.full_name ?? name }
}

const cleanTags = (tags: string[]) => Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))

export function buildContactLog(d: ContactLogDraft, actor: ContactActor) {
  const pending = d.status === undefined
  return {
    merchant_id: d.merchantId,
    staff_id: actor.staffId,
    actor_name: actor.name,
    channel: d.channel,
    channel_label: d.channelLabel ?? null,
    contact_person: d.contactPerson?.trim() || null,
    purpose: d.purpose,
    content: d.content.trim(),
    tags: cleanTags([...(pending ? [MANUAL_TAG] : []), ...(d.tags ?? [])]),
    status: d.status ?? PENDING_STATUS,
    duration_seconds: d.durationSeconds ?? 0,
    needs_callback: d.needsCallback ?? pending,
    callback_at: d.callbackAt ?? null,
    occurred_at: d.occurredAt ?? new Date().toISOString(),
  }
}

/**
 * Inserts one contact_logs row per draft. `actor` overrides the operator (e.g. a staff member picked in a form).
 * Returns the created codes (insertion order) or an error message.
 */
export async function insertContactLogs(
  drafts: ContactLogDraft[],
  operatorName: string,
  actor?: ContactActor,
): Promise<{ error: string | null; codes: string[] }> {
  if (drafts.length === 0) return { error: null, codes: [] }
  const who = actor ?? (await resolveActor(operatorName))
  const { data, error } = await supabase.from('contact_logs').insert(drafts.map((d) => buildContactLog(d, who))).select('code')
  if (error) return { error: error.message, codes: [] }
  return { error: null, codes: (data ?? []).map((r: { code: string }) => r.code) }
}

export const REMIND_TOAST = (n: number) => `Đã ghi nhận ${n} lượt nhắc — cần gửi tin thủ công`

/** Zalo web link: digits only, leading 84 -> 0. null when the phone has no usable number. */
export function zaloUrl(phone: string | null | undefined): string | null {
  let d = (phone ?? '').replace(/\D/g, '')
  if (d.startsWith('84')) d = '0' + d.slice(2)
  return d.length >= 9 ? `https://zalo.me/${d}` : null
}

export function smsUrl(phone: string | null | undefined, body: string): string | null {
  const p = (phone ?? '').replace(/[^\d+]/g, '')
  return p ? `sms:${p}?body=${encodeURIComponent(body)}` : null
}
