import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { btnSecondary } from '../../components/Form'
import { FAQ_CATEGORIES } from '../../lib/constants'
import { formatNumber } from '../../lib/format'
import type { FaqCategory } from '../../lib/types'
import { CATEGORY_ICON, type FaqWithStaff } from './shared'

const KEYS = Object.keys(FAQ_CATEGORIES) as FaqCategory[]

/** "Phân loại chuyên mục": per-category overview (count, visible, views). Picking a category filters the list. */
export function CategoryModal({ open, faqs, onClose, onPick }: { open: boolean; faqs: FaqWithStaff[]; onClose: () => void; onPick: (c: FaqCategory) => void }) {
  return (
    <Modal open={open} title="Phân loại chuyên mục" onClose={onClose} width="max-w-xl"
      footer={<button type="button" className={btnSecondary} onClick={onClose}>Đóng</button>}>
      <p className="mb-3 text-[13px] text-secondary">Chuyên mục là danh mục cố định của hệ thống. Chọn một chuyên mục để lọc danh sách câu hỏi.</p>
      <ul className="flex flex-col gap-2">
        {KEYS.map((k) => {
          const rows = faqs.filter((f) => f.category === k)
          const visible = rows.filter((f) => f.is_visible).length
          const views = rows.reduce((s, f) => s + f.view_count, 0)
          return (
            <li key={k}>
              <button type="button" onClick={() => onPick(k)}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 text-left transition-colors hover:bg-surface-container">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest">
                  <Icon name={CATEGORY_ICON[k].icon} className={`text-[22px] ${CATEGORY_ICON[k].cls}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-label-lg text-[14px] font-bold text-on-surface">{FAQ_CATEGORIES[k]}</span>
                  <span className="block text-[12px] text-secondary">{visible}/{rows.length} đang hiển thị · {formatNumber(views)} lượt tra cứu</span>
                </span>
                <span className="flex-shrink-0 rounded-full bg-surface-container-highest px-2.5 py-0.5 text-[13px] font-bold text-secondary">{rows.length}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
