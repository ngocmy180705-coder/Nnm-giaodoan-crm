import Icon from './Icon'

function pageList(page: number, pages: number): (number | '...')[] {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '...')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  if (start > 2) out.push('...')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < pages - 1) out.push('...')
  out.push(pages)
  return out
}

/**
 * Footer used under every table: "Hiển thị 1 - 8 trong tổng số 13 Merchant" + page buttons. `page` is 1-based.
 *   <Pagination page={page} pageSize={8} total={rows.length} onPage={setPage} label="Merchant" />
 */
export default function Pagination({
  page,
  pageSize,
  total,
  onPage,
  label = 'mục',
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  label?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-3 sm:flex-row sm:gap-space-md sm:py-3.5">
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 font-body-lg text-[13px] text-secondary sm:justify-start sm:text-[15px]">
        <span className="hidden sm:inline">Hiển thị</span>
        <span className="font-bold text-on-surface">{from} - {to}</span>
        <span>
          <span className="sm:hidden">/</span>
          <span className="hidden sm:inline">trong tổng số</span>
        </span>
        <span className="font-bold text-on-surface">{total.toLocaleString('vi-VN')}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"
          className="flex items-center justify-center rounded-lg bg-surface-container-low px-3 py-1.5 text-secondary transition-all hover:bg-surface-container hover:text-on-surface disabled:opacity-40">
          <Icon name="chevron_left" className="text-[20px]" />
        </button>
        {/* mobile: compact "Trang x/y" instead of numbered buttons */}
        <span className="min-w-[5.5rem] text-center font-label-lg text-[14px] font-semibold text-on-surface sm:hidden">Trang {Math.min(page, pages)}/{pages}</span>
        {pageList(page, pages).map((p, i) =>
          p === '...' ? (
            <span key={`d${i}`} className="hidden w-6 text-center font-label-md font-bold text-secondary sm:block">...</span>
          ) : (
            <button key={p} type="button" onClick={() => onPage(p)}
              className={`hidden h-9 w-9 items-center justify-center rounded-lg font-label-lg text-[15px] transition-all sm:flex ${
                p === page ? 'bg-primary-container font-bold text-on-primary shadow-sm' : 'font-semibold text-on-surface hover:bg-surface-container'
              }`}>
              {p}
            </button>
          ),
        )}
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau"
          className="flex items-center justify-center rounded-lg bg-surface-container-low px-3 py-1.5 text-secondary transition-all hover:bg-surface-container hover:text-on-surface disabled:opacity-40">
          <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>
    </div>
  )
}
