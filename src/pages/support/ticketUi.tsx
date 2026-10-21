// Shared bits for the Support list + Support detail pages (local to src/pages/support/).
import Icon from '../../components/Icon'
import { formatTime } from '../../lib/format'
import type { Merchant, SupportTicket, TicketCategory, TicketStatus } from '../../lib/types'

export type MerchantLite = Pick<Merchant, 'id' | 'code' | 'name' | 'phone' | 'region' | 'address' | 'image_url' | 'emoji' | 'icon' | 'status'>
export type TicketRow = SupportTicket & { merchant: MerchantLite | null }

export const MERCHANT_LITE_COLS = 'id,code,name,phone,region,address,image_url,emoji,icon,status'

/** Coloured dot in front of the category label (design: payment = orange, onboarding = green, login = grey, store = red). */
export const CATEGORY_DOT: Record<TicketCategory, string> = {
  payment: 'bg-primary-container',
  onboarding: 'bg-tertiary',
  login: 'bg-secondary',
  store: 'bg-error',
  feedback: 'bg-[#06B6D4]',
  other: 'bg-outline',
}

export const OPEN_STATUSES: TicketStatus[] = ['new', 'processing']

export function MerchantAvatar({ m, className = 'h-10 w-10 rounded-xl', iconSize = 'text-[22px]' }: { m: MerchantLite | null; className?: string; iconSize?: string }) {
  return (
    <div className={`flex flex-shrink-0 items-center justify-center overflow-hidden bg-surface-container shadow-sm ${className}`}>
      {m?.image_url ? (
        <img className="h-full w-full object-cover" alt={m.name} src={m.image_url} />
      ) : m?.emoji ? (
        <span className={iconSize}>{m.emoji}</span>
      ) : (
        <Icon name={m?.icon ?? 'storefront'} className={`${iconSize} text-primary`} />
      )}
    </div>
  )
}

function span(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`
}

/** Is an open ticket past its SLA deadline? */
export const isOverdue = (t: SupportTicket) => OPEN_STATUSES.includes(t.status) && !!t.sla_due_at && new Date(t.sla_due_at).getTime() < Date.now()

/** Sub-line under "Ngày tạo": SLA countdown for open tickets, else "Đã phản hồi (Lúc hh:mm)", else the status note. */
export function slaInfo(t: SupportTicket): { icon: string; text: string; cls: string; bold: boolean } {
  if (t.status === 'waiting_merchant' && t.status_note) return { icon: 'help_outline', text: t.status_note, cls: 'text-secondary', bold: false }
  if (OPEN_STATUSES.includes(t.status) && t.sla_due_at) {
    const left = new Date(t.sla_due_at).getTime() - Date.now()
    if (left < 0) return { icon: 'alarm', text: `Quá hạn SLA ${span(-left)}`, cls: 'text-error', bold: true }
    return { icon: left < 2 * 3600000 ? 'timer' : 'schedule', text: `SLA còn ${span(left)}`, cls: 'text-primary-container', bold: true }
  }
  if (t.responded_at) return { icon: 'done_all', text: `Đã phản hồi (Lúc ${formatTime(t.responded_at)})`, cls: 'text-tertiary', bold: false }
  if (t.status_note) return { icon: 'help_outline', text: t.status_note, cls: 'text-secondary', bold: false }
  if (OPEN_STATUSES.includes(t.status)) return { icon: 'hourglass_top', text: 'Chờ phản hồi', cls: 'text-primary-container', bold: true }
  return { icon: 'done_all', text: 'Đã xử lý', cls: 'text-tertiary', bold: false }
}

/** Default SLA window per priority, used when a ticket is created from the UI. */
export const SLA_HOURS = { high: 4, normal: 24, low: 48 } as const
