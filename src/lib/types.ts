// Row types mirroring supabase/migrations/0001_init.sql. Column -> screen map: docs/DATA_MODEL.md
// uuid / timestamptz / date columns are strings; numeric(...) and bigint come back as numbers from PostgREST.

export type MerchantStatus = 'onboarding' | 'active' | 'new' | 'consulted' | 'stopped'

export interface Staff {
  id: string
  code: string | null
  full_name: string
  title: string | null
  role_label: string | null
  team: string | null
  email: string | null
  phone: string | null
  ext: string | null
  created_at: string
}

export interface Merchant {
  id: string
  code: string
  name: string
  category: string | null
  status: MerchantStatus
  phone: string
  email: string | null
  personal_email: string | null
  address: string
  address_full: string | null
  region: string | null
  district: string | null
  area_label: string | null
  lat: number | null
  lng: number | null
  delivery_radius_km: number | null
  pickup_time_label: string | null
  is_open: boolean
  contact_name: string | null
  contact_title: string | null
  contact_verified: boolean
  call_hours: string | null
  zalo_group: string | null
  zalo_group_note: string | null
  business_license: string | null
  tax_code: string | null
  branch_type: string | null
  partner_tier: string | null
  icon: string | null
  emoji: string | null
  image_url: string | null
  cover_url: string | null
  map_url: string | null
  account_manager_id: string | null
  created_by_id: string | null
  take_rate_pct: number | null
  payout_schedule: string | null
  bank_account: string | null
  contract_end: string | null
  gmv_month_vnd: number | null
  gmv_growth_pct: number | null
  orders_month: number | null
  completion_rate_pct: number | null
  aov_vnd: number | null
  best_seller: string | null
  prep_time_min: number | null
  stats_updated_at: string | null
  created_at: string
}

/** merchants + PostgREST embeds: select('*, account_manager:staff!account_manager_id(*), created_by:staff!created_by_id(*)') */
export interface MerchantWithStaff extends Merchant {
  account_manager: Staff | null
  created_by: Staff | null
}

export interface MerchantContact {
  id: string
  merchant_id: string
  full_name: string
  title: string | null
  phone: string | null
  sort_order: number
  created_at: string
}

export type PlanTier = 'silver' | 'gold' | 'diamond'

export interface ServicePlan {
  id: string
  code: PlanTier
  name: string
  tier_label: string | null
  badge: string | null
  icon: string | null
  price_month_vnd: number
  price_year_vnd: number
  year_note: string | null
  commission_pct: number | null
  features: string[]
  sort_order: number
  created_at: string
}

export interface SubscriptionBenefit {
  icon: string
  title: string
  description: string
}

export interface Subscription {
  id: string
  code: string
  merchant_id: string
  plan_id: string | null
  plan_name: string
  plan_tier: PlanTier | 'trial'
  cycle_months: number | null
  cycle_label: string | null
  contract_note: string | null
  list_price_vnd: number | null
  discount_pct: number
  amount_vnd: number
  signed_at: string | null
  start_date: string
  end_date: string
  status: 'active' | 'completed' | 'cancelled'
  is_current: boolean
  auto_renew: boolean
  payment_method: string | null
  payment_ref: string | null
  benefits: SubscriptionBenefit[]
  account_manager_id: string | null
  created_at: string
}

export interface Invoice {
  id: string
  number: string
  merchant_id: string
  subscription_id: string | null
  issued_at: string
  einvoice_series: string | null
  einvoice_no: string | null
  status: 'paid' | 'pending' | 'void'
  line_title: string | null
  term_months: number | null
  list_price_vnd: number | null
  discount_vnd: number
  discount_pct: number
  total_vnd: number
  amount_in_words: string | null
  vat_note: string | null
  previous_contract_code: string | null
  previous_end_date: string | null
  new_start_date: string | null
  new_end_date: string | null
  payment_method: string | null
  payment_ref: string | null
  payment_note: string | null
  merchant_rep_name: string | null
  merchant_rep_phone: string | null
  merchant_signed_at: string | null
  merchant_sign_provider: string | null
  issuer_unit: string | null
  issuer_staff_id: string | null
  issuer_sign_note: string | null
  created_at: string
}

export interface Onboarding {
  id: string
  merchant_id: string
  assignee_id: string | null
  steps_done: number
  owner_label: string | null
  started_at: string | null
  go_live_date: string | null
  sla_note: string | null
  sla_detail: string | null
  created_at: string
}

export interface OnboardingStep {
  id: string
  onboarding_id: string
  step_no: number
  title: string
  description: string | null
  status: 'done' | 'in_progress' | 'pending'
  completed_at: string | null
  completed_by: string | null
  planned_label: string | null
  meta: Record<string, unknown>
  guide_goal: string | null
  guide_checklist: string[]
  created_at: string
}

