import Icon from './Icon'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'

const TONES: Record<Tone, string> = {
  success: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  warning: 'bg-[#FEF3C7] text-[#92400E]',
  danger: 'bg-error-container text-on-error-container',
  info: 'bg-surface-container-high text-[#0e7490]',
  primary: 'bg-primary-fixed text-primary',
  neutral: 'bg-surface-container text-secondary',
}

/** Small rounded pill: <StatusBadge tone="success" icon="check_circle">Thành công</StatusBadge> */
export default function StatusBadge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: {
  tone?: Tone
  icon?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-label-md text-[12px] font-bold ${TONES[tone]} ${className}`}>
      {icon && <Icon name={icon} className="text-[15px]" />}
      {children}
    </span>
  )
}
