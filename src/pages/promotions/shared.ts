import type { Promotion } from '../../lib/types'
import { PROMO_TYPES } from '../../lib/constants'

export const REGION_OPTIONS = ['Toàn quốc', 'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng'] as const

export const AUDIENCES = {
  all: 'Tất cả đối tác Merchant đủ điều kiện',
  top_tier: 'Chỉ áp dụng nhóm Merchant F&B trọng điểm (Top Tier)',
  list: 'Chỉ định danh sách tải lên (Excel file)',
} as const

export const TYPE_ICON: Record<Promotion['promo_type'], string> = {
  percent: 'percent',
  freeship: 'local_shipping',
  combo: 'lunch_dining',
  voucher: 'redeem',
  bogo: 'card_giftcard',
  flash_sale: 'bolt',
}

export const SPONSOR_DOT: Record<Promotion['sponsor'], string> = {
  giaodoan_100: 'bg-primary-container',
  split_50_50: 'bg-tertiary',
  giaodoan_70_mc_30: 'bg-[#F59E0B]',
  merchant_100: 'bg-secondary',
}

export const typeLabel = (t: Promotion['promo_type']) => PROMO_TYPES[t]

/** Status derived from the date range (used when a promotion is created / edited). */
export function statusFromDates(start: string, end: string): Promotion['status'] {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (start > today) return 'upcoming'
  if (end < today) return 'ended'
  return 'running'
}