export interface OnboardingTask {
  id: string
  step_id: string
  title: string
  done: boolean
  sort_order: number
  created_at: string
}

export type TicketCategory = 'payment' | 'store' | 'login' | 'onboarding' | 'feedback' | 'other'
export type TicketStatus = 'new' | 'processing' | 'waiting_merchant' | 'resolved' | 'closed'

export interface SupportTicket {
  id: string
  code: string
  merchant_id: string
  branch_label: string | null
  category: TicketCategory
  subject: string | null
  body: string | null
  priority: 'low' | 'normal' | 'high'
  status: TicketStatus
  assignee_id: string | null
  sla_due_at: string | null
  responded_at: string | null
  status_note: string | null
  updated_at: string
  updated_by: string | null
  created_at: string
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  file_name: string
  size_label: string | null
  kind_label: string | null
  kind: 'xlsx' | 'pdf' | 'image' | 'other'
  url: string | null
  uploaded_by: 'merchant' | 'staff'
  created_at: string
}

export interface TicketMessage {
  id: string
  code: string
  ticket_id: string
  handler_id: string | null
  handler_name: string | null
  handler_role: string | null
  responder_name: string | null
  content: string
  channel: 'app' | 'zalo_sms' | 'email' | 'internal'
  created_at: string
}

export interface ReplyTemplate {
  id: string
  title: string
  body: string
  sort_order: number
  created_at: string
}

export type ContactStatus = 'success' | 'no_answer' | 'hung_up' | 'pending'

export interface ContactLog {
  id: string
  code: string
  merchant_id: string
  staff_id: string | null
  actor_name: string | null
  channel: 'voip' | 'zalo' | 'visit' | 'meet' | 'note'
  channel_label: string | null
  contact_person: string | null
  purpose: string | null
  content: string
  tags: string[]
  status: ContactStatus
  duration_seconds: number
  has_recording: boolean
  needs_callback: boolean
  callback_at: string | null
  occurred_at: string
  created_at: string
}

export interface ChurnRisk {
  id: string
  merchant_id: string
  risk_type: 'expiring' | 'order_gap' | 'app_inactive'
  risk_level: 'critical' | 'high' | 'medium'
  expires_on: string | null
  inactive_days: number | null
  alert_text: string | null
  handled: boolean
  handled_at: string | null
  assignee_id: string | null
  note: string | null
  detected_at: string
  created_at: string
}

export interface ActivityLog {
  id: string
  merchant_id: string
  occurred_at: string
  action_type:
    | 'pause_orders' | 'resume_orders' | 'update_store' | 'update_menu' | 'confirm_order'
    | 'cancel_order' | 'create_promo' | 'login_failed' | 'pos_sync' | 'update_document'
  action_label: string
  subtitle: string | null
  icon: string | null
  category: 'orders' | 'config' | 'security'
  details: string | null
  old_value: string | null
  new_value: string | null
  extra: Record<string, unknown>
  actor_type: 'owner' | 'cashier' | 'system' | 'support' | 'guest'
  actor_name: string | null
  actor_role: string | null
  device: string | null
  ip: string | null
  status: 'success' | 'failed' | 'warning' | 'cancelled'
  created_at: string
}

export type FaqCategory = 'payout' | 'operations' | 'account' | 'policy' | 'promotion'

export interface Faq {
  id: string
  code: string
  category: FaqCategory
  question: string
  answer: string
  icon: string | null
  view_count: number
  is_visible: boolean
  audience: 'all' | 'new' | 'chain'
  updated_by_id: string | null
  updated_at: string
  created_at: string
}

export type PromoSponsor = 'giaodoan_100' | 'split_50_50' | 'giaodoan_70_mc_30' | 'merchant_100'

export interface Promotion {
  id: string
  code: string
  name: string
  description: string | null
  promo_type: 'percent' | 'freeship' | 'combo' | 'voucher' | 'bogo' | 'flash_sale'
  discount_label: string | null
  icon: string | null
  sponsor: PromoSponsor
  participants: number
  start_date: string
  end_date: string
  status: 'running' | 'upcoming' | 'ended'
  is_active: boolean
  budget_vnd: number
  spent_vnd: number
  revenue_vnd: number
  region: string
  audience: 'all' | 'top_tier' | 'list'
  terms: string | null
  created_at: string
}

export interface PromotionMerchant {
  id: string
  promotion_id: string
  merchant_id: string
  orders_count: number
  uplift_pct: number | null
  revenue_gain_vnd: number
  created_at: string
}

export interface PromotionBudget {
  id: string
  region: string
  quarter: string
  limit_vnd: number
  spent_vnd: number
  created_at: string
}
