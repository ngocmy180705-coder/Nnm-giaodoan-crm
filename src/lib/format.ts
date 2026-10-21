// vi-VN formatting helpers. Date-only strings (YYYY-MM-DD) are parsed as LOCAL dates to avoid timezone shifts.

const nf = new Intl.NumberFormat('vi-VN')

export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (unlike toISOString(), no UTC shift). */
export const localISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 1.248 */
export const formatNumber = (n: number | null | undefined) => (n == null ? '—' : nf.format(n))

/** 48.250.000 đ */
export const formatVnd = (n: number | null | undefined) => (n == null ? '—' : `${nf.format(n)} đ`)

/** 2,41 Tỷ đ / 48,2 Tr / 450.000 đ — compact form for big KPI numbers. */
export function formatVndCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Tỷ đ`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Tr`
  return formatVnd(n)
}

/** 28/10/2025 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value)
  if (!d || isNaN(d.getTime())) return '—'
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** 14:35 */
export function formatTime(value: string | Date | null | undefined): string {
  const d = parseDate(value)
  if (!d || isNaN(d.getTime())) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 28/10/2025 14:35 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parseDate(value)
  if (!d || isNaN(d.getTime())) return '—'
  return `${formatDate(d)} ${formatTime(d)}`
}

/** Whole days from today (local midnight) to the given date; negative = past. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = parseDate(value)
  if (!d || isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

/** "15 phút trước", "2 giờ trước", "Hôm qua", "3 ngày trước" */
export function relativeTime(value: string | Date | null | undefined): string {
  const d = parseDate(value)
  if (!d || isNaN(d.getTime())) return '—'
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const hours = Math.floor(diffMin / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Hôm qua' : `${days} ngày trước`
}

/** 275 -> "04:35" */
export function formatDuration(seconds: number | null | undefined): string {
  const s = seconds ?? 0
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

/** "Nguyễn Văn A" -> "NA" (last word + first word initials) */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "MC-3926" -> "#MC-3926" (codes are stored without the hash) */
export const hashCode = (code: string | null | undefined) => (code ? `#${code}` : '—')
