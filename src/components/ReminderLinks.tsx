import Icon from './Icon'
import { smsUrl, zaloUrl } from '../lib/contactLog'

/** Real send links for a single merchant: logging a reminder sends nothing, so offer Zalo / SMS shortcuts. */
export default function ReminderLinks({ phone, text, className = '' }: { phone: string | null | undefined; text: string; className?: string }) {
  const zalo = zaloUrl(phone)
  const sms = smsUrl(phone, text)
  const cls = 'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-surface-container-high'
  if (!zalo && !sms) return <span className={`text-[13px] text-secondary ${className}`}>Chưa có số điện thoại để gửi tin.</span>
  return (
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-[13px] text-secondary">Gửi ngay:</span>
      {zalo && <a href={zalo} target="_blank" rel="noopener noreferrer" className={cls}><Icon name="chat" className="text-[18px]" />Mở Zalo</a>}
      {sms && <a href={sms} className={cls}><Icon name="sms" className="text-[18px]" />Soạn SMS</a>}
    </span>
  )
}
