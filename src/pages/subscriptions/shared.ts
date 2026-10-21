import { parseDate } from '../../lib/format'
import type { PlanTier, ServicePlan, Subscription } from '../../lib/types'

/** Per-tier visuals used by the subscription list + detail. Class strings are literal so Tailwind keeps them. */
export const TIER_META: Record<PlanTier | 'trial', { label: string; icon: string; iconCls: string; pill: string; dot: string }> = {
  silver: { label: 'Gói Bạc (Silver)', icon: 'workspace_premium', iconCls: 'text-secondary', pill: 'bg-secondary-container text-on-secondary-container', dot: 'bg-slate-400' },
  gold: { label: 'Gói Vàng (Gold)', icon: 'stars', iconCls: 'text-primary-container', pill: 'bg-primary-fixed text-on-primary-fixed', dot: 'bg-amber-500' },
  diamond: { label: 'Gói Kim Cương', icon: 'diamond', iconCls: 'text-tertiary', pill: 'bg-surface-container-high text-on-surface', dot: 'bg-tertiary' },
  trial: { label: 'Dùng Thử Khai Trương', icon: 'card_giftcard', iconCls: 'text-[#0e7490]', pill: 'bg-surface-container text-secondary', dot: 'bg-blue-400' },
}

export const CYCLES = [
  { months: 1, label: '01 Tháng' },
  { months: 6, label: '06 Tháng' },
  { months: 12, label: '12 Tháng' },
] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> 'YYYY-MM-DD' in local time */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayIso = () => toIsoDate(new Date())

/** End date of a contract starting on `start` and lasting `months` months (inclusive: start + months - 1 day). */
export function contractEnd(start: string, months: number): string {
  const d = parseDate(start) ?? new Date()
  const end = new Date(d.getFullYear(), d.getMonth() + months, d.getDate() - 1)
  return toIsoDate(end)
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso) ?? new Date()
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Undiscounted price of a plan for a billing cycle (12 months = the yearly price, otherwise monthly * n). */
export function listPrice(plan: ServicePlan, months: number): number {
  return months === 12 ? plan.price_year_vnd : plan.price_month_vnd * months
}

/** Days left (negative = already ended) and used-days gauge for a contract. */
export function expiryState(days: number | null): 'expired' | 'soon' | 'ok' {
  if (days === null) return 'ok'
  if (days < 0) return 'expired'
  return days < 30 ? 'soon' : 'ok'
}

export function currentOf(subs: Subscription[]): Subscription | undefined {
  return subs.find((s) => s.is_current) ?? [...subs].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
}

// ---- Vietnamese number reader: 10800000 -> "Mười triệu tám trăm nghìn đồng chẵn./." ----
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function readTriple(n: number, full: boolean): string {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  const parts: string[] = []
  if (h > 0 || full) parts.push(`${DIGITS[h]} trăm`)
  if (t > 1) {
    parts.push(`${DIGITS[t]} mươi`)
    if (u === 1) parts.push('mốt')
    else if (u === 5) parts.push('lăm')
    else if (u > 0) parts.push(DIGITS[u])
  } else if (t === 1) {
    parts.push('mười')
    if (u === 5) parts.push('lăm')
    else if (u > 0) parts.push(DIGITS[u])
  } else if (u > 0) {
    if (h > 0 || full) parts.push('lẻ')
    parts.push(DIGITS[u])
  }
  return parts.join(' ')
}

export function amountInWords(amount: number): string {
  if (!amount) return 'Không đồng./.'
  const units = ['', ' nghìn', ' triệu', ' tỷ']
  const groups: number[] = []
  let rest = Math.round(amount)
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }
  const out: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    const full = i < groups.length - 1
    out.push(readTriple(groups[i], full) + units[i % 4])
  }
  const text = out.join(' ').replace(/\s+/g, ' ').trim()
  const cap = text.charAt(0).toUpperCase() + text.slice(1)
  return `${cap} đồng chẵn./.`
}
