// Shared enum -> label / colour maps. Class strings are written out in full so Tailwind can see them.
import type { ContactStatus, FaqCategory, MerchantStatus, PromoSponsor, TicketCategory, TicketStatus } from './types'

export interface MerchantStatusMeta {
  value: MerchantStatus
  label: string
  hint: string // small caption in the detail-page dropdown
  dot: string // bg class of the legend dot
  hex: string // donut stroke colour
  select: string // list-page <select> pill classes
  pill: string // detail-page hero button classes
  pillDot: string
  text: string // label colour inside the dropdown
}

export const MERCHANT_STATUSES: MerchantStatusMeta[] = [
  { value: 'onboarding', label: 'Đang onboard', hint: 'Setup menu', dot: 'bg-primary-container', hex: '#ff5b00',
    select: 'bg-primary-fixed text-primary border-primary/30',
    pill: 'bg-primary-container/15 text-primary-container hover:bg-primary-container/20', pillDot: 'bg-primary-container ring-primary-container/25', text: 'text-on-surface' },
  { value: 'active', label: 'Đang hoạt động', hint: '', dot: 'bg-tertiary-container', hex: '#00a773',
    select: 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary/30',
    pill: 'bg-tertiary/15 text-tertiary hover:bg-tertiary/20', pillDot: 'bg-tertiary ring-tertiary/25', text: 'text-tertiary' },
  { value: 'new', label: 'Lead mới', hint: 'Chưa ký HĐ', dot: 'bg-[#06B6D4]', hex: '#06B6D4',
    select: 'bg-surface-container-high text-[#006c49] border-[#06B6D4]/30',
    pill: 'bg-[#06B6D4]/15 text-[#0e7490] hover:bg-[#06B6D4]/20', pillDot: 'bg-[#06B6D4] ring-[#06B6D4]/25', text: 'text-on-surface' },
  { value: 'consulted', label: 'Đã tư vấn', hint: 'Chờ duyệt', dot: 'bg-[#F59E0B]', hex: '#F59E0B',
    select: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/40',
    pill: 'bg-amber-100 text-amber-700 hover:bg-amber-200', pillDot: 'bg-amber-500 ring-amber-500/25', text: 'text-on-surface' },
  { value: 'stopped', label: 'Ngừng hợp tác', hint: 'Rời chương trình', dot: 'bg-error', hex: '#ba1a1a',
    select: 'bg-error-container text-error border-error/30',
    pill: 'bg-error-container/40 text-error hover:bg-error-container/60', pillDot: 'bg-error ring-error/25', text: 'text-error' },
]

export const merchantStatus = (v: string | null | undefined): MerchantStatusMeta =>
  MERCHANT_STATUSES.find((s) => s.value === v) ?? MERCHANT_STATUSES[2]

/** Onboarding pipeline: onboardings.steps_done = number of finished steps (1..5). */
export const ONBOARDING_STEPS = [
  { no: 1, icon: 'badge', title: 'Tài khoản', desc: 'Xác minh đại diện & tài khoản portal', doneLabel: 'Đã có tài khoản' },
  { no: 2, icon: 'store', title: 'Thiết lập quán', desc: 'Cấu hình địa chỉ, giờ bán & bán kính', doneLabel: 'Đã thiết lập cửa hàng' },
  { no: 3, icon: 'restaurant_menu', title: 'Tải Menu', desc: 'Món ăn, ảnh bìa, giá & tùy chọn topping', doneLabel: 'Đã có menu' },
  { no: 4, icon: 'sell', title: 'Tạo CTKM', desc: 'Ưu đãi khai trương, voucher quà tặng', doneLabel: 'Đã tạo CTKM' },
  { no: 5, icon: 'flag', title: 'Hoàn thành', desc: 'Kiểm thử POS & mở bán chính thức', doneLabel: 'Hoàn thành Go-Live' },
] as const

