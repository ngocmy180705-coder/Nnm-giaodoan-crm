// Shared helpers for the onboarding list + detail pages (kept local so no shared lib/* file is touched).
import { supabase } from '../../lib/supabase'

/** Default 5-step checklist created for a new onboarding (titles mirror the seed data). */
export const STEP_TEMPLATES = [
  { title: 'Tạo tài khoản & Phê duyệt thông tin pháp lý', description: 'Thu thập và xác minh giấy phép kinh doanh F&B, CCCD đại diện pháp luật, giấy chứng nhận vệ sinh an toàn thực phẩm. Ký hợp đồng hợp tác số điện tử.' },
  { title: 'Thiết lập cửa hàng & Cấu hình giờ hoạt động, địa chỉ, tài khoản ngân hàng', description: 'Định vị tọa độ quán trên bản đồ, cài đặt bán kính giao hàng tối ưu, lịch mở cửa và cấu hình tài khoản nhận thanh toán.' },
  { title: 'Đồng bộ Menu món ăn & Giá bán', description: 'Tải lên danh mục món, hình ảnh chuẩn HD, gắn tag phân loại (Bestseller, Món mới) và cấu hình tuỳ chọn topping/đường/đá.' },
  { title: 'Tạo Chương trình khuyến mãi (CTKM) khai trương & Cài đặt POS/App', description: 'Hỗ trợ quán thiết lập voucher giảm giá đặc biệt dịp ra mắt, cấp quyền truy cập app quản trị Giaodoan Merchant POS và cấu hình máy in hóa đơn.' },
  { title: 'Chạy đơn thử nghiệm & Nghiệm thu bàn giao', description: 'Tạo 1 đơn đặt hàng giả lập từ ứng dụng khách hàng Giaodoan, tài xế nhận đơn, in phiếu bếp và hoàn tất luồng thanh toán giao dịch mẫu trước khi chính thức Go-Live.' },
] as const

/**
 * Set an onboarding to "k steps done": steps 1..k become done, step k+1 in_progress, the rest pending,
 * then `onboardings.steps_done = k`. Returns an error message or null.
 */
export async function applyProgress(onboardingId: string, k: number, doneBy: string | null): Promise<string | null> {
  const { data: steps, error } = await supabase.from('onboarding_steps').select('id,step_no,status,completed_at').eq('onboarding_id', onboardingId)
  if (error) return error.message
  for (const s of steps ?? []) {
    const want = s.step_no <= k ? 'done' : s.step_no === k + 1 ? 'in_progress' : 'pending'
    if (s.status === want && (want !== 'done' || s.completed_at)) continue
    const patch =
      want === 'done'
        ? { status: want, completed_at: s.completed_at ?? new Date().toISOString(), completed_by: doneBy }
        : { status: want, completed_at: null, completed_by: null }
    const { error: e } = await supabase.from('onboarding_steps').update(patch).eq('id', s.id)
    if (e) return e.message
  }
  const { error: e2 } = await supabase.from('onboardings').update({ steps_done: k }).eq('id', onboardingId)
  return e2 ? e2.message : null
}
