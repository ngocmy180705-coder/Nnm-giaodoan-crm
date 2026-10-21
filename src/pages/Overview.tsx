import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'
import StatusBadge, { type Tone } from '../components/StatusBadge'
import { ErrorState, Loading } from '../components/Loading'
import { ONBOARDING_STEPS, RISK_LEVELS, RISK_TYPES } from '../lib/constants'
import { daysUntil, formatNumber, formatVndCompact, relativeTime } from '../lib/format'
import { activityPath, churnPath, contactsPath, merchantPath, newPath, onboardingPath, promotionsPath, ROUTES, subscriptionPath, supportPath } from '../lib/links'
import { useSettings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/useQuery'

interface Mer { id: string; code: string; name: string; status: string; contract_end: string | null }
interface Ticket { id: string; code: string; merchant_id: string; subject: string | null; priority: string; status: string; sla_due_at: string | null; updated_at: string }
interface Sub { id: string; code: string; merchant_id: string; plan_name: string; end_date: string }
interface Contact { id: string; code: string; merchant_id: string; purpose: string | null; content: string; channel_label: string | null; needs_callback: boolean; callback_at: string | null; occurred_at: string; actor_name: string | null }
interface Churn { id: string; merchant_id: string; risk_type: keyof typeof RISK_TYPES; risk_level: keyof typeof RISK_LEVELS; expires_on: string | null; alert_text: string | null }
interface Onb { id: string; merchant_id: string; steps_done: number }
interface Act { id: string; merchant_id: string; occurred_at: string; action_label: string; subtitle: string | null; icon: string | null; status: string }
interface Promo { id: string; code: string; name: string; discount_label: string | null; icon: string | null; end_date: string; budget_vnd: number; spent_vnd: number; participants: number }

interface Data { merchants: Mer[]; tickets: Ticket[]; subs: Sub[]; callbacks: Contact[]; recentContacts: Contact[]; churn: Churn[]; onboardings: Onb[]; acts: Act[]; promos: Promo[] }

const CONTACT_COLS = 'id,code,merchant_id,purpose,content,channel_label,needs_callback,callback_at,occurred_at,actor_name'

async function load(): Promise<{ data: Data | null; error: { message: string } | null }> {
  const r = await Promise.all([
    supabase.from('merchants').select('id,code,name,status,contract_end'),
    supabase.from('support_tickets').select('id,code,merchant_id,subject,priority,status,sla_due_at,updated_at').in('status', ['new', 'processing', 'waiting_merchant']),
    supabase.from('subscriptions').select('id,code,merchant_id,plan_name,end_date').eq('is_current', true),
    supabase.from('contact_logs').select(CONTACT_COLS).eq('needs_callback', true).order('occurred_at', { ascending: false }).limit(20),
    supabase.from('contact_logs').select(CONTACT_COLS).order('occurred_at', { ascending: false }).limit(8),
    supabase.from('churn_risks').select('id,merchant_id,risk_type,risk_level,expires_on,alert_text').eq('handled', false),
    supabase.from('onboardings').select('id,merchant_id,steps_done'),
    supabase.from('activity_logs').select('id,merchant_id,occurred_at,action_label,subtitle,icon,status').order('occurred_at', { ascending: false }).limit(8),
    supabase.from('promotions').select('id,code,name,discount_label,icon,end_date,budget_vnd,spent_vnd,participants').eq('status', 'running').order('end_date'),
  ])
  const failed = r.find((x) => x.error)
  if (failed?.error) return { data: null, error: failed.error }
  const [merchants, tickets, subs, callbacks, recentContacts, churn, onboardings, acts, promos] = r.map((x) => (x.data ?? []) as unknown[])
  return { data: { merchants, tickets, subs, callbacks, recentContacts, churn, onboardings, acts, promos } as Data, error: null }
}

function Section({ title, icon, to, linkLabel = 'Xem tất cả', children, className = '' }: { title: string; icon: string; to?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-headline-md text-[17px] font-bold text-on-surface">
          <Icon name={icon} className="text-[22px] text-primary-container" />
          <span className="truncate">{title}</span>
        </h2>
        {to && (
          <Link to={to} className="flex-shrink-0 py-2 font-label-lg text-[13px] font-bold text-primary hover:underline">{linkLabel}</Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** Plan names already start with "Gói" ("Gói Vàng (Gold)"): collapse any repeated prefix instead of adding one. */
const planLabel = (name: string) => name.trim().replace(/^(gói\s+)+/i, 'Gói ')

function MerchantLink({ mer, id, className = '' }: { mer: Map<string, Mer> | undefined; id: string; className?: string }) {
  const m = mer?.get(id)
  return m ? <Link to={merchantPath(id)} className={`font-semibold hover:text-primary hover:underline ${className}`}>{m.name}</Link> : <span>—</span>
}

interface TodoItem { key: string; icon: string; tone: Tone; badge: string; title: string; to: string; merchantId: string; detail: string }

export default function Overview() {
  const { settings } = useSettings()
  const { data, loading, error, reload } = useQuery<Data>(load, [])

  const view = useMemo(() => {
    if (!data) return null
    const mer = new Map(data.merchants.map((m) => [m.id, m]))
    const now = Date.now()
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)

    const expiring = data.subs.filter((s) => { const d = daysUntil(s.end_date); return d !== null && d >= 0 && d <= 30 }).sort((a, b) => a.end_date.localeCompare(b.end_date))
    const highRisk = data.churn.filter((c) => c.risk_level === 'critical' || c.risk_level === 'high')

    const tickets: TodoItem[] = data.tickets
      .map((t) => {
        const due = t.sla_due_at ? new Date(t.sla_due_at).getTime() : null
        const overdue = due !== null && due < now
        const soon = due !== null && !overdue && due - now < 24 * 3600 * 1000
        return { t, overdue, soon, rank: overdue ? 0 : soon ? 1 : t.priority === 'high' ? 2 : 9 }
      })
      .filter((x) => x.rank < 9)
      .sort((a, b) => a.rank - b.rank)
      .map(({ t, overdue, soon }) => ({
        key: `t${t.id}`, icon: overdue ? 'alarm' : 'headset_mic', tone: overdue ? 'danger' : soon ? 'warning' : 'primary',
        badge: overdue ? 'Quá hạn SLA' : soon ? `SLA ${relativeUntil(t.sla_due_at)}` : 'Gấp',
        title: `#${t.code}${t.subject ? ' · ' + t.subject : ''}`, to: supportPath(t.id), merchantId: t.merchant_id, detail: 'Yêu cầu hỗ trợ',
      }))

    const contracts: TodoItem[] = expiring.map((s) => {
      const d = daysUntil(s.end_date) ?? 0
      return { key: `s${s.id}`, icon: 'calendar_today', tone: d <= 7 ? 'danger' : 'warning', badge: d === 0 ? 'Hết hạn hôm nay' : `Còn ${d} ngày`, title: `${planLabel(s.plan_name)} · #${s.code}`, to: subscriptionPath(s.merchant_id), merchantId: s.merchant_id, detail: 'Gia hạn hợp đồng' }
    })

    const callbacks: TodoItem[] = data.callbacks
      .filter((c) => !c.callback_at || new Date(c.callback_at).getTime() <= endOfToday.getTime())
      .map((c) => ({ key: `c${c.id}`, icon: 'phone_callback', tone: 'info' as Tone, badge: c.callback_at ? `Gọi lại ${relativeUntil(c.callback_at)}` : 'Cần gọi lại', title: c.purpose || c.content.slice(0, 60), to: contactsPath(mer.get(c.merchant_id)?.code), merchantId: c.merchant_id, detail: 'Liên hệ' }))

    const churn: TodoItem[] = highRisk
      .sort((a, b) => (a.risk_level === 'critical' ? 0 : 1) - (b.risk_level === 'critical' ? 0 : 1))
      .map((c) => ({ key: `r${c.id}`, icon: 'warning', tone: c.risk_level === 'critical' ? 'danger' : 'warning', badge: RISK_LEVELS[c.risk_level].replace(/ \(.*\)/, ''), title: c.alert_text || RISK_TYPES[c.risk_type], to: `${churnPath()}?q=${encodeURIComponent(mer.get(c.merchant_id)?.code ?? '')}`, merchantId: c.merchant_id, detail: 'Nguy cơ rời bỏ' }))

    const stages = [0, 1, 2, 3, 4, 5].map((n) => ({ n, count: data.onboardings.filter((o) => Math.min(5, o.steps_done) === n).length }))
    const onbTotal = data.onboardings.length
    const onbOpen = data.onboardings.filter((o) => o.steps_done < 5).length

    const feed = [
      ...data.acts.map((a) => ({ key: `a${a.id}`, at: a.occurred_at, icon: a.icon || 'history', title: a.action_label, sub: a.subtitle, merchantId: a.merchant_id, to: activityPath(a.merchant_id), warn: a.status === 'failed' || a.status === 'warning' })),
      ...data.recentContacts.map((c) => ({ key: `c${c.id}`, at: c.occurred_at, icon: 'call', title: `${c.channel_label || 'Liên hệ'}${c.purpose ? ' · ' + c.purpose : ''}`, sub: c.content, merchantId: c.merchant_id, to: contactsPath(mer.get(c.merchant_id)?.code), warn: false })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8)

    return { mer, expiring, highRisk, tickets, contracts, callbacks, churn, stages, onbTotal, onbOpen, feed }
  }, [data])

  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

  const quick = [
    { label: 'Thêm merchant', icon: 'add_business', to: newPath('merchants') },
    { label: 'Tạo yêu cầu hỗ trợ', icon: 'support_agent', to: newPath('support') },
    { label: 'Ghi nhận cuộc gọi', icon: 'add_call', to: newPath('contacts') },
    { label: 'Đăng ký gói', icon: 'workspace_premium', to: newPath('subscriptions') },
  ]

  return (
    <div className="flex flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader
        title="Tổng quan"
        eyebrow={<span className="capitalize">{today}</span>}
        subtitle={`Xin chào ${settings.name}, đây là những việc cần chú ý hôm nay.`}
      />

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-2 sm:gap-space-sm lg:grid-cols-4">
        {quick.map((q) => (
          <Link key={q.to} to={q.to} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-container-lowest px-2.5 py-2 font-label-lg text-[13px] font-bold text-on-surface shadow-sm transition-all hover:bg-primary-fixed hover:text-primary sm:gap-2.5 sm:px-4 sm:py-3 sm:text-[14px]">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary sm:h-9 sm:w-9">
              <Icon name={q.icon} className="text-[18px] sm:text-[20px]" />
            </span>
            <span className="min-w-0 leading-tight">{q.label}</span>
          </Link>
        ))}
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && view && (
        <>
          <div className="grid grid-cols-2 gap-space-sm sm:gap-space-md xl:grid-cols-3 2xl:grid-cols-6">
            <KpiCard to={ROUTES.merchants} label="Tổng merchant" value={formatNumber(data.merchants.length)} icon="storefront" tone="primary" footer={<span className="text-secondary">Toàn hệ thống</span>} />
            <KpiCard to={ROUTES.merchants} label="Đang hoạt động" value={formatNumber(data.merchants.filter((m) => m.status === 'active').length)} icon="verified" tone="tertiary"
              footer={<span className="text-secondary">{pct(data.merchants.filter((m) => m.status === 'active').length, data.merchants.length)}% tổng số</span>} />
            <KpiCard to={ROUTES.onboarding} label="Đang onboard" value={formatNumber(view.onbOpen)} icon="pending_actions" tone="primary" footer={<span className="text-secondary">{view.onbTotal - view.onbOpen} đã go-live</span>} />
            <KpiCard to={ROUTES.support} label="Hỗ trợ đang mở" value={formatNumber(data.tickets.length)} icon="headset_mic" tone={view.tickets.some((t) => t.tone === 'danger') ? 'error' : 'secondary'}
              footer={<span className="text-secondary">{view.tickets.filter((t) => t.tone === 'danger').length} quá hạn SLA</span>} />
            <KpiCard to={ROUTES.subscriptions} label="Gói sắp hết hạn" value={formatNumber(view.expiring.length)} icon="alarm" tone="error" valueClassName={view.expiring.length ? 'text-error' : 'text-on-surface'} footer={<span className="text-secondary">trong 30 ngày tới</span>} />
            <KpiCard to={ROUTES.churn} label="Nguy cơ rời bỏ cao" value={formatNumber(view.highRisk.length)} icon="warning" tone="error" valueClassName={view.highRisk.length ? 'text-error' : 'text-on-surface'} footer={<span className="text-secondary">chưa xử lý</span>} />
          </div>

          <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
            <Section title="Cần xử lý hôm nay" icon="priority_high" className="order-1 md:col-span-2">
              {[
                { name: 'Yêu cầu hỗ trợ', items: view.tickets, to: ROUTES.support },
                { name: 'Hợp đồng sắp hết hạn', items: view.contracts, to: ROUTES.subscriptions },
                { name: 'Cần gọi lại', items: view.callbacks, to: ROUTES.contacts },
                { name: 'Nguy cơ rời bỏ cao', items: view.churn, to: ROUTES.churn },
              ].map((g) => (
                <div key={g.name} className="mb-3 last:mb-0">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="font-label-md text-[12px] font-bold uppercase tracking-wider text-secondary">{g.name} ({g.items.length})</h3>
                    {g.items.length > 4 && <Link to={g.to} className="py-1.5 text-[12px] font-bold text-primary hover:underline">Xem thêm {g.items.length - 4}</Link>}
                  </div>
                  {g.items.length === 0 ? (
                    <p className="rounded-lg bg-surface-container-low px-3 py-2 text-[13px] text-secondary">Không có mục nào cần xử lý.</p>
                  ) : (
                    <ul className="divide-y divide-surface-container">
                      {g.items.slice(0, 4).map((it) => (
                        <li key={it.key} className="flex items-start gap-3 py-2.5">
                          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-secondary">
                            <Icon name={it.icon} className="text-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link to={it.to} className="line-clamp-2 py-0.5 font-label-lg text-[14px] font-semibold text-on-surface hover:text-primary hover:underline sm:block sm:truncate">{it.title}</Link>
                            <div className="truncate text-[13px] text-secondary"><MerchantLink mer={view.mer} id={it.merchantId} className="text-on-surface" /> · {it.detail}</div>
                          </div>
                          <StatusBadge tone={it.tone} className="flex-shrink-0">{it.badge}</StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Section>

            <Section title="Tiến độ onboarding" icon="timeline" to={ROUTES.onboarding} className="order-2">
              {view.onbTotal === 0 ? (
                <p className="text-[13px] text-secondary">Chưa có merchant nào đang onboard.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {view.stages.filter((s) => s.n > 0 || s.count > 0).map((s) => {
                    const step = ONBOARDING_STEPS.find((x) => x.no === s.n)
                    return (
                      <li key={s.n}>
                        <Link to={ROUTES.onboarding} className="block rounded-lg px-2 py-2 hover:bg-surface-container-low">
                          <div className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="truncate font-semibold text-on-surface">{s.n === 0 ? 'Chưa bắt đầu' : `${s.n}. ${step?.title}`}</span>
                            <span className="font-bold text-on-surface">{s.count}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-container">
                            <div className="h-full rounded-full bg-primary-container" style={{ width: `${(s.count / view.onbTotal) * 100}%` }} />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              {data.onboardings.filter((o) => o.steps_done < 5).length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-surface-container pt-3 text-[13px]">
                  {data.onboardings.filter((o) => o.steps_done < 5).slice(0, 3).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <Link to={onboardingPath(o.merchant_id)} className="truncate font-semibold text-on-surface hover:text-primary hover:underline">{view.mer.get(o.merchant_id)?.name ?? 'Merchant'}</Link>
                      <span className="flex-shrink-0 text-secondary">{o.steps_done}/5 bước</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Hoạt động gần đây" icon="history" to={ROUTES.merchants} linkLabel="Merchant" className="order-4 md:col-span-2 xl:order-3">
              {view.feed.length === 0 ? (
                <p className="text-[13px] text-secondary">Chưa có hoạt động nào.</p>
              ) : (
                <ul className="divide-y divide-surface-container">
                  {view.feed.map((f) => (
                    <li key={f.key} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${f.warn ? 'bg-error-container text-error' : 'bg-surface-container text-secondary'}`}>
                        <Icon name={f.icon} className="text-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link to={f.to} className="line-clamp-2 py-0.5 font-label-lg text-[14px] font-semibold text-on-surface hover:text-primary hover:underline sm:block sm:truncate">{f.title}</Link>
                        <div className="truncate text-[13px] text-secondary"><MerchantLink mer={view.mer} id={f.merchantId} className="text-on-surface" />{f.sub ? ` · ${f.sub}` : ''}</div>
                      </div>
                      <span className="flex-shrink-0 text-[12px] text-secondary">{relativeTime(f.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="CTKM đang chạy" icon="local_offer" to={promotionsPath()} className="order-3 xl:order-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <span className="font-headline-xl text-[26px] font-bold text-on-surface">{data.promos.length}</span>
                <span className="text-[12px] text-secondary">
                  Đã chi {formatVndCompact(data.promos.reduce((n, p) => n + (p.spent_vnd || 0), 0))} / {formatVndCompact(data.promos.reduce((n, p) => n + (p.budget_vnd || 0), 0))}
                </span>
              </div>
              {data.promos.length === 0 ? (
                <p className="text-[13px] text-secondary">Hiện không có chương trình nào đang chạy.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {data.promos.slice(0, 4).map((p) => {
                    const use = p.budget_vnd ? Math.min(100, Math.round((p.spent_vnd / p.budget_vnd) * 100)) : 0
                    const left = daysUntil(p.end_date)
                    return (
                      <li key={p.id}>
                        <Link to={promotionsPath()} className="block rounded-lg px-2 py-2 hover:bg-surface-container-low">
                          <div className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="truncate font-semibold text-on-surface">{p.name}</span>
                            <span className="flex-shrink-0 text-secondary">{left !== null && left >= 0 ? `còn ${left} ngày` : ''}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-container">
                            <div className="h-full rounded-full bg-tertiary-container" style={{ width: `${use}%` }} />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  )
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0)

/** "sau 2 giờ" / "trong 3 ngày" / "trễ" helper for SLA & callback badges */
function relativeUntil(iso: string | null): string {
  if (!iso) return ''
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (mins <= 0) return 'ngay'
  if (mins < 60) return `${mins} phút nữa`
  if (mins < 24 * 60) return `${Math.round(mins / 60)} giờ nữa`
  return `${Math.round(mins / 1440)} ngày nữa`
}
