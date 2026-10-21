import Icon from './Icon'

/** Placeholder body for screens that are not built yet. Replace the page file's contents when implementing. */
export default function TodoPage({ title, design, tables }: { title: string; design: string; tables: string }) {
  return (
    <div className="p-margin">
      <div className="rounded-xl bg-surface-container-lowest p-space-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Icon name="construction" className="text-[28px] text-primary-container" />
          <h1 className="font-headline-xl text-[28px] font-bold text-on-surface">{title}</h1>
        </div>
        <p className="mt-3 font-label-lg text-[15px] text-primary">TODO</p>
        <p className="mt-1 text-[14px] text-secondary">
          Design: <code>design/{design}/code.html</code> &middot; Data: {tables} (see <code>docs/DATA_MODEL.md</code>)
        </p>
      </div>
    </div>
  )
}
