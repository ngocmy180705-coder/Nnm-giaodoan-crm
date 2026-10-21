/** Material Symbols Outlined glyph: <Icon name="store" className="text-[22px] text-primary" /> */
export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}
