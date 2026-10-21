import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { Field, FormGrid, btnPrimary, btnSecondary, inputCls } from '../components/Form'
import { Loading } from '../components/Loading'
import { useToast } from '../lib/layoutContext'
import { ROUTES } from '../lib/links'
import { PAGE_SIZE_OPTIONS, useSettings } from '../lib/settings'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useQuery } from '../lib/useQuery'

const TABLES = [
  ['merchants', 'Merchant'], ['merchant_contacts', 'Đầu mối liên hệ'], ['staff', 'Nhân viên'], ['service_plans', 'Gói dịch vụ'],
  ['subscriptions', 'Hợp đồng gói'], ['invoices', 'Hóa đơn'], ['onboardings', 'Onboarding'], ['onboarding_steps', 'Bước onboarding'],
  ['onboarding_tasks', 'Việc con onboarding'], ['support_tickets', 'Yêu cầu hỗ trợ'], ['ticket_messages', 'Phản hồi'], ['ticket_attachments', 'Tệp đính kèm'],
  ['reply_templates', 'Mẫu phản hồi'], ['contact_logs', 'Lịch sử liên hệ'], ['churn_risks', 'Nguy cơ rời bỏ'], ['activity_logs', 'Nhật ký hoạt động'],
  ['faqs', 'FAQ'], ['promotions', 'CTKM'], ['promotion_merchants', 'Merchant tham gia CTKM'], ['promotion_budgets', 'Ngân sách CTKM'],
] as const

/** Tables that have a page of their own: the row in "Dữ liệu" links there. */
const TABLE_ROUTE: Record<string, string> = {
  merchants: ROUTES.merchants, onboardings: ROUTES.onboarding, support_tickets: ROUTES.support, subscriptions: ROUTES.subscriptions,
  contact_logs: ROUTES.contacts, churn_risks: ROUTES.churn, faqs: ROUTES.faq, promotions: ROUTES.promotions,
}

interface Health { rows: { table: string; label: string; count: number | null; error: string | null }[]; ms: number }

