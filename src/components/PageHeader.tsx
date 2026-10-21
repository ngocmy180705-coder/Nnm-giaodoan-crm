import type { ReactNode } from 'react'

/**
 * Standard page title block: title + optional subtitle on the left, action buttons on the right.
 * Actions wrap on tablets and become a full-width row on phones (buttons share the row equally).
 *   <PageHeader title="Hồ sơ Merchant" subtitle="..." actions={<><button .../><button .../></>} />
 */
export default function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 font-label-md text-[13px] uppercase tracking-wider text-secondary">{eyebrow}</div>}
        <h1 className="font-headline-xl text-[22px] font-bold leading-tight tracking-tight text-on-surface sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 font-body-lg text-[14px] text-secondary sm:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-space-sm max-sm:[&>*]:flex-1 max-sm:[&>*]:justify-center">{actions}</div>}
    </div>
  )
}
