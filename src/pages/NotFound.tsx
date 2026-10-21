import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import { btnPrimary, btnSecondary } from '../components/Form'
import { ROUTES } from '../lib/links'

export default function NotFound() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-margin py-space-xl">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl bg-surface-container-lowest p-8 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <Icon name="travel_explore" className="text-[34px]" />
        </div>
        <p className="font-headline-xl text-[40px] font-bold leading-none text-primary-container">404</p>
        <h1 className="font-headline-lg text-[20px] font-bold text-on-surface">Không tìm thấy trang</h1>
        <p className="break-all text-[14px] text-secondary">
          Đường dẫn <code className="rounded bg-surface-container px-1.5 py-0.5">{pathname}</code> không tồn tại hoặc đã được di chuyển.
        </p>
        <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to={ROUTES.overview} className={btnPrimary}>
            <Icon name="dashboard" className="text-[20px]" />
            Về Tổng quan
          </Link>
          <Link to={ROUTES.merchants} className={btnSecondary}>
            <Icon name="store" className="text-[20px]" />
            Hồ sơ Merchant
          </Link>
        </div>
      </div>
    </div>
  )
}