async function checkData(): Promise<{ data: Health; error: null }> {
  const t0 = performance.now()
  const rows = await Promise.all(
    TABLES.map(async ([table, label]) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      return { table, label, count: error ? null : (count ?? 0), error: error?.message ?? null }
    }),
  )
  return { data: { rows, ms: Math.round(performance.now() - t0) }, error: null }
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-headline-md text-[18px] font-bold text-on-surface">
        <Icon name={icon} className="text-[22px] text-primary-container" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function Settings() {
  const toast = useToast()
  const { settings, update, reset } = useSettings()
  const [name, setName] = useState(settings.name)
  const [role, setRole] = useState(settings.role)
  useEffect(() => { setName(settings.name); setRole(settings.role) }, [settings.name, settings.role])
  const [nameErr, setNameErr] = useState<string | null>(null)
  const health = useQuery<Health>(checkData, [])
  const trimmedName = name.trim()
  const trimmedRole = role.trim()
  const dirty = trimmedName !== settings.name || trimmedRole !== settings.role

  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  let host = '—'
  try { host = url ? new URL(url).host : '—' } catch { /* ignore */ }
  const failed = health.data?.rows.filter((r) => r.error) ?? []
  const connected = !!health.data && failed.length === 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-space-lg px-margin py-space-lg">
      <PageHeader title="Cài đặt" subtitle="Hồ sơ người dùng, tuỳ chọn hiển thị và tình trạng dữ liệu. Cài đặt được lưu trên trình duyệt này." />

      <Card title="Hồ sơ người dùng" icon="account_circle">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!trimmedName) return setNameErr('Họ và tên không được để trống')
            setNameErr(null)
            if (!dirty) return
            update({ name: trimmedName, role: trimmedRole || settings.role })
            toast('Đã lưu hồ sơ')
          }}
        >
          <FormGrid>
            <Field label="Họ và tên" required>
              <input className={`${inputCls} ${nameErr ? 'border-error' : ''}`} value={name} aria-invalid={!!nameErr} onChange={(e) => { setName(e.target.value); setNameErr(null) }} maxLength={60} />
              {nameErr && <span role="alert" className="text-[13px] text-error">{nameErr}</span>}
            </Field>
            <Field label="Chức vụ"><input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} /></Field>
          </FormGrid>
          <div className="mt-4 flex justify-end">
            <button type="submit" className={`${btnPrimary} max-sm:w-full`} disabled={!dirty}>
              <Icon name="save" className="text-[20px]" />
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </Card>

      <Card title="Tuỳ chọn hiển thị" icon="tune">
        <div className="flex flex-col gap-5">
          <Field label="Số dòng mỗi trang (danh sách)">
            <select className={`${inputCls} sm:max-w-xs`} value={settings.pageSize}
              onChange={(e) => { update({ pageSize: Number(e.target.value) }); toast('Đã lưu số dòng mỗi trang') }}>
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} dòng / trang</option>)}
            </select>
          </Field>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-surface-container-low px-4 py-3">
            <span>
              <span className="block font-label-lg text-[15px] font-semibold text-on-surface">Mật độ bảng gọn</span>
              <span className="block text-[13px] text-secondary">Thu nhỏ khoảng cách dòng trong mọi bảng để xem được nhiều dữ liệu hơn.</span>
            </span>
            <input type="checkbox" role="switch" className="peer sr-only" checked={settings.compact} onChange={(e) => { update({ compact: e.target.checked }); toast(e.target.checked ? 'Đã bật bảng gọn' : 'Đã tắt bảng gọn') }} />
            <span aria-hidden className="relative h-6 w-11 flex-shrink-0 rounded-full bg-secondary-fixed-dim transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary-container peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
          </label>
          <div className="flex justify-end">
            <button type="button" className={`${btnSecondary} max-sm:w-full`} onClick={() => { reset(); toast('Đã khôi phục cài đặt mặc định') }}>
              <Icon name="restart_alt" className="text-[20px]" />
              Khôi phục mặc định
            </button>
          </div>
        </div>
      </Card>

      <Card title="Dữ liệu" icon="database">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {health.loading && !health.data ? (
              <StatusBadge tone="neutral">Đang kiểm tra...</StatusBadge>
            ) : !isSupabaseConfigured ? (
              <StatusBadge tone="danger" icon="error">Chưa cấu hình Supabase</StatusBadge>
            ) : health.error ? (
              <StatusBadge tone="danger" icon="error">Lỗi kiểm tra dữ liệu</StatusBadge>
            ) : connected ? (
              <StatusBadge tone="success" icon="check_circle">Đã kết nối</StatusBadge>
            ) : (
              <StatusBadge tone="danger" icon="error">Lỗi {failed.length}/{TABLES.length} bảng</StatusBadge>
            )}
            <span className="break-all text-[13px] text-secondary">Supabase · {host}{health.data ? ` · ${health.data.ms} ms` : ''}</span>
            {health.error && isSupabaseConfigured && <span role="alert" className="w-full text-[13px] text-error">Không kiểm tra được dữ liệu: {health.error}</span>}
          </div>
          <button type="button" className={`${btnSecondary} max-sm:w-full`} onClick={health.reload} disabled={health.loading}>
            <Icon name="refresh" className="text-[20px]" />
            Kiểm tra lại
          </button>
        </div>
        {health.loading && !health.data && <Loading />}
        {health.data && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {health.data.rows.map((r) => {
              const to = TABLE_ROUTE[r.table]
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-on-surface">{r.label}</span>
                    <span className="block truncate font-mono text-[11px] text-secondary">{r.table}</span>
                  </span>
                  {r.error ? <StatusBadge tone="danger">Lỗi</StatusBadge> : <span className="font-headline-md text-[18px] font-bold text-on-surface">{r.count?.toLocaleString('vi-VN')}</span>}
                </>
              )
              const cls = 'flex min-h-[48px] items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2.5'
              return (
                <li key={r.table} title={r.error ?? r.table}>
                  {to ? <Link to={to} className={`${cls} transition-colors hover:bg-primary-fixed`}>{body}</Link> : <div className={cls}>{body}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
