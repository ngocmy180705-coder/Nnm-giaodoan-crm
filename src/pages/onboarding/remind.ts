// "Ghi nhận nhắc Zalo/SMS" for onboarding pages: logs one pending contact_logs row per merchant (channel zalo,
// purpose onboarding). Nothing is sent - the operator has to message the merchant manually.
// Used by the list (bulk, selected rows) and the detail page (single merchant). Returns an error message or null.
import { insertContactLogs } from '../../lib/contactLog'

export interface ReminderTarget {
  merchantId: string
  contactPerson: string | null
  content: string
}

export async function logReminders(targets: ReminderTarget[], operatorName: string): Promise<string | null> {
  const { error } = await insertContactLogs(
    targets.map((t) => ({
      merchantId: t.merchantId,
      contactPerson: t.contactPerson,
      channel: 'zalo' as const,
      channelLabel: 'Zalo/SMS',
      purpose: 'Hướng dẫn Onboarding & Menu',
      content: `Cần nhắc qua Zalo/SMS: ${t.content}`,
      tags: ['onboarding', 'nhắc nhở'],
    })),
    operatorName,
  )
  return error
}
