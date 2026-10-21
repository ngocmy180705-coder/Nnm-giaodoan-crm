import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { COMPANY } from '../lib/company'
import { ROUTES } from '../lib/links'

const GUIDES = [
  { to: ROUTES.overview, icon: 'dashboard', title: 'Tổng quan', body: 'Bảng điều khiển: chỉ số chính, danh sách "Cần xử lý hôm nay", hoạt động gần đây và các nút tạo nhanh.' },
  { to: ROUTES.merchants, icon: 'store', title: 'Hồ sơ Merchant', body: 'Tìm, lọc và xuất danh sách đối tác. Bấm tên merchant để xem hồ sơ chi tiết, đổi trạng thái hoặc thêm merchant mới.' },
  { to: ROUTES.onboarding, icon: 'timeline', title: 'Tiến độ onboard', body: 'Theo dõi 5 bước đưa quán lên sàn (tài khoản, thiết lập, menu, CTKM, go-live) và đánh dấu từng bước hoàn thành.' },
  { to: ROUTES.support, icon: 'headset_mic', title: 'Yêu cầu hỗ trợ', body: 'Tiếp nhận và xử lý yêu cầu theo SLA. Mở yêu cầu để phản hồi merchant, đổi trạng thái hoặc ghi chú nội bộ.' },
  { to: ROUTES.subscriptions, icon: 'calendar_today', title: 'Thời hạn & gia hạn', body: 'Quản lý gói Silver / Gold / Diamond, hạn hợp đồng, đăng ký hoặc gia hạn gói và in hóa đơn.' },
  { to: ROUTES.contacts, icon: 'phone_callback', title: 'Lịch sử liên hệ', body: 'Ghi nhận cuộc gọi, tin nhắn, buổi gặp với merchant và theo dõi những cuộc cần gọi lại.' },
  { to: ROUTES.churn, icon: 'warning', title: 'Nguy cơ rời bỏ', body: 'Danh sách merchant có dấu hiệu rời bỏ (sắp hết hạn, ngừng phát sinh đơn, không dùng app) để chăm sóc kịp thời.' },
  { to: ROUTES.faq, icon: 'help', title: 'FAQ', body: 'Kho câu hỏi thường gặp dành cho merchant: thêm, sửa, ẩn/hiện và xoá câu hỏi.' },
  { to: ROUTES.promotions, icon: 'local_offer', title: 'CTKM', body: 'Quản lý chương trình khuyến mãi: ngân sách, thời gian chạy, đối tượng và kết quả.' },
  { to: ROUTES.settings, icon: 'settings', title: 'Cài đặt', body: 'Đổi tên hiển thị, số dòng mỗi trang, bảng gọn và kiểm tra kết nối dữ liệu.' },
]

const TIPS = [
  'Mọi tên merchant trong ứng dụng đều bấm được để mở hồ sơ.',
  'Nhấn Ctrl/⌘ + K để nhảy nhanh vào ô tìm kiếm của trang.',
  'Các nút xuất Excel xuất đúng danh sách đang được lọc (file CSV, mở được bằng Excel).',
  'Trên điện thoại, mở menu bằng nút ☰ ở góc trái phía trên.',
]

export default function Help() {
  const tel = COMPANY.hotline.replace(/\s/g, '')
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader title="Trợ giúp" subtitle="Hướng dẫn nhanh từng phân hệ của Giaodoan Merchant CRM." />

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        {GUIDES.map((g) => (
          <Link key={g.to} to={g.to} className="group flex gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <Icon name={g.icon} className="text-[22px]" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-headline-md text-[16px] font-bold text-on-surface group-hover:text-primary">
                {g.title}
                <Icon name="arrow_forward" className="text-[16px] opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="mt-1 block text-[14px] leading-snug text-secondary">{g.body}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 font-headline-md text-[18px] font-bold text-on-surface">
          <Icon name="lightbulb" className="text-[22px] text-primary-container" />
          Mẹo sử dụng
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[14px] text-on-surface">
          {TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mt-4 text-[14px] text-secondary">
          Không tìm thấy câu trả lời? Xem <Link to={ROUTES.faq} className="font-bold text-primary hover:underline">Câu hỏi thường gặp (FAQ)</Link>.
        </p>
      </section>

      <section className="rounded-xl bg-inverse-surface p-4 text-inverse-on-surface shadow-sm sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-headline-md text-[18px] font-bold">
          <Icon name="support_agent" className="text-[22px] text-primary-fixed-dim" />
          Liên hệ hỗ trợ
        </h2>
        <p className="mb-4 text-[14px] text-secondary-fixed-dim">Đội ngũ Giaodoan luôn sẵn sàng hỗ trợ bạn trong giờ hành chính.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-label-lg text-[14px] font-bold text-on-primary hover:opacity-95">
            <Icon name="call" className="text-[20px]" />
            Gọi {COMPANY.hotline}
          </a>
          <a href={`mailto:${COMPANY.email}`} className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 font-label-lg text-[14px] font-bold hover:bg-white/20">
            <Icon name="mail" className="text-[20px]" />
            {COMPANY.email}
          </a>
        </div>
      </section>
    </div>
  )
}
