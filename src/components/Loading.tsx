import Icon from './Icon'

export function Loading({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-secondary" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-surface-container-high border-t-primary-container" />
      <span className="font-label-lg text-[14px]">{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-error-container/40 px-6 py-12 text-center" role="alert">
      <Icon name="error" className="text-[36px] text-error" />
      <p className="font-label-lg text-[15px] text-on-error-container">Không tải được dữ liệu</p>
      <p className="max-w-xl text-[13px] text-on-error-container/80">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-1 rounded-lg bg-error px-4 py-2 font-label-lg text-[14px] text-on-error hover:opacity-90">
          Thử lại
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'Không có dữ liệu phù hợp.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-secondary">
      <Icon name="inbox" className="text-[36px] text-outline-variant" />
      <p className="text-[14px]">{message}</p>
    </div>
  )
}
