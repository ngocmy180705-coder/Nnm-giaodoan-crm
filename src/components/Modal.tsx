import { useEffect, type ReactNode } from 'react'
import Icon from './Icon'
import { useScrollLock } from '../lib/useScrollLock'

/**
 * Centered dialog on >=sm, full-screen sheet on mobile (scrollable body, footer always visible, buttons stretch).
 * Closes on Esc / backdrop click; locks body scroll while open.
 *   <Modal open={open} title="Thêm Merchant mới" onClose={() => setOpen(false)} footer={<>...buttons</>}>...form...</Modal>
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-on-background/40 backdrop-blur-sm sm:items-center sm:p-6 print:hidden" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex h-full max-h-full w-full ${width} flex-col overflow-hidden bg-surface-container-lowest shadow-2xl sm:h-auto sm:rounded-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-surface-container px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="min-w-0 truncate font-headline-lg text-[18px] font-bold text-on-surface sm:text-[20px]">{title}</h2>
          <button type="button" onClick={onClose} className="flex-shrink-0 rounded-lg p-2 text-secondary hover:bg-surface-container" aria-label="Đóng">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-container bg-surface-container-low px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-6 sm:py-4 max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center">{footer}</div>}
      </div>
    </div>
  )
}
