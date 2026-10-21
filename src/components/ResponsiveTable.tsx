import type { ReactNode } from 'react'

/**
 * THE table pattern (see docs/UI_GUIDE.md). Wrap every <table> in this.
 *  - default: horizontal scroll container; the table keeps `minWidth` px so columns never crush (works at any width).
 *  - with `cards`: below md the table is hidden and the cards (a stacked list, built with <MobileCard>) show instead.
 *
 *   <ResponsiveTable minWidth={880} cards={rows.map((r) => <MobileCard key={r.id} ... />)}>
 *     <table className="w-full ...">...</table>
 *   </ResponsiveTable>
 */
export default function ResponsiveTable({
  children,
  minWidth = 720,
  cards,
  className = '',
}: {
  children: ReactNode
  minWidth?: number
  cards?: ReactNode
  className?: string
}) {
  return (
    <>
      {cards !== undefined && <div className="flex flex-col gap-3 md:hidden">{cards}</div>}
      <div className={`w-full overflow-x-auto overscroll-x-contain ${cards !== undefined ? 'hidden md:block' : ''} ${className}`}>
        <div style={{ minWidth }}>{children}</div>
      </div>
    </>
  )
}

/**
 * One row as a card on mobile: title (usually a <Link>), optional badge on the right, label/value fields, optional actions.
 *   <MobileCard title={<Link to={merchantPath(m.id)}>{m.name}</Link>} badge={<StatusBadge>..</StatusBadge>}
 *               fields={[['Mã', m.code], ['Khu vực', m.region]]} />
 */
export function MobileCard({
  title,
  subtitle,
  badge,
  fields = [],
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  fields?: [label: string, value: ReactNode][]
  actions?: ReactNode
}) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-label-lg text-[15px] font-bold text-on-surface">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-[13px] text-secondary">{subtitle}</div>}
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </div>
      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-secondary">{label}</dt>
              <dd className="truncate font-semibold text-on-surface">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
