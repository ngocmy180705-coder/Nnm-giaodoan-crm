import type { ReactNode } from 'react'

/** Shared class strings for inputs / buttons so modal forms look identical on every screen. */
export const inputCls =
  'w-full rounded-lg border border-secondary-container/60 bg-surface-container-low px-3 py-2.5 font-body-md text-[16px] text-on-surface sm:text-[14px] placeholder:text-secondary/60 focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none'
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-label-lg text-[14px] font-bold text-on-primary shadow-md transition-all hover:opacity-95 disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-surface-container px-5 py-2.5 font-label-lg text-[14px] font-semibold text-on-surface shadow-sm transition-all hover:bg-surface-container-high disabled:opacity-50'

/** Responsive form grid: 1 column on mobile, 2 from sm. Use `className="sm:col-span-2"` on a Field to span both. */
export function FormGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 ${className}`}>{children}</div>
}

/** Label + control wrapper: <Field label="Tên" required><input className={inputCls} .../></Field> */
export function Field({ label, required, children, className = '' }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="font-label-md text-[13px] font-semibold text-secondary">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
    </label>
  )
}
