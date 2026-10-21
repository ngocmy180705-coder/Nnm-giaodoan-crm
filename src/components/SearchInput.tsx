import { useEffect, useRef } from 'react'
import Icon from './Icon'

/** The "search + ⌘K badge" box used in every toolbar. */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  // the ⌘K / Ctrl+K badge is real: focus the (first visible) search box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && ref.current && ref.current.offsetParent !== null) {
        e.preventDefault()
        ref.current.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className={`relative w-full min-w-0 flex-1 sm:w-96 ${className}`}>
      <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-secondary" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-secondary-container/40 bg-surface-container-low py-2.5 pl-10 pr-4 font-body-md text-[16px] sm:pr-16 sm:text-[15px] text-on-surface transition-all placeholder:text-secondary/70 focus:bg-surface-container focus:outline-none"
      />
      <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded bg-surface-container px-2 py-0.5 font-label-sm text-[12px] font-bold tracking-wider text-secondary sm:block">⌘K</span>
    </div>
  )
}
