import type { Faq as FaqRow, FaqCategory, Staff } from '../../lib/types'

export type Audience = FaqRow['audience']
export type FaqWithStaff = FaqRow & { updater: Pick<Staff, 'id' | 'full_name' | 'title'> | null }

export const CATEGORY_ICON: Record<FaqCategory, { icon: string; cls: string }> = {
  payout: { icon: 'payments', cls: 'text-tertiary' },
  operations: { icon: 'print', cls: 'text-primary' },
  account: { icon: 'lock_reset', cls: 'text-primary' },
  policy: { icon: 'workspace_premium', cls: 'text-on-surface' },
  promotion: { icon: 'loyalty', cls: 'text-primary' },
}
