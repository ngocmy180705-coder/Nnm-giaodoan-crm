import type { ChurnRisk, Merchant, Staff } from '../../lib/types'

export type RiskRow = ChurnRisk & {
  merchant: Pick<Merchant, 'id' | 'code' | 'name' | 'phone' | 'address' | 'icon' | 'emoji' | 'region' | 'status'> | null
  assignee: Pick<Staff, 'id' | 'full_name'> | null
}
