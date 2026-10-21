import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'

const TONES = {
  primary: { box: 'bg-primary-fixed text-primary', bar: 'bg-primary-container' },
  tertiary: { box: 'bg-tertiary-fixed text-tertiary', bar: 'bg-tertiary-container' },
  error: { box: 'bg-error-container text-error', bar: 'bg-error' },
  secondary: { box: 'bg-secondary-container text-secondary', bar: 'bg-secondary' },
} as const

/**
 * KPI card as used on the list screens (label + icon chip, big number, footer line, optional progress bar).
 *   <KpiCard label="Đang hoạt động" value="852" icon="verified" tone="tertiary" progress={68.3}
 *            footer={<span className="text-tertiary font-bold">68.3% tổng hệ thống</span>} />
 */
export default function KpiCard({
  label,
  value,
  icon,
  tone = 'primary',
  footer,
  progress,
  valueClassName = 'text-on-surface',
  className = '',
  to,
}: {
  label: string
  value: ReactNode
  icon: string
  tone?: keyof typeof TONES
  footer?: ReactNode
  /** 0-100; omit to hide the bar */
  progress?: number
  valueClassName?: string
  className?: string
  /** Make the whole card a link (e.g. to the list page behind the number). */
  to?: string
}) {
  const t = TONES[tone]
  const cls = `relative flex min-w-0 flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-5 ${to ? 'transition-shadow hover:shadow-md' : ''} ${className}`
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 font-label-md text-[12px] font-semibold uppercase tracking-wider text-secondary sm:text-[13px]">{label}</span>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${t.box}`}>
          <Icon name={icon} className="text-[20px]" />
        </div>
      </div>
      <div className="mt-3 sm:mt-4">
        <div className={`font-headline-xl text-[26px] font-bold tracking-tight sm:text-[30px] ${valueClassName}`}>{value}</div>
        {footer && <div className="mt-1 flex flex-wrap items-center gap-1.5 font-label-md text-[13px]">{footer}</div>}
      </div>
      {progress !== undefined && (
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-surface-container">
          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
    </>
  )
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