export const TICKET_CATEGORIES: Record<TicketCategory, { label: string; long: string }> = {
  payment: { label: 'Thanh toán đối soát', long: 'Thanh toán đối soát' },
  store: { label: 'Cửa hàng', long: 'Cửa hàng & Chi nhánh' },
  login: { label: 'Đăng nhập', long: 'Đăng nhập & Tài khoản' },
  onboarding: { label: 'Onboarding', long: 'Onboarding' },
  feedback: { label: 'Góp ý', long: 'Góp ý cải tiến' },
  other: { label: 'Khác', long: 'Khác' },
}

export const TICKET_STATUSES: Record<TicketStatus, string> = {
  new: 'Mới tiếp nhận',
  processing: 'Đang xử lý',
  waiting_merchant: 'Đợi Merchant bổ sung',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
}

/** List-page pills: Chưa phản hồi = new + processing, Đã phản hồi = resolved + closed, Đợi Merchant bổ sung = waiting_merchant */
export const TICKET_GROUPS = {
  unanswered: ['new', 'processing'] as TicketStatus[],
  answered: ['resolved', 'closed'] as TicketStatus[],
  waiting: ['waiting_merchant'] as TicketStatus[],
}

export const TICKET_PRIORITIES = { low: 'Thấp', normal: 'Trung bình', high: 'Cao (Gấp)' } as const

export const CONTACT_STATUSES: Record<ContactStatus, { label: string; icon: string }> = {
  success: { label: 'Thành công', icon: 'check_circle' },
  no_answer: { label: 'Không bắt máy', icon: 'phone_missed' },
  hung_up: { label: 'Cúp máy ngang', icon: 'phone_disabled' },
  pending: { label: 'Chờ gửi', icon: 'schedule_send' },
}

export const CONTACT_CHANNELS = {
  voip: 'Gọi điện thoại (VoIP)',
  zalo: 'Nhắn tin Zalo OA',
  visit: 'Gặp mặt trực tiếp tại quán',
  meet: 'Họp Online (Google Meet)',
  note: 'Ghi chú',
} as const

export const CONTACT_PURPOSES = [
  'Tư vấn gia hạn gói',
  'Hướng dẫn Onboarding & Menu',
  'Xử lý sự cố POS / Đơn hàng',
  'Khảo sát định kỳ quý',
  'Nhắc đơn tồn Delivery',
] as const

export const RISK_TYPES = { expiring: 'Sắp hết hạn dịch vụ', order_gap: 'Gián đoạn phát sinh đơn', app_inactive: 'Không truy cập app' } as const
export const RISK_LEVELS = { critical: 'Rất cao (Nguy cấp)', high: 'Cao', medium: 'Trung bình' } as const

export const ACTIVITY_CATEGORIES = { orders: 'Đơn hàng & Doanh số', config: 'Cấu hình & Menu', security: 'Bảo mật & Đăng nhập' } as const
export const ACTIVITY_STATUSES = { success: 'Thành công', failed: 'Thất bại', warning: 'Cảnh báo', cancelled: 'Đã hủy' } as const

export const FAQ_CATEGORIES: Record<FaqCategory, string> = {
  payout: 'Đối soát & Doanh thu',
  operations: 'Vận hành đơn & POS',
  account: 'Tài khoản & Đăng nhập',
  policy: 'Chính sách & Gói dịch vụ',
  promotion: 'Khuyến mãi & CTKM',
}
export const FAQ_AUDIENCES = { all: 'Tất cả Merchant', new: 'Mới onboard', chain: 'Chuỗi quán & F&B lớn' } as const

export const PROMO_TYPES = {
  percent: 'Giảm giá theo %',
  freeship: 'Miễn phí giao hàng (Freeship)',
  flash_sale: 'Flash Sale giờ vàng',
  combo: 'Voucher Combo món',
  voucher: 'Voucher tiền mặt cố định',
  bogo: 'Mua 1 Tặng 1',
} as const
export const PROMO_SPONSORS: Record<PromoSponsor, string> = {
  giaodoan_100: 'Giaodoan 100%',
  split_50_50: 'Đồng tài trợ 50:50',
  giaodoan_70_mc_30: 'Giaodoan 70% - MC 30%',
  merchant_100: 'Merchant tự tài trợ',
}
export const PROMO_STATUSES = { running: 'Đang chạy', upcoming: 'Sắp diễn ra', ended: 'Đã kết thúc' } as const
